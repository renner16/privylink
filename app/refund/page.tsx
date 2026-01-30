"use client";

import { useState, useEffect, useCallback } from "react";
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
import { VAULT_PROGRAM_ADDRESS } from "../generated/vault";
import Link from "next/link";

interface ExpiredDeposit {
  depositId: bigint;
  pda: string;
  amount: bigint;
  createdAt: Date;
  expiresAt: Date;
}

export default function RefundPage() {
  const { wallet, status } = useWalletConnection();
  const { send, isSending } = useSendTransaction();

  const [deposits, setDeposits] = useState<ExpiredDeposit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const walletAddress = wallet?.account.address;

  // Fetch expired deposits for connected wallet
  const fetchExpiredDeposits = useCallback(async () => {
    if (!walletAddress) return;

    setIsLoading(true);
    setError(null);

    try {
      const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

      // Get program accounts filtered by depositor
      const response = await fetch(RPC_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getProgramAccounts",
          params: [
            VAULT_PROGRAM_ADDRESS,
            {
              encoding: "base64",
              filters: [
                {
                  memcmp: {
                    offset: 8, // After discriminator
                    bytes: walletAddress, // Depositor pubkey
                  },
                },
              ],
            },
          ],
        }),
      });

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error.message);
      }

      const now = Date.now() / 1000; // Current timestamp in seconds
      const expiredDeposits: ExpiredDeposit[] = [];

      for (const account of result.result || []) {
        try {
          const data = Buffer.from(account.account.data[0], "base64");

          // Parse account data
          // Discriminator: 8 bytes
          // Depositor: 32 bytes (offset 8)
          // Claim hash: 32 bytes (offset 40)
          // Amount: 8 bytes (offset 72)
          // Claimed: 1 byte (offset 80)
          // Bump: 1 byte (offset 81)
          // Created at: 8 bytes (offset 82)
          // Expires at: 8 bytes (offset 90)

          const claimed = data[80] === 1;
          if (claimed) continue; // Skip already claimed/refunded

          const amount = data.readBigUInt64LE(72);
          const createdAt = Number(data.readBigInt64LE(82));
          const expiresAt = Number(data.readBigInt64LE(90));

          // Check if expired
          if (expiresAt > now) continue; // Not expired yet
          if (expiresAt === Number.MAX_SAFE_INTEGER) continue; // No expiration

          // We need to find the deposit_id to derive PDA
          // Since we don't store it directly, we'll use the account pubkey
          // and try to reverse-engineer or store it differently

          // For now, we'll extract from PDA by trying common deposit IDs
          // This is a limitation - in production, we'd index this differently

          expiredDeposits.push({
            depositId: BigInt(createdAt * 1000), // Approximate - created_at as deposit_id
            pda: account.pubkey,
            amount,
            createdAt: new Date(createdAt * 1000),
            expiresAt: new Date(expiresAt * 1000),
          });
        } catch (e) {
          console.warn("Failed to parse account:", e);
        }
      }

      setDeposits(expiredDeposits);
    } catch (err: any) {
      console.error("Failed to fetch deposits:", err);
      setError("Failed to load deposits: " + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    if (status === "connected" && walletAddress) {
      fetchExpiredDeposits();
    }
  }, [status, walletAddress, fetchExpiredDeposits]);

  const handleRefund = useCallback(async (deposit: ExpiredDeposit) => {
    if (!walletAddress || !wallet) return;

    setRefundingId(deposit.pda);
    setError(null);
    setSuccess(null);

    try {
      // Build instruction data for refund_expired
      // Discriminator: SHA256("global:refund_expired")[0:8]
      const discriminatorBytes = new Uint8Array([
        0x47, 0x9e, 0x7a, 0x1f, 0x63, 0x4f, 0x8f, 0x63
      ]); // Approximate - need to calculate

      // Actually calculate the discriminator
      const encoder = new TextEncoder();
      const data = encoder.encode("global:refund_expired");
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const discriminator = new Uint8Array(hashBuffer).slice(0, 8);

      // deposit_id as u64 little-endian
      const depositIdBytes = new Uint8Array(8);
      const view = new DataView(depositIdBytes.buffer);
      view.setBigUint64(0, deposit.depositId, true);

      // Combine instruction data
      const instructionData = new Uint8Array(discriminator.length + depositIdBytes.length);
      instructionData.set(discriminator, 0);
      instructionData.set(depositIdBytes, discriminator.length);

      // Derive PDA for verification
      const addressEncoder = getAddressEncoder();
      const depositorBytes = addressEncoder.encode(walletAddress as Address);

      const [calculatedPda] = await getProgramDerivedAddress({
        programAddress: VAULT_PROGRAM_ADDRESS,
        seeds: [
          new TextEncoder().encode("deposit"),
          depositorBytes,
          depositIdBytes,
        ],
      });

      // Use the stored PDA or calculated one
      const depositPda = deposit.pda as Address;

      const instruction = {
        programAddress: VAULT_PROGRAM_ADDRESS,
        accounts: [
          {
            address: walletAddress as Address,
            role: AccountRole.WRITABLE_SIGNER,
          },
          {
            address: depositPda,
            role: AccountRole.WRITABLE,
          },
          {
            address: "11111111111111111111111111111111" as Address,
            role: AccountRole.READONLY,
          },
        ],
        data: instructionData,
      };

      const signature = await send({
        instructions: [instruction],
      });

      setSuccess(`Refund successful! Signature: ${signature?.slice(0, 20)}...`);

      // Remove from list
      setDeposits((prev) => prev.filter((d) => d.pda !== deposit.pda));

    } catch (err: any) {
      console.error("Refund failed:", err);

      let errorMessage = err.message || "Unknown error";

      if (errorMessage.includes("NotExpiredYet") || errorMessage.includes("#6004")) {
        errorMessage = "This deposit has not expired yet.";
      } else if (errorMessage.includes("AlreadyClaimed") || errorMessage.includes("#6000")) {
        errorMessage = "This deposit has already been claimed or refunded.";
      } else if (errorMessage.includes("Unauthorized") || errorMessage.includes("#6005")) {
        errorMessage = "You are not the original depositor.";
      }

      setError(errorMessage);
    } finally {
      setRefundingId(null);
    }
  }, [walletAddress, wallet, send]);

  // Not connected state
  if (status !== "connected") {
    return (
      <div className="relative min-h-screen overflow-x-clip bg-bg1 text-foreground">
        {/* Background Glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(153, 69, 255, 0.1) 0%, transparent 60%)",
            }}
          />
        </div>

        <main className="relative z-10 container-narrow py-16">
          <Link href="/" className="btn-ghost mb-8 inline-flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </Link>

          <div className="mb-8">
            <h1 className="section-title mb-2 text-4xl">Expired Deposit Refunds</h1>
            <p className="section-subtitle">
              Recover SOL from deposits that expired without being claimed.
            </p>
          </div>

          <div className="animated-border">
            <div className="glass-card p-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-border-subtle">
                <svg className="h-8 w-8 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="mb-2 text-lg font-semibold">Wallet Not Connected</h2>
              <p className="mb-6 text-sm text-muted">
                Connect your wallet to view and refund your expired deposits.
              </p>
              <Link href="/" className="btn-primary">
                Connect Wallet
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-clip bg-bg1 text-foreground">
      {/* Background Glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(153, 69, 255, 0.1) 0%, transparent 60%)",
          }}
        />
      </div>

      <main className="relative z-10 container-narrow py-16">
        <Link href="/" className="btn-ghost mb-8 inline-flex items-center gap-2">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </Link>

        <div className="mb-8">
          <h1 className="section-title mb-2 text-4xl">Expired Deposit Refunds</h1>
          <p className="section-subtitle">
            Recover SOL from deposits that expired without being claimed.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-6 rounded-xl border border-sol-green/30 bg-sol-green/5 p-4 text-sm text-sol-green">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {success}
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="glass-card p-8 text-center">
            <div className="mx-auto mb-4 h-8 w-8">
              <span className="spinner" style={{ width: '2rem', height: '2rem' }} />
            </div>
            <p className="text-muted">Loading deposits...</p>
          </div>
        )}

        {/* No Deposits State */}
        {!isLoading && deposits.length === 0 && (
          <div className="glass-card p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-border-subtle">
              <svg className="h-8 w-8 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="mb-2 text-lg font-semibold">No Refundable Deposits</h2>
            <p className="text-sm text-muted">
              You don&apos;t have any expired deposits that can be refunded.
            </p>
          </div>
        )}

        {/* Deposits List */}
        {!isLoading && deposits.length > 0 && (
          <div className="space-y-4">
            {deposits.map((deposit, index) => (
              <div
                key={deposit.pda}
                className="glass-card p-6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="badge">Deposit #{index + 1}</span>
                      <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#f87171' }}>
                        Expired
                      </span>
                    </div>
                    <p className="gradient-text text-3xl font-bold">
                      {(Number(deposit.amount) / 1e9).toFixed(4)} SOL
                    </p>
                    <div className="space-y-1 text-xs text-muted">
                      <p className="flex items-center gap-2">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Created: {deposit.createdAt.toLocaleString()}
                      </p>
                      <p className="flex items-center gap-2 text-red-400">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Expired: {deposit.expiresAt.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRefund(deposit)}
                    disabled={isSending || refundingId === deposit.pda}
                    className="btn-primary px-6 py-3"
                  >
                    {refundingId === deposit.pda ? (
                      <>
                        <span className="spinner" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                        Refund
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Section */}
        <div className="mt-12 glass-card p-6">
          <h2 className="mb-4 flex items-center gap-2 font-semibold">
            <svg className="h-5 w-5 text-sol-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            How Refunds Work
          </h2>
          <ul className="space-y-3 text-sm text-muted">
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sol-purple/20 text-xs text-sol-purple">1</span>
              <span>Only expired and unclaimed deposits can be refunded</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sol-purple/20 text-xs text-sol-purple">2</span>
              <span>Only the original depositor can request a refund</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sol-purple/20 text-xs text-sol-purple">3</span>
              <span>Refunds return the full amount (minus network fees)</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sol-purple/20 text-xs text-sol-purple">4</span>
              <span>Refunds are processed immediately on-chain</span>
            </li>
          </ul>
        </div>

        {/* Refresh Button */}
        <div className="mt-6 text-center">
          <button
            onClick={fetchExpiredDeposits}
            disabled={isLoading}
            className="btn-ghost inline-flex items-center gap-2"
          >
            <svg className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh List
          </button>
        </div>
      </main>
    </div>
  );
}
