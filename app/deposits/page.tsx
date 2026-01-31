"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useWalletConnection, useSendTransaction } from "@solana/react-hooks";
import { AccountRole, type Address, getProgramDerivedAddress, getAddressEncoder } from "@solana/kit";
import { VAULT_PROGRAM_ADDRESS } from "../generated/vault";
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

function DepositsContent() {
  const { wallet, status } = useWalletConnection();
  const { send, isSending } = useSendTransaction();
  const searchParams = useSearchParams();

  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Read tab from URL or default to "all"
  const tabParam = searchParams.get("tab");
  const initialTab = tabParam === "active" || tabParam === "expired" ? tabParam : "all";
  const [activeTab, setActiveTab] = useState<"all" | "active" | "expired">(initialTab);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const walletAddress = wallet?.account.address;

  const fetchDeposits = useCallback(async () => {
    if (!walletAddress) return;

    setIsLoading(true);
    setError(null);

    const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

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

  const filtered = deposits.filter((d) => {
    if (activeTab === "all") return true;
    if (activeTab === "active") return d.status === "active";
    if (activeTab === "expired") return d.status === "expired";
    return true;
  });

  const stats = {
    total: deposits.length,
    active: deposits.filter((d) => d.status === "active").length,
    expired: deposits.filter((d) => d.status === "expired").length,
    totalValue: deposits.filter((d) => d.status === "active").reduce((sum, d) => sum + Number(d.amount), 0) / 1e9,
  };

  // Not connected
  if (status !== "connected") {
    return (
      <div className="min-h-screen bg-bg-primary text-foreground">
        <div className="pointer-events-none fixed inset-0">
          <div className="absolute -top-[300px] left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full" style={{ background: "radial-gradient(circle, rgba(153, 69, 255, 0.1) 0%, transparent 70%)" }} />
        </div>

        <header className="sticky top-0 z-50 border-b border-border-subtle bg-bg-primary/80 backdrop-blur-xl">
          <div className="container-main flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sol-purple">
                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <span className="text-lg font-semibold">PrivyLink</span>
            </Link>
          </div>
        </header>

        <main className="relative z-10 container-narrow py-16">
          <div className="card p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-bg-elevated">
              <svg className="h-8 w-8 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="heading-3 mb-2">Connect Your Wallet</h1>
            <p className="body-small mb-6">Connect your wallet to view your deposits.</p>
            <Link href="/" className="btn-primary">Go to App</Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary text-foreground">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-[300px] left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full" style={{ background: "radial-gradient(circle, rgba(153, 69, 255, 0.1) 0%, transparent 70%)" }} />
      </div>

      <header className="sticky top-0 z-50 border-b border-border-subtle bg-bg-primary/80 backdrop-blur-xl">
        <div className="container-main flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sol-purple">
              <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <span className="text-lg font-semibold">PrivyLink</span>
          </Link>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="status-online" />
              <span className="text-xs font-medium text-sol-green">Devnet</span>
            </div>
            <code className="hidden rounded-md bg-bg-elevated px-3 py-1.5 font-mono text-xs text-muted md:block">
              {walletAddress?.toString().slice(0, 4)}...{walletAddress?.toString().slice(-4)}
            </code>
          </div>
        </div>
      </header>

      <main className="relative z-10 container-narrow py-8">
        {/* Back Link */}
        <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted transition hover:text-foreground">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to App
        </Link>

        {/* Title */}
        <div className="mb-8">
          <h1 className="heading-2 mb-2">My Deposits</h1>
          <p className="body-small">Track and manage your private transfers.</p>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="card text-center">
            <p className="text-3xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted">Total</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-sol-green">{stats.active}</p>
            <p className="text-xs text-muted">Active</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-amber-400">{stats.expired}</p>
            <p className="text-xs text-muted">Expired</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-gradient">{stats.totalValue.toFixed(2)}</p>
            <p className="text-xs text-muted">SOL Locked</p>
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
        <div className="mb-6 flex gap-2">
          {[
            { id: "all", label: "All", count: stats.total },
            { id: "active", label: "Active", count: stats.active },
            { id: "expired", label: "Expired", count: stats.expired },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "bg-sol-purple text-white"
                  : "bg-bg-elevated text-muted hover:text-foreground"
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
            <p className="text-muted">Loading deposits...</p>
          </div>
        )}

        {/* Empty */}
        {!isLoading && filtered.length === 0 && (
          <div className="card p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-bg-elevated">
              <svg className="h-8 w-8 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h2 className="heading-3 mb-2">No Deposits Found</h2>
            <p className="body-small mb-6">
              {activeTab === "all" ? "You haven't created any deposits yet." : `No ${activeTab} deposits.`}
            </p>
            <Link href="/" className="btn-primary">Create Deposit</Link>
          </div>
        )}

        {/* Deposits Grid */}
        {!isLoading && filtered.length > 0 && (
          <div className="space-y-4">
            {filtered.map((d) => (
              <div key={d.pda} className="card-hover">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`badge ${
                        d.status === "active" ? "badge-green" :
                        d.status === "expired" ? "bg-amber-400/15 border-amber-400/30 text-amber-400" :
                        "bg-muted/10 border-muted/30 text-muted"
                      }`}>
                        {d.status === "active" ? "Active" : d.status === "expired" ? "Expired" : "Claimed"}
                      </span>
                      <span className="text-xs text-subtle">{d.createdAt.toLocaleDateString()}</span>
                    </div>
                    <p className="text-2xl font-bold">
                      <span className="text-gradient">{(Number(d.amount) / 1e9).toFixed(4)}</span>
                      <span className="ml-1 text-sm text-muted">SOL</span>
                    </p>
                    {d.expiresAt && (
                      <p className="text-xs text-muted">
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
                      <span className="rounded-lg bg-muted/10 px-4 py-2 text-xs text-muted">
                        Completed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-bg-primary text-foreground flex items-center justify-center">
      <div className="text-center">
        <div className="spinner mx-auto mb-4" style={{ width: "2rem", height: "2rem" }} />
        <p className="text-muted">Loading...</p>
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
