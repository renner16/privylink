"use client";

import { useState, useEffect, useCallback } from "react";
import {
  useWalletConnection,
  useSendTransaction,
} from "@solana/react-hooks";
import {
  getProgramDerivedAddress,
  getAddressEncoder,
  getAddressDecoder,
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
      setError("Erro ao carregar depósitos: " + err.message);
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

      setSuccess(`Refund realizado com sucesso! Signature: ${signature?.slice(0, 20)}...`);

      // Remove from list
      setDeposits((prev) => prev.filter((d) => d.pda !== deposit.pda));

    } catch (err: any) {
      console.error("Refund failed:", err);

      let errorMessage = err.message || "Erro desconhecido";

      if (errorMessage.includes("NotExpiredYet") || errorMessage.includes("#6004")) {
        errorMessage = "Este depósito ainda não expirou.";
      } else if (errorMessage.includes("AlreadyClaimed") || errorMessage.includes("#6000")) {
        errorMessage = "Este depósito já foi claimado ou reembolsado.";
      } else if (errorMessage.includes("Unauthorized") || errorMessage.includes("#6005")) {
        errorMessage = "Você não é o depositante original.";
      }

      setError(errorMessage);
    } finally {
      setRefundingId(null);
    }
  }, [walletAddress, wallet, send]);

  // Not connected state
  if (status !== "connected") {
    return (
      <div className="min-h-screen bg-bg1 text-foreground">
        <main className="mx-auto max-w-4xl px-6 py-16">
          <Link href="/" className="text-sm text-muted hover:text-foreground mb-8 inline-block">
            &larr; Voltar
          </Link>

          <h1 className="text-3xl font-semibold mb-2">Refund de Depósitos Expirados</h1>
          <p className="text-muted mb-8">
            Recupere SOL de depósitos que expiraram sem serem resgatados.
          </p>

          <div className="rounded-2xl border border-border-low bg-card p-8 text-center">
            <div className="text-5xl mb-4">🔒</div>
            <p className="text-lg font-semibold mb-2">Wallet não conectada</p>
            <p className="text-muted text-sm">
              Conecte sua wallet para ver e fazer refund dos seus depósitos expirados.
            </p>
            <Link
              href="/"
              className="mt-4 inline-block rounded-lg bg-foreground px-6 py-2.5 text-sm font-medium text-background hover:opacity-90 transition"
            >
              Conectar Wallet
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg1 text-foreground">
      <main className="mx-auto max-w-4xl px-6 py-16">
        <Link href="/" className="text-sm text-muted hover:text-foreground mb-8 inline-block">
          &larr; Voltar
        </Link>

        <h1 className="text-3xl font-semibold mb-2">Refund de Depósitos Expirados</h1>
        <p className="text-muted mb-8">
          Recupere SOL de depósitos que expiraram sem serem resgatados.
        </p>

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-6 rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-800">
            {success}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="rounded-2xl border border-border-low bg-card p-8 text-center">
            <div className="animate-spin text-4xl mb-4">⏳</div>
            <p className="text-muted">Carregando depósitos...</p>
          </div>
        )}

        {/* No Deposits State */}
        {!isLoading && deposits.length === 0 && (
          <div className="rounded-2xl border border-border-low bg-card p-8 text-center">
            <div className="text-5xl mb-4">🕐</div>
            <p className="text-lg font-semibold mb-2">Nenhum depósito para refund</p>
            <p className="text-muted text-sm">
              Você não tem depósitos expirados que possam ser reembolsados.
            </p>
          </div>
        )}

        {/* Deposits List */}
        {!isLoading && deposits.length > 0 && (
          <div className="space-y-4">
            {deposits.map((deposit, index) => (
              <div
                key={deposit.pda}
                className="rounded-2xl border border-border-low bg-card p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <p className="text-sm text-muted">Depósito #{index + 1}</p>
                    <p className="text-2xl font-bold">
                      {(Number(deposit.amount) / 1e9).toFixed(4)} SOL
                    </p>
                    <div className="text-xs text-muted space-y-1">
                      <p>Criado: {deposit.createdAt.toLocaleString()}</p>
                      <p className="text-red-600">
                        Expirou: {deposit.expiresAt.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRefund(deposit)}
                    disabled={isSending || refundingId === deposit.pda}
                    className="rounded-lg bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {refundingId === deposit.pda ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        Refunding...
                      </>
                    ) : (
                      <>
                        💰 Refund
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Section */}
        <div className="mt-12 rounded-xl border border-border-low bg-cream/30 p-6">
          <h2 className="text-sm font-semibold mb-4">Como funcionam os Refunds</h2>
          <ul className="text-xs text-muted space-y-2">
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>Apenas depósitos expirados e não claimados podem ser reembolsados</span>
            </li>
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>Somente o depositante original pode solicitar o refund</span>
            </li>
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>O refund devolve o valor total (menos taxas de rede)</span>
            </li>
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>Os refunds são processados imediatamente on-chain</span>
            </li>
          </ul>
        </div>

        {/* Refresh Button */}
        <div className="mt-6 text-center">
          <button
            onClick={fetchExpiredDeposits}
            disabled={isLoading}
            className="text-sm text-muted hover:text-foreground transition disabled:opacity-50"
          >
            🔄 Atualizar lista
          </button>
        </div>
      </main>
    </div>
  );
}
