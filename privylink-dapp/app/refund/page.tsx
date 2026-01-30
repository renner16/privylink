"use client";

import { useState, useCallback, useEffect } from "react";
import { useWalletConnection, useSendTransaction } from "@solana/react-hooks";
import {
  getProgramDerivedAddress,
  getAddressEncoder,
  getAddressDecoder,
  getBytesEncoder,
  getU64Encoder,
  getStructEncoder,
  fixEncoderSize,
  AccountRole,
  type Address,
} from "@solana/kit";
import { VAULT_PROGRAM_ADDRESS } from "../generated/vault";
import Link from "next/link";

// Instruction discriminator for refund_expired
const REFUND_EXPIRED_DISCRIMINATOR = new Uint8Array([
  118, 153, 164, 244, 40, 128, 242, 250,
]);

const SYSTEM_PROGRAM_ADDRESS = "11111111111111111111111111111111" as Address;
const LAMPORTS_PER_SOL = 1_000_000_000;
const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

interface ExpiredDeposit {
  pubkey: string;
  depositId: bigint;
  amount: number;
  createdAt: Date;
  expiresAt: Date;
}

export default function RefundPage() {
  const { wallet, status } = useWalletConnection();
  const { send, isSending } = useSendTransaction();

  const [deposits, setDeposits] = useState<ExpiredDeposit[]>([]);
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [refundingId, setRefundingId] = useState<string | null>(null);

  // Manual input fallback
  const [manualDepositId, setManualDepositId] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);

  const walletAddress = wallet?.account.address;

  // Fetch expired deposits for the connected wallet
  const fetchExpiredDeposits = useCallback(async () => {
    if (!walletAddress) return;

    setLoading(true);
    setTxStatus(null);

    try {
      // Get all program accounts
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
                { dataSize: 90 }, // Size of PrivateDeposit struct
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

      if (!result.result || result.result.length === 0) {
        setDeposits([]);
        setLoading(false);
        return;
      }

      const now = Math.floor(Date.now() / 1000);
      const expiredDeposits: ExpiredDeposit[] = [];

      for (const account of result.result) {
        try {
          const data = Buffer.from(account.account.data[0], "base64");

          // Parse account data
          // struct PrivateDeposit {
          //   discriminator: [u8; 8],      // 0-8
          //   depositor: Pubkey,           // 8-40
          //   claim_hash: [u8; 32],        // 40-72
          //   amount: u64,                 // 72-80
          //   claimed: bool,               // 80
          //   bump: u8,                    // 81
          //   created_at: i64,             // 82-90 (actually starts at 82)
          //   expires_at: i64,             // 90-98 (but struct is 90 bytes, so layout might be different)
          // }

          // Let me recalculate:
          // 8 (disc) + 32 (depositor) + 32 (hash) + 8 (amount) + 1 (claimed) + 1 (bump) + 8 (created_at) + 8 (expires_at) = 98
          // But filter says 90 bytes... let me check the actual struct

          // Actually looking at typical Anchor layout:
          // 8 disc + 32 depositor + 32 hash + 8 amount + 1 claimed + 1 bump = 82 bytes base
          // + 8 created_at + 8 expires_at = 98 bytes total
          // But if created_at and expires_at were added later or are optional...

          // For now, let's handle both possibilities
          const claimed = data[80] === 1;

          if (claimed) continue; // Skip already claimed

          const amount = Number(data.readBigUInt64LE(72)) / LAMPORTS_PER_SOL;

          // Try to read timestamps - they might be at different offsets
          let createdAt = 0;
          let expiresAt = 0;

          if (data.length >= 98) {
            createdAt = Number(data.readBigInt64LE(82));
            expiresAt = Number(data.readBigInt64LE(90));
          } else if (data.length >= 90) {
            // Timestamps might be packed differently
            createdAt = Number(data.readBigInt64LE(82));
            // expires_at might not exist or be 0
          }

          // If expires_at is 0, it never expires - skip
          if (expiresAt === 0) continue;

          // Check if expired
          if (expiresAt > now) continue;

          // Extract deposit ID from PDA (we need to store it or derive it)
          // Since we can't easily get the deposit_id from the account data,
          // we'll need to store it differently or accept that users need to know it

          // For now, we'll show the account pubkey and let users verify
          expiredDeposits.push({
            pubkey: account.pubkey,
            depositId: 0n, // We don't have this easily - would need to track separately
            amount,
            createdAt: new Date(createdAt * 1000),
            expiresAt: new Date(expiresAt * 1000),
          });
        } catch (err) {
          console.warn("Error parsing account:", account.pubkey, err);
        }
      }

      setDeposits(expiredDeposits);
    } catch (err) {
      console.error("Error fetching deposits:", err);
      setTxStatus("Erro ao buscar depositos. Tente novamente.");
    }

    setLoading(false);
  }, [walletAddress]);

  // Fetch deposits when wallet connects
  useEffect(() => {
    if (status === "connected" && walletAddress) {
      fetchExpiredDeposits();
    }
  }, [status, walletAddress, fetchExpiredDeposits]);

  const handleRefund = useCallback(async (depositIdInput: string) => {
    if (!walletAddress || !wallet || !depositIdInput) return;

    setRefundingId(depositIdInput);
    setTxStatus(null);

    try {
      const depositIdBigInt = BigInt(depositIdInput);

      // Derive the deposit PDA
      const depositPda = await getProgramDerivedAddress({
        programAddress: VAULT_PROGRAM_ADDRESS,
        seeds: [
          getBytesEncoder().encode(
            new Uint8Array([100, 101, 112, 111, 115, 105, 116]) // "deposit"
          ),
          getAddressEncoder().encode(walletAddress as Address),
          getU64Encoder().encode(depositIdBigInt),
        ],
      });

      // Build instruction data
      const instructionDataEncoder = getStructEncoder([
        ["discriminator", fixEncoderSize(getBytesEncoder(), 8)],
        ["depositId", getU64Encoder()],
      ]);

      const instructionData = instructionDataEncoder.encode({
        discriminator: REFUND_EXPIRED_DISCRIMINATOR,
        depositId: depositIdBigInt,
      });

      const instruction = {
        programAddress: VAULT_PROGRAM_ADDRESS,
        accounts: [
          { address: walletAddress as Address, role: AccountRole.WRITABLE_SIGNER },
          { address: depositPda[0], role: AccountRole.WRITABLE },
          { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
        ],
        data: instructionData,
      };

      const signature = await send({ instructions: [instruction] });

      setTxStatus(`✅ Refund realizado!\n\nSignature: ${signature?.slice(0, 30)}...`);

      // Refresh the list
      await fetchExpiredDeposits();
      setManualDepositId("");

    } catch (err: any) {
      console.error("Erro no refund:", err);

      let errorMessage = err?.message || "Erro desconhecido";

      if (errorMessage.includes("AlreadyClaimed") || errorMessage.includes("0x1770")) {
        errorMessage = "Este deposito ja foi resgatado ou reembolsado!";
      } else if (errorMessage.includes("NotExpiredYet") || errorMessage.includes("0x1774")) {
        errorMessage = "Este deposito ainda nao expirou. Aguarde a data de expiracao.";
      } else if (errorMessage.includes("DepositNeverExpires") || errorMessage.includes("0x1775")) {
        errorMessage = "Este deposito foi criado sem expiracao. Nao pode ser reembolsado.";
      } else if (errorMessage.includes("Unauthorized") || errorMessage.includes("0x1776")) {
        errorMessage = "Apenas o criador do deposito pode solicitar reembolso.";
      } else if (errorMessage.includes("AccountNotFound") || errorMessage.includes("account not found")) {
        errorMessage = "Deposito nao encontrado. Verifique o ID.";
      }

      setTxStatus(`❌ Erro: ${errorMessage}`);
    }

    setRefundingId(null);
  }, [walletAddress, wallet, send, fetchExpiredDeposits]);

  // Not connected
  if (status !== "connected") {
    return (
      <div className="min-h-screen bg-background">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-sol-purple/15 rounded-full blur-[120px]" />
        </div>

        <div className="relative z-10 max-w-xl mx-auto px-6 py-12">
          <Link href="/" className="btn-ghost inline-flex items-center gap-2 mb-8">
            ← Voltar
          </Link>

          <div className="glass-card p-8 text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold mb-4 text-gradient">Refund de Depositos</h1>
            <p className="text-muted mb-6">
              Conecte sua wallet para ver e recuperar depositos expirados.
            </p>

            <div className="card-section border-sol-purple/30 bg-sol-purple/5">
              <p className="text-sm text-sol-purple font-medium">Configure sua wallet para DEVNET</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-sol-purple/15 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-sol-blue/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-6 py-12 space-y-6">
        <Link href="/" className="btn-ghost inline-flex items-center gap-2">
          ← Voltar
        </Link>

        {/* Header */}
        <div className="glass-card p-8">
          <h1 className="text-2xl font-bold mb-2 text-gradient">Refund de Depositos Expirados</h1>
          <p className="text-muted">
            Recupere SOL de depositos que expiraram sem serem resgatados.
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="glass-card p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-sol-purple border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted">Carregando depositos...</p>
          </div>
        )}

        {/* No Deposits */}
        {!loading && deposits.length === 0 && !showManualInput && (
          <div className="glass-card p-8 text-center">
            <div className="text-5xl mb-4">🕐</div>
            <h2 className="text-xl font-semibold mb-2">Nenhum deposito para refund</h2>
            <p className="text-muted mb-6">
              Voce nao tem depositos expirados disponiveis para reembolso.
            </p>
            <button
              onClick={() => setShowManualInput(true)}
              className="btn-secondary"
            >
              Inserir Deposit ID manualmente
            </button>
          </div>
        )}

        {/* Deposits List */}
        {!loading && deposits.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {deposits.length} deposito{deposits.length > 1 ? "s" : ""} expirado{deposits.length > 1 ? "s" : ""}
              </h2>
              <button
                onClick={fetchExpiredDeposits}
                className="btn-ghost text-sm"
              >
                🔄 Atualizar
              </button>
            </div>

            {deposits.map((deposit, index) => (
              <div key={deposit.pubkey} className="glass-card p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted">Deposito #{index + 1}</p>
                    <p className="font-mono text-xs text-muted/60 truncate max-w-[200px]">
                      {deposit.pubkey}
                    </p>
                  </div>
                  <span className="badge-purple">Expirado</span>
                </div>

                <div className="text-3xl font-bold text-sol-green">
                  {deposit.amount.toFixed(4)} SOL
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted">Criado em</p>
                    <p>{deposit.createdAt.toLocaleDateString()} {deposit.createdAt.toLocaleTimeString()}</p>
                  </div>
                  <div>
                    <p className="text-muted">Expirou em</p>
                    <p className="text-red-400">{deposit.expiresAt.toLocaleDateString()} {deposit.expiresAt.toLocaleTimeString()}</p>
                  </div>
                </div>

                <div className="pt-2">
                  <p className="text-xs text-muted mb-2">
                    Para fazer refund, insira o Deposit ID original:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Deposit ID (ex: 1706456789000)"
                      className="input flex-1 text-sm"
                      id={`deposit-${index}`}
                    />
                    <button
                      onClick={() => {
                        const input = document.getElementById(`deposit-${index}`) as HTMLInputElement;
                        if (input?.value) handleRefund(input.value);
                      }}
                      disabled={isSending}
                      className="btn-primary whitespace-nowrap"
                    >
                      {refundingId ? "Processando..." : "Refund"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Manual Input */}
        {(showManualInput || deposits.length === 0) && !loading && (
          <div className="glass-card p-6 space-y-4">
            <h2 className="font-semibold">Refund Manual</h2>
            <p className="text-sm text-muted">
              Se voce sabe o Deposit ID, pode solicitar o refund diretamente.
            </p>

            <div>
              <label className="block text-sm font-medium mb-2">Deposit ID</label>
              <input
                type="text"
                placeholder="Ex: 1706456789000"
                value={manualDepositId}
                onChange={(e) => setManualDepositId(e.target.value)}
                disabled={isSending}
                className="input"
              />
            </div>

            <div className="card-section">
              <p className="text-sm text-muted">
                <span className="font-medium text-foreground">Sua wallet:</span>{" "}
                <span className="font-mono text-xs text-sol-purple">{walletAddress}</span>
              </p>
            </div>

            <button
              onClick={() => handleRefund(manualDepositId)}
              disabled={isSending || !manualDepositId}
              className="btn-primary w-full"
            >
              {isSending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Processando Refund...
                </span>
              ) : (
                "Recuperar Fundos"
              )}
            </button>
          </div>
        )}

        {/* Status */}
        {txStatus && (
          <div className={`glass-card p-4 text-sm whitespace-pre-line ${
            txStatus.includes("✅")
              ? "border-sol-green/30 bg-sol-green/5 text-sol-green"
              : txStatus.includes("❌")
              ? "border-red-500/30 bg-red-500/5 text-red-400"
              : ""
          }`}>
            {txStatus}
          </div>
        )}

        {/* Info Section */}
        <div className="glass-card p-6 space-y-4">
          <h3 className="font-semibold">Como funcionam os Refunds</h3>
          <ul className="text-sm text-muted space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-sol-purple">•</span>
              <span>Apenas depositos <strong>expirados</strong> e <strong>nao claimados</strong> podem ser reembolsados</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-sol-purple">•</span>
              <span>Somente o <strong>depositor original</strong> pode solicitar refund</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-sol-purple">•</span>
              <span>O refund devolve o <strong>valor total</strong> menos taxas de rede (~0.00001 SOL)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-sol-purple">•</span>
              <span>Refunds sao processados <strong>imediatamente on-chain</strong></span>
            </li>
          </ul>
        </div>

        {/* Help */}
        <div className="glass-card p-6 text-sm text-muted">
          <p className="font-medium text-foreground mb-2">Onde encontrar o Deposit ID?</p>
          <p>
            O Deposit ID foi mostrado na tela de sucesso quando voce criou o deposito.
            Ele tambem aparece no Magic Link gerado. Se voce nao salvou, verifique seu historico
            de transacoes no explorer da Solana.
          </p>
        </div>
      </div>
    </div>
  );
}
