"use client";

import { useState, useEffect, useCallback, Suspense, useRef } from "react";
import { useWalletConnection, useSendTransaction } from "@solana/react-hooks";
import { AccountRole, type Address, getProgramDerivedAddress, getAddressEncoder } from "@solana/kit";
import { VAULT_PROGRAM_ADDRESS } from "../generated/vault";
import { getRpcEndpoint } from "../lib/rpc-config";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

// Helper to find the correct depositId by brute-forcing values around createdAt
async function findDepositId(
  depositorAddress: string,
  expectedPda: string,
  createdAtSeconds: number
): Promise<bigint | null> {
  const addressEncoder = getAddressEncoder();
  const depositorBytes = addressEncoder.encode(depositorAddress as Address);

  // Try values around createdAt * 1000 (±10 seconds range)
  const baseMs = BigInt(createdAtSeconds) * 1000n;
  const range = 10000n; // 10 seconds in ms

  for (let offset = 0n; offset <= range; offset += 1n) {
    for (const candidate of [baseMs + offset, baseMs - offset]) {
      if (candidate < 0n) continue;

      const depositIdBytes = new Uint8Array(8);
      new DataView(depositIdBytes.buffer).setBigUint64(0, candidate, true);

      try {
        const [pda] = await getProgramDerivedAddress({
          programAddress: VAULT_PROGRAM_ADDRESS,
          seeds: [new TextEncoder().encode("deposit"), depositorBytes, depositIdBytes],
        });

        if (pda === expectedPda) {
          return candidate;
        }
      } catch {
        continue;
      }
    }
  }

  return null;
}

interface Deposit {
  depositId: bigint;
  pda: string;
  amount: bigint;
  claimed: boolean;
  createdAt: Date;
  expiresAt: Date | null;
  status: "active" | "expired" | "claimed";
}

interface ClaimRecord {
  pda: string;
  depositor: string;
  depositId: string;
  amount?: number;
  claimedAt: number;
}

function DepositsContent() {
  const { wallet, status, disconnect } = useWalletConnection();
  const { send, isSending } = useSendTransaction();
  const searchParams = useSearchParams();

  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [hiddenDeposits, setHiddenDeposits] = useState<string[]>([]);
  const [saveHistory, setSaveHistory] = useState(true);
  const [mainTab, setMainTab] = useState<"deposits" | "claims">("deposits");
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Read tab from URL or default to "all"
  const tabParam = searchParams.get("tab");
  const initialTab = tabParam === "active" || tabParam === "expired" || tabParam === "completed" ? tabParam : "all";
  const [activeTab, setActiveTab] = useState<"all" | "active" | "expired" | "completed">(initialTab);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Header hide/show on scroll
  const [headerVisible, setHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY < 100) {
        setHeaderVisible(true);
      } else if (currentScrollY > lastScrollY.current) {
        setHeaderVisible(false);
      } else {
        setHeaderVisible(true);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  const [success, setSuccess] = useState<string | null>(null);

  const walletAddress = wallet?.account.address;

  const fetchDeposits = useCallback(async () => {
    if (!walletAddress) return;

    setIsLoading(true);
    setError(null);

    const RPC = getRpcEndpoint();

    try {
      const response = await fetch(RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getProgramAccounts",
          params: [
            VAULT_PROGRAM_ADDRESS,
            { encoding: "base64", filters: [{ memcmp: { offset: 8, bytes: walletAddress } }] },
          ],
        }),
      });

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error.message);
      }

      const now = Date.now() / 1000;
      const allDeposits: Deposit[] = [];

      for (const account of result.result || []) {
        try {
          // Decode base64 to Uint8Array (browser-compatible)
          const base64 = account.account.data[0];
          const binaryString = atob(base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          // Validate account size (98 bytes expected)
          if (bytes.length < 98) {
            console.warn("Skipping account with invalid size:", bytes.length);
            continue;
          }

          const dataView = new DataView(bytes.buffer);

          // Layout: 8 disc + 32 depositor + 32 hash + 8 amount + 1 claimed + 1 bump + 8 created + 8 expires = 98
          const amount = dataView.getBigUint64(72, true);
          const claimed = bytes[80] === 1;
          const bump = bytes[81];
          const createdAt = Number(dataView.getBigInt64(82, true));
          const expiresAt = Number(dataView.getBigInt64(90, true));

          const hasExpiration = expiresAt > 0 && expiresAt < Number.MAX_SAFE_INTEGER / 1000;
          const isExpired = hasExpiration && expiresAt < now;

          let depositStatus: Deposit["status"] = "active";
          if (claimed) depositStatus = "claimed";
          else if (isExpired) depositStatus = "expired";

          // depositId is approximately createdAt * 1000 (frontend uses Date.now() in ms)
          // We store it for reference but the actual PDA derivation uses this value
          allDeposits.push({
            depositId: BigInt(createdAt) * 1000n,
            pda: account.pubkey,
            amount,
            claimed,
            createdAt: new Date(createdAt * 1000),
            expiresAt: hasExpiration ? new Date(expiresAt * 1000) : null,
            status: depositStatus,
          });
        } catch (e) {
          console.warn("Parse error for account:", account.pubkey, e);
        }
      }

      allDeposits.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setDeposits(allDeposits);

      // If save history is disabled, auto-hide new deposits (except expired ones)
      const saveHistorySetting = localStorage.getItem("privylink_save_history");
      if (saveHistorySetting === "false") {
        const storedHidden = JSON.parse(localStorage.getItem("privylink_hidden_deposits") || "[]");
        const newDepositsToHide = allDeposits
          .filter(d => d.status !== "expired" && !storedHidden.includes(d.pda))
          .map(d => d.pda);
        if (newDepositsToHide.length > 0) {
          const updatedHidden = [...storedHidden, ...newDepositsToHide];
          localStorage.setItem("privylink_hidden_deposits", JSON.stringify(updatedHidden));
          setHiddenDeposits(updatedHidden);
        }
      }
    } catch (err: any) {
      console.error("Fetch deposits failed:", err);
      // Don't show error for rate limiting - just show empty state
      if (!err.message?.includes("403")) {
        setError("Failed to load deposits. Try again later.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    if (status === "connected" && walletAddress) fetchDeposits();
  }, [status, walletAddress, fetchDeposits]);

  // Load labels, claims, hidden deposits and settings from localStorage
  useEffect(() => {
    const storedLabels = localStorage.getItem("privylink_labels");
    if (storedLabels) {
      setLabels(JSON.parse(storedLabels));
    }
    const storedClaims = localStorage.getItem("privylink_claims");
    if (storedClaims) {
      setClaims(JSON.parse(storedClaims));
    }
    const storedHidden = localStorage.getItem("privylink_hidden_deposits");
    if (storedHidden) {
      setHiddenDeposits(JSON.parse(storedHidden));
    }
    const storedSaveHistory = localStorage.getItem("privylink_save_history");
    setSaveHistory(storedSaveHistory !== "false");
  }, []);

  // Toggle save history
  const handleToggleSaveHistory = () => {
    const newValue = !saveHistory;
    setSaveHistory(newValue);
    localStorage.setItem("privylink_save_history", newValue ? "true" : "false");
  };

  // Clear all history (including hiding deposits - except expired ones that need refund)
  const handleClearHistory = () => {
    // Hide only deposits that are NOT expired (active or claimed can be hidden)
    // Expired deposits need to be refunded first before they can be hidden
    const hidablePdas = deposits
      .filter(d => d.status !== "expired")
      .map(d => d.pda);

    const newHidden = [...hiddenDeposits, ...hidablePdas];
    localStorage.setItem("privylink_hidden_deposits", JSON.stringify(newHidden));
    setHiddenDeposits(newHidden);

    // Clear labels and claims
    localStorage.removeItem("privylink_labels");
    localStorage.removeItem("privylink_claims");
    setLabels({});
    setClaims([]);
    setShowClearConfirm(false);
  };


  const handleRefund = useCallback(async (deposit: Deposit) => {
    if (!walletAddress || !wallet) return;

    setRefundingId(deposit.pda);
    setError(null);
    setSuccess(null);

    try {
      // Find the correct depositId by checking which value generates this PDA
      const createdAtSeconds = Math.floor(deposit.createdAt.getTime() / 1000);
      const correctDepositId = await findDepositId(walletAddress, deposit.pda, createdAtSeconds);

      if (!correctDepositId) {
        throw new Error("Could not find deposit ID. The deposit may have been created with a different wallet.");
      }

      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode("global:refund_expired"));
      const discriminator = new Uint8Array(hashBuffer).slice(0, 8);

      const depositIdBytes = new Uint8Array(8);
      new DataView(depositIdBytes.buffer).setBigUint64(0, correctDepositId, true);

      const instructionData = new Uint8Array(discriminator.length + depositIdBytes.length);
      instructionData.set(discriminator, 0);
      instructionData.set(depositIdBytes, discriminator.length);

      const instruction = {
        programAddress: VAULT_PROGRAM_ADDRESS,
        accounts: [
          { address: walletAddress as Address, role: AccountRole.WRITABLE_SIGNER },
          { address: deposit.pda as Address, role: AccountRole.WRITABLE },
          { address: "11111111111111111111111111111111" as Address, role: AccountRole.READONLY },
        ],
        data: instructionData,
      };

      await send({ instructions: [instruction] });
      setSuccess(`Refunded ${(Number(deposit.amount) / 1e9).toFixed(4)} SOL successfully!`);
      setDeposits((prev) =>
        prev.map((d) => (d.pda === deposit.pda ? { ...d, claimed: true, status: "claimed" as const } : d))
      );
    } catch (err: any) {
      let msg = err.message || "Unknown error";
      if (msg.includes("NotExpiredYet")) msg = "Deposit has not expired yet.";
      else if (msg.includes("AlreadyClaimed")) msg = "Already claimed or refunded.";
      setError(msg);
    } finally {
      setRefundingId(null);
    }
  }, [walletAddress, wallet, send]);

  // Filter out hidden deposits (but always show expired ones - they need refund)
  const visibleDeposits = deposits.filter(d =>
    d.status === "expired" || !hiddenDeposits.includes(d.pda)
  );

  const filtered = visibleDeposits.filter((d) => {
    if (activeTab === "all") return true;
    if (activeTab === "active") return d.status === "active";
    if (activeTab === "expired") return d.status === "expired";
    if (activeTab === "completed") return d.status === "claimed";
    return true;
  });

  const stats = {
    total: visibleDeposits.length,
    active: visibleDeposits.filter((d) => d.status === "active").length,
    expired: visibleDeposits.filter((d) => d.status === "expired").length,
    completed: visibleDeposits.filter((d) => d.status === "claimed").length,
    totalValue: visibleDeposits.filter((d) => d.status === "active").reduce((sum, d) => sum + Number(d.amount), 0) / 1e9,
  };


  // Not connected
  if (status !== "connected") {
    return (
      <div className="min-h-screen bg-bg-primary text-foreground">
        {/* Background Gradient Effects */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div
            className="absolute -top-[400px] left-1/2 h-[800px] w-[800px] -translate-x-1/2 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(153, 69, 255, 0.15) 0%, transparent 70%)" }}
          />
          <div
            className="absolute top-1/3 -right-[200px] h-[600px] w-[600px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(20, 241, 149, 0.08) 0%, transparent 70%)" }}
          />
        </div>

        <header className={`fixed top-0 left-0 right-0 z-50 border-b border-border-subtle bg-bg-primary/80 backdrop-blur-xl transition-transform duration-300 ${headerVisible ? 'translate-y-0' : '-translate-y-full'}`}>
          <div className="container-main flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center">
              <img src="/logo-privylink.png" alt="PrivyLink" className="h-8" />
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/" className="text-sm text-muted hover:text-foreground transition-colors">
                Home
              </Link>
              <Link href="/learn" className="text-sm text-muted hover:text-foreground transition-colors">
                Learn
              </Link>
            </div>
          </div>
        </header>

        <div className="h-16" />

        <main className="relative z-10 container-narrow py-16">
          <div className="card p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-bg-elevated">
              <svg className="h-8 w-8 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="heading-3 mb-2 text-white">Connect Your Wallet</h1>
            <p className="text-white/70 mb-6">Connect your wallet to view your deposits.</p>
            <Link href="/" className="btn-primary">Go to App</Link>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border-subtle">
          <div className="container-main py-8">
            <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
              <img src="/logo-privylink.png" alt="PrivyLink" className="h-6" />
              <p className="text-xs text-white/60">Privacy is not a luxury, it's a fundamental right.</p>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary text-foreground flex flex-col">
      {/* Background Gradient Effects */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -top-[400px] left-1/2 h-[800px] w-[800px] -translate-x-1/2 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(153, 69, 255, 0.15) 0%, transparent 70%)" }}
        />
        <div
          className="absolute top-1/3 -right-[200px] h-[600px] w-[600px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(20, 241, 149, 0.08) 0%, transparent 70%)" }}
        />
      </div>

      <header className={`fixed top-0 left-0 right-0 z-50 border-b border-border-subtle bg-bg-primary/80 backdrop-blur-xl transition-transform duration-300 ${headerVisible ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="container-main flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center">
            <img src="/logo-privylink.png" alt="PrivyLink" className="h-8" />
          </Link>

          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-muted hover:text-foreground transition-colors">
              Home
            </Link>
            <Link href="/learn" className="text-sm text-muted hover:text-foreground transition-colors">
              Learn
            </Link>
            <span className="text-sm text-sol-purple font-medium">
              My Transfers
            </span>
            <div className="hidden items-center gap-2 sm:flex">
              <span className="status-online" />
              <span className="text-xs font-medium text-sol-green">Devnet</span>
            </div>
            <code className="hidden rounded-md bg-bg-elevated px-3 py-1.5 font-mono text-xs text-muted lg:block">
              {walletAddress?.toString().slice(0, 4)}...{walletAddress?.toString().slice(-4)}
            </code>
            <button onClick={() => disconnect()} className="btn-ghost text-xs">
              Disconnect
            </button>
          </div>
        </div>
      </header>

      <div className="h-16" />

      <main className="relative z-10 container-narrow py-8 flex-1">
        {/* Back Link */}
        <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-white/70 transition hover:text-white">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to App
        </Link>

        {/* Title */}
        <div className="mb-6">
          <h1 className="heading-2 mb-2">My Transfers</h1>
          <p className="text-white/80">Track your deposits and claims.</p>
        </div>

        {/* Settings Card */}
        <div className="mb-8 card border-sol-purple/30 bg-sol-purple/5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sol-purple/20">
                <svg className="h-5 w-5 text-sol-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-white">Local History</p>
                <p className="text-xs text-white/60">Data stored only in your browser</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-white/70">Save history</span>
                <button
                  onClick={handleToggleSaveHistory}
                  className={`relative h-6 w-11 rounded-full transition-colors ${saveHistory ? 'bg-sol-green' : 'bg-white/20'}`}
                >
                  <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${saveHistory ? 'left-6' : 'left-1'}`} />
                </button>
              </label>
              <button
                onClick={() => setShowClearConfirm(true)}
                className="btn-ghost text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear all
              </button>
            </div>
          </div>
        </div>

        {/* Main Tabs: Deposits / Claims */}
        <div className="mb-6 flex rounded-lg bg-bg-elevated p-1">
          <button
            onClick={() => setMainTab("deposits")}
            className={`flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition ${
              mainTab === "deposits"
                ? "bg-sol-purple text-white"
                : "text-white/70 hover:text-white"
            }`}
          >
            My Deposits ({visibleDeposits.length})
          </button>
          <button
            onClick={() => setMainTab("claims")}
            className={`flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition ${
              mainTab === "claims"
                ? "bg-sol-purple text-white"
                : "text-white/70 hover:text-white"
            }`}
          >
            My Claims ({claims.length})
          </button>
        </div>

        {/* Deposits Tab Content */}
        {mainTab === "deposits" && (
          <>
        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
          <div className="card text-center">
            <p className="text-3xl font-bold text-white">{stats.total}</p>
            <p className="text-xs text-white/70">Total</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-sol-green">{stats.active}</p>
            <p className="text-xs text-white/70">Active</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-amber-400">{stats.expired}</p>
            <p className="text-xs text-white/70">Expired</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-sol-purple">{stats.completed}</p>
            <p className="text-xs text-white/70">Completed</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-gradient">{stats.totalValue.toFixed(2)}</p>
            <p className="text-xs text-white/70">SOL Locked</p>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-xl border border-sol-green/30 bg-sol-green/5 p-4 text-sm text-sol-green">
            {success}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {[
            { id: "all", label: "All", count: stats.total },
            { id: "active", label: "Active", count: stats.active },
            { id: "expired", label: "Expired", count: stats.expired },
            { id: "completed", label: "Completed", count: stats.completed },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "bg-sol-purple text-white"
                  : "bg-bg-elevated text-white/70 hover:text-white"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Refresh */}
        <div className="mb-4 flex justify-end">
          <button onClick={fetchDeposits} disabled={isLoading} className="btn-ghost text-xs">
            <svg className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="card p-12 text-center">
            <span className="spinner mx-auto mb-4" style={{ width: "2rem", height: "2rem" }} />
            <p className="text-white/70">Loading deposits...</p>
          </div>
        )}

        {/* Empty */}
        {!isLoading && filtered.length === 0 && (
          <div className="card p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-bg-elevated">
              <svg className="h-8 w-8 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h2 className="heading-3 mb-2 text-white">No Deposits Found</h2>
            <p className="text-white/70 mb-6">
              {activeTab === "all" ? "You haven't created any deposits yet." : `No ${activeTab} deposits.`}
            </p>
            <Link href="/" className="btn-primary">Create Deposit</Link>
          </div>
        )}

        {/* Deposits Grid */}
        {!isLoading && filtered.length > 0 && (
          <div className="space-y-4">
            {filtered.map((d) => {
              const label = labels[d.pda];
              return (
              <div key={d.pda} className="card-hover">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`badge ${
                        d.status === "active" ? "badge-green" :
                        d.status === "expired" ? "bg-amber-400/15 border-amber-400/30 text-amber-400" :
                        "bg-white/10 border-white/30 text-white/70"
                      }`}>
                        {d.status === "active" ? "Active" : d.status === "expired" ? "Expired" : "Claimed"}
                      </span>
                      <span className="text-xs text-white/60">{d.createdAt.toLocaleDateString()}</span>
                    </div>
                    {label && (
                      <p className="text-sm font-medium text-sol-purple">{label}</p>
                    )}
                    <p className="text-2xl font-bold">
                      <span className="text-white">{(Number(d.amount) / 1e9).toFixed(4)}</span>
                      <span className="ml-1 text-sm text-white/70">SOL</span>
                    </p>
                    {d.expiresAt && (
                      <p className="text-xs text-white/60">
                        {d.status === "expired" ? "Expired " : "Expires "}
                        {d.expiresAt.toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {d.status === "expired" && (
                      <button
                        onClick={() => handleRefund(d)}
                        disabled={isSending || refundingId === d.pda}
                        className="btn-primary text-sm px-4"
                      >
                        {refundingId === d.pda ? (
                          <><span className="spinner" /> Refunding...</>
                        ) : (
                          <>
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                            Refund
                          </>
                        )}
                      </button>
                    )}
                    {d.status === "active" && (
                      <span className="rounded-lg bg-sol-green/10 px-4 py-2 text-xs font-medium text-sol-green">
                        Waiting for claim
                      </span>
                    )}
                    {d.status === "claimed" && (
                      <span className="rounded-lg bg-white/10 px-4 py-2 text-xs text-white/70">
                        Completed
                      </span>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
          </>
        )}

        {/* Claims Tab Content */}
        {mainTab === "claims" && (
          <>
            {/* Stats for Claims - same grid as Deposits for consistent width */}
            <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
              <div className="card text-center">
                <p className="text-3xl font-bold text-white">{claims.length}</p>
                <p className="text-xs text-white/70">Total</p>
              </div>
              <div className="card text-center">
                <p className="text-3xl font-bold text-sol-green">{claims.length}</p>
                <p className="text-xs text-white/70">Received</p>
              </div>
              <div className="card text-center sm:col-span-3">
                <p className="text-3xl font-bold text-gradient">
                  {claims.reduce((sum, c) => sum + (c.amount || 0), 0).toFixed(2)}
                </p>
                <p className="text-xs text-white/70">SOL Received</p>
              </div>
            </div>


            {claims.length === 0 ? (
              <div className="card p-12 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-bg-elevated">
                  <svg className="h-8 w-8 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="heading-3 mb-2 text-white">No Claims Yet</h2>
                <p className="text-white/70 mb-6">
                  Claims you receive will appear here.
                </p>
                <Link href="/?tab=claim" className="btn-primary">Claim a Transfer</Link>
              </div>
            ) : (
              <div className="space-y-4">
                {claims.map((claim, index) => (
                  <div key={`${claim.pda}-${index}`} className="card-hover">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="badge badge-green">Received</span>
                          <span className="text-xs text-white/60">
                            {new Date(claim.claimedAt).toLocaleDateString()}
                          </span>
                        </div>
                        {claim.amount && claim.amount > 0 && (
                          <p className="text-2xl font-bold">
                            <span className="text-sol-green">{claim.amount.toFixed(4)}</span>
                            <span className="ml-1 text-sm text-white/70">SOL</span>
                          </p>
                        )}
                        <p className="text-sm text-white/70">
                          From <span className="font-mono">{claim.depositor.slice(0, 4)}...{claim.depositor.slice(-4)}</span>
                        </p>
                        <p className="text-xs text-white/60">
                          {new Date(claim.claimedAt).toLocaleString()}
                        </p>
                      </div>
                      <span className="rounded-lg bg-sol-green/10 px-4 py-2 text-xs font-medium text-sol-green flex items-center gap-2">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Completed
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Clear All Confirmation Modal */}
        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowClearConfirm(false)}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md rounded-2xl border border-border-subtle bg-bg-primary p-6 shadow-2xl">
              {/* Icon */}
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
                <svg className="h-8 w-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>

              {/* Title */}
              <h3 className="mb-2 text-center text-xl font-bold text-white">
                Are you sure?
              </h3>

              {/* Description */}
              <p className="mb-6 text-center text-sm text-white/70">
                This will clear your entire transfer history, including labels and claims.
                Expired deposits pending refund will remain visible.
              </p>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 rounded-lg border border-white/20 bg-transparent px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearHistory}
                  className="flex-1 rounded-lg bg-red-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-red-600"
                >
                  Yes, clear all
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border-subtle">
        <div className="container-main py-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <img src="/logo-privylink.png" alt="PrivyLink" className="h-6" />
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-2 text-sm">
                <span className="status-online" />
                <span className="text-sol-green">Devnet</span>
              </span>
              <span className="text-white/30">|</span>
              <span className="text-sm text-white/70">
                Built for <span className="text-gradient font-medium">Solana Privacy Hack 2026</span>
              </span>
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-white/60">
            Privacy is not a luxury, it's a fundamental right.
          </p>
        </div>
      </footer>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-bg-primary text-foreground flex items-center justify-center">
      <div className="text-center">
        <div className="spinner mx-auto mb-4" style={{ width: "2rem", height: "2rem" }} />
        <p className="text-white/70">Loading...</p>
      </div>
    </div>
  );
}

export default function DepositsPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <DepositsContent />
    </Suspense>
  );
}
