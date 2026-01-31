"use client";

import { useState, useCallback, useEffect } from "react";
import {
  useWalletConnection,
  useSendTransaction,
} from "@solana/react-hooks";
import {
  getProgramDerivedAddress,
  getAddressEncoder,
  AccountRole,
  type Address,
} from "@solana/kit";
import {
  getCreatePrivateDepositInstructionAsync,
  VAULT_PROGRAM_ADDRESS,
} from "../generated/vault";
import { QRCodeSVG } from "qrcode.react";

const LAMPORTS_PER_SOL = 1_000_000_000n;

interface MagicLinkData {
  depositor: string;
  depositId: string;
  secret?: string;
}

export function VaultCard() {
  const { wallet, status } = useWalletConnection();
  const { send, isSending } = useSendTransaction();

  // Create deposit states
  const [amount, setAmount] = useState("");
  const [secretCode, setSecretCode] = useState("");
  const [expirationHours, setExpirationHours] = useState("24");

  // Claim deposit states
  const [claimDepositor, setClaimDepositor] = useState("");
  const [claimDepositId, setClaimDepositId] = useState("");
  const [claimSecret, setClaimSecret] = useState("");

  // UI states
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [txStatusType, setTxStatusType] = useState<"success" | "error" | "info">("info");
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const [lastDepositSecret, setLastDepositSecret] = useState<string | null>(null);
  const [lastDepositId, setLastDepositId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"create" | "claim">("create");

  const walletAddress = wallet?.account.address;
  const [programDeployed, setProgramDeployed] = useState<boolean | null>(null);

  // Parse Magic Link and Tab from URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const depositor = params.get("depositor");
    const depositId = params.get("deposit_id") || params.get("id");
    const secret = params.get("secret");
    const tab = params.get("tab");

    if (depositor && depositId) {
      setClaimDepositor(depositor);
      setClaimDepositId(depositId);
      if (secret) setClaimSecret(secret);
      setActiveTab("claim");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (tab === "claim") {
      setActiveTab("claim");
      window.history.replaceState({}, "", window.location.pathname + window.location.hash);
    } else if (tab === "send") {
      setActiveTab("create");
      window.history.replaceState({}, "", window.location.pathname + window.location.hash);
    }
  }, []);

  // Check program deployment
  useEffect(() => {
    const checkProgram = async () => {
      try {
        const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
        const res = await fetch(RPC, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0", id: 1, method: "getAccountInfo",
            params: [VAULT_PROGRAM_ADDRESS, { encoding: "base58" }]
          })
        });
        const data = await res.json();
        setProgramDeployed(data.result?.value !== null);
      } catch { setProgramDeployed(null); }
    };
    checkProgram();
  }, []);

  const hashSecret = async (secret: string): Promise<Uint8Array> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(secret);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return new Uint8Array(hashBuffer);
  };

  const generateRandomSecret = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let result = "";
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setSecretCode(result);
  };

  const generateMagicLink = (depositor: string, depositId: string, includeSecret?: string): string => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const params = new URLSearchParams({ depositor, deposit_id: depositId });
    if (includeSecret) params.set("secret", includeSecret);
    return `${baseUrl}?${params.toString()}`;
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setTxStatus(`${label} copied!`);
      setTxStatusType("success");
      setTimeout(() => setTxStatus(null), 2000);
    } catch {
      setTxStatus(`Failed to copy`);
      setTxStatusType("error");
    }
  };

  const handleCreateDeposit = useCallback(async () => {
    if (!walletAddress || !amount || !secretCode || !wallet) return;

    try {
      setTxStatus("Building transaction...");
      setTxStatusType("info");
      setMagicLink(null);
      setLastDepositSecret(null);

      const depositAmount = BigInt(Math.floor(parseFloat(amount) * Number(LAMPORTS_PER_SOL)));
      const MIN_AMOUNT = 1_605_000n;

      if (depositAmount < MIN_AMOUNT) {
        setTxStatus(`Minimum amount: ${Number(MIN_AMOUNT) / 1e9} SOL`);
        setTxStatusType("error");
        return;
      }

      const depositId = BigInt(Date.now());
      const claimHash = await hashSecret(secretCode);
      const expHours = BigInt(expirationHours);

      const instruction = await getCreatePrivateDepositInstructionAsync({
        depositor: walletAddress as any,
        depositId,
        amount: depositAmount,
        claimHash: claimHash as any,
        expirationHours: expHours,
      });

      setTxStatus("Waiting for signature...");
      await send({ instructions: [instruction] });

      const link = generateMagicLink(walletAddress, depositId.toString());
      setMagicLink(link);
      setLastDepositSecret(secretCode);
      setLastDepositId(depositId.toString());

      setTxStatus(`Deposit created! Amount: ${amount} SOL`);
      setTxStatusType("success");
      setAmount("");
      setSecretCode("");
    } catch (err: any) {
      console.error("Create failed:", err);
      setTxStatus(err?.message || "Transaction failed");
      setTxStatusType("error");
    }
  }, [walletAddress, wallet, amount, secretCode, expirationHours, send]);

  const handleClaimDeposit = useCallback(async () => {
    if (!walletAddress || !claimDepositId || !claimSecret || !claimDepositor || !wallet) return;

    try {
      setTxStatus("Building claim transaction...");
      setTxStatusType("info");

      const depositId = BigInt(claimDepositId);
      const depositorAddress = claimDepositor as Address;

      const depositIdBytes = new Uint8Array(8);
      new DataView(depositIdBytes.buffer).setBigUint64(0, depositId, true);

      const addressEncoder = getAddressEncoder();
      const depositorBytes = addressEncoder.encode(depositorAddress);

      const [calculatedPda] = await getProgramDerivedAddress({
        programAddress: VAULT_PROGRAM_ADDRESS,
        seeds: [new TextEncoder().encode("deposit"), depositorBytes, depositIdBytes],
      });

      const discriminator = new Uint8Array([201, 106, 1, 224, 122, 144, 210, 155]);
      const secretBytes = new TextEncoder().encode(claimSecret);
      const secretLengthBytes = new Uint8Array(4);
      new DataView(secretLengthBytes.buffer).setUint32(0, secretBytes.length, true);

      const instructionData = new Uint8Array(
        discriminator.length + depositIdBytes.length + secretLengthBytes.length + secretBytes.length
      );
      let offset = 0;
      instructionData.set(discriminator, offset); offset += discriminator.length;
      instructionData.set(depositIdBytes, offset); offset += depositIdBytes.length;
      instructionData.set(secretLengthBytes, offset); offset += secretLengthBytes.length;
      instructionData.set(secretBytes, offset);

      const instruction = {
        programAddress: VAULT_PROGRAM_ADDRESS,
        accounts: [
          { address: walletAddress as Address, role: AccountRole.WRITABLE_SIGNER },
          { address: calculatedPda, role: AccountRole.WRITABLE },
          { address: "11111111111111111111111111111111" as Address, role: AccountRole.READONLY },
        ],
        data: instructionData,
      };

      setTxStatus("Waiting for signature...");
      await send({ instructions: [instruction] });

      setTxStatus("Claim successful! Funds transferred to your wallet.");
      setTxStatusType("success");
      setClaimDepositor("");
      setClaimDepositId("");
      setClaimSecret("");
    } catch (err: any) {
      console.error("Claim failed:", err);
      let msg = err?.message || "Unknown error";
      if (msg.includes("InvalidSecret") || msg.includes("#6001")) {
        msg = "Invalid secret code. Please check and try again.";
      } else if (msg.includes("AlreadyClaimed") || msg.includes("#6000")) {
        msg = "This deposit has already been claimed or refunded. The funds are no longer available.";
      } else if (msg.includes("DepositExpired") || msg.includes("#6003")) {
        msg = "This deposit has expired. The sender can now refund it.";
      }
      setTxStatus(msg);
      setTxStatusType("error");
    }
  }, [walletAddress, wallet, claimDepositId, claimSecret, claimDepositor, send]);

  // Not connected state
  if (status !== "connected") {
    return (
      <div className="animated-border">
        <div className="card">
          <h2 className="heading-3 mb-2">Private Transfer</h2>
          <p className="body-small mb-6">
            Connect your wallet to create deposits or claim funds.
          </p>

          <div className="rounded-lg border border-sol-purple/20 bg-sol-purple/5 p-4 mb-6">
            <p className="text-sm font-medium text-sol-purple mb-1">Configure for Devnet</p>
            <p className="text-xs text-muted">Phantom/Solflare: Settings → Network → Devnet</p>
          </div>

          <div className="flex flex-col items-center justify-center rounded-xl border border-border-subtle bg-bg-elevated p-8">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-bg-secondary">
              <svg className="h-6 w-6 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-sm text-muted">Wallet not connected</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animated-border">
      <div className="card">
        <h2 className="heading-3 mb-2">Private Transfer</h2>
        <p className="body-small mb-6">Send SOL privately using secret codes.</p>

        {/* Tabs */}
        <div className="mb-6 flex rounded-lg bg-bg-elevated p-1">
          <button
            onClick={() => {
              setActiveTab("create");
              setMagicLink(null);
              setLastDepositSecret(null);
              setLastDepositId(null);
              setTxStatus(null);
            }}
            className={`flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition ${
              activeTab === "create"
                ? "bg-sol-purple text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            Send
          </button>
          <button
            onClick={() => {
              setActiveTab("claim");
              setTxStatus(null);
            }}
            className={`flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition ${
              activeTab === "claim"
                ? "bg-sol-purple text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            Claim
          </button>
        </div>

        {/* Create Tab */}
        {activeTab === "create" && (
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-medium text-muted">Amount (SOL)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isSending}
                className="input"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-muted">Secret Code</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Create a memorable secret"
                  value={secretCode}
                  onChange={(e) => setSecretCode(e.target.value)}
                  disabled={isSending}
                  className="input flex-1"
                />
                <button
                  type="button"
                  onClick={generateRandomSecret}
                  disabled={isSending}
                  className="btn-secondary px-3 shrink-0"
                  title="Generate random secret"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-muted">Expiration</label>
              <select
                value={expirationHours}
                onChange={(e) => setExpirationHours(e.target.value)}
                disabled={isSending}
                className="select"
              >
                <option value="1">1 hour</option>
                <option value="6">6 hours</option>
                <option value="24">24 hours</option>
                <option value="72">3 days</option>
                <option value="168">7 days</option>
                <option value="720">30 days</option>
              </select>
            </div>

            <button
              onClick={handleCreateDeposit}
              disabled={isSending || !amount || !secretCode || parseFloat(amount) <= 0}
              className="btn-primary w-full py-3"
            >
              {isSending ? <><span className="spinner" /> Creating...</> : "Create Deposit"}
            </button>

            {/* Success State with QR Code */}
            {magicLink && lastDepositSecret && lastDepositId && walletAddress && (
              <div className="mt-6 space-y-4 animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-center gap-2 text-sol-green">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-semibold">Deposit Created!</span>
                </div>

                {/* QR Code */}
                <div className="flex justify-center">
                  <div className="qr-container">
                    <QRCodeSVG value={`${magicLink}&secret=${encodeURIComponent(lastDepositSecret)}`} size={140} level="H" bgColor="#ffffff" fgColor="#000000" />
                  </div>
                </div>
                <p className="text-center text-xs text-muted">Scan to claim (includes secret)</p>

                {/* Card 1: Complete Link */}
                <div className="rounded-xl border border-sol-purple/30 bg-sol-purple/5 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-sol-purple">Complete Magic Link</p>
                    <button
                      onClick={() => copyToClipboard(`${magicLink}&secret=${encodeURIComponent(lastDepositSecret)}`, "Complete link")}
                      className="text-xs text-sol-purple hover:text-sol-purple/80 flex items-center gap-1"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </button>
                  </div>
                  <p className="break-all font-mono text-[11px] text-subtle">{`${magicLink}&secret=${encodeURIComponent(lastDepositSecret)}`}</p>
                  <p className="mt-2 text-[10px] text-amber-400">Warning: includes secret. Share via secure channels only.</p>
                </div>

                {/* Card 2: Separate Info */}
                <div className="rounded-xl border border-border-subtle bg-bg-elevated p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted">Deposit Details</p>
                    <button
                      onClick={() => copyToClipboard(`Depositor: ${walletAddress}\nDeposit ID: ${lastDepositId}\nSecret Code: ${lastDepositSecret}`, "All details")}
                      className="text-xs text-sol-green hover:text-sol-green/80 flex items-center gap-1"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy All
                    </button>
                  </div>

                  {/* Depositor Address */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-wider text-subtle mb-1">Depositor Address</p>
                      <p className="break-all font-mono text-xs text-foreground">{walletAddress}</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(walletAddress, "Depositor")}
                      className="shrink-0 p-1.5 rounded hover:bg-bg-secondary text-muted hover:text-foreground"
                      title="Copy"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>

                  {/* Deposit ID */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-wider text-subtle mb-1">Deposit ID</p>
                      <p className="font-mono text-xs text-foreground">{lastDepositId}</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(lastDepositId, "Deposit ID")}
                      className="shrink-0 p-1.5 rounded hover:bg-bg-secondary text-muted hover:text-foreground"
                      title="Copy"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>

                  {/* Secret Code */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-wider text-subtle mb-1">Secret Code</p>
                      <p className="font-mono text-xs text-sol-green">{lastDepositSecret}</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(lastDepositSecret, "Secret")}
                      className="shrink-0 p-1.5 rounded hover:bg-bg-secondary text-muted hover:text-foreground"
                      title="Copy"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Claim Tab */}
        {activeTab === "claim" && (
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-medium text-muted">Depositor Address</label>
              <input
                type="text"
                placeholder="Wallet address of the sender"
                value={claimDepositor}
                onChange={(e) => setClaimDepositor(e.target.value)}
                disabled={isSending}
                className="input font-mono text-xs"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-muted">Deposit ID</label>
              <input
                type="text"
                placeholder="Deposit identifier"
                value={claimDepositId}
                onChange={(e) => setClaimDepositId(e.target.value)}
                disabled={isSending}
                className="input"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-muted">Secret Code</label>
              <input
                type="text"
                placeholder="Enter the secret code"
                value={claimSecret}
                onChange={(e) => setClaimSecret(e.target.value)}
                disabled={isSending}
                className="input"
              />
            </div>

            <button
              onClick={handleClaimDeposit}
              disabled={isSending || !claimDepositId || !claimSecret || !claimDepositor}
              className="btn-primary w-full py-3"
            >
              {isSending ? <><span className="spinner" /> Claiming...</> : "Claim Funds"}
            </button>
          </div>
        )}

        {/* Status Message */}
        {txStatus && (
          <div className={`mt-4 rounded-xl border p-4 text-sm ${
            txStatusType === "success"
              ? "border-sol-green/30 bg-sol-green/5 text-sol-green"
              : txStatusType === "error"
                ? "border-red-500/30 bg-red-500/5 text-red-400"
                : "border-border-subtle bg-bg-elevated text-muted"
          }`}>
            {txStatus}
          </div>
        )}

        {/* Program Status */}
        {programDeployed === false && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
            <p className="text-sm font-medium text-red-400">Program Not Deployed</p>
            <p className="mt-1 text-xs text-red-400/70">
              Run: <code className="rounded bg-red-500/10 px-1.5 py-0.5">anchor deploy --provider.cluster devnet</code>
            </p>
          </div>
        )}

        {/* Network Info */}
        <div className="mt-6 flex items-center justify-between rounded-lg border border-border-subtle bg-bg-elevated px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="status-pending" />
            <span className="text-xs font-medium">Devnet</span>
          </div>
          <code className="font-mono text-[10px] text-subtle">
            {VAULT_PROGRAM_ADDRESS.slice(0, 8)}...{VAULT_PROGRAM_ADDRESS.slice(-8)}
          </code>
        </div>
      </div>
    </div>
  );
}
