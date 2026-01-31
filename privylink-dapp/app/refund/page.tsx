"use client";

import { useState, useCallback, useEffect } from "react";
import { useWalletConnection, useSendTransaction } from "@solana/react-hooks";
import {
  getProgramDerivedAddress,
  getAddressEncoder,
  getBytesEncoder,
  getU64Encoder,
  getStructEncoder,
  fixEncoderSize,
  AccountRole,
  type Address,
} from "@solana/kit";
import { VAULT_PROGRAM_ADDRESS } from "../generated/vault";
import Link from "next/link";

const REFUND_EXPIRED_DISCRIMINATOR = new Uint8Array([
  118, 153, 164, 244, 40, 128, 242, 250,
]);
const SYSTEM_PROGRAM_ADDRESS = "11111111111111111111111111111111" as Address;
const DEPOSIT_SEED = new Uint8Array([100, 101, 112, 111, 115, 105, 116]);

interface StoredDeposit {
  depositId: string;
  depositor: string;
  amount: number;
  expiresAt: number;
  createdAt: number;
  secret?: string;
}

// Gera magic link
function encodeMagicLink(depositId: string, depositor: string, secret: string): string {
  const data = `${depositId}:${depositor}:${secret}`;
  return btoa(data).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Tempo restante formatado
function timeRemaining(expiresAt: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = expiresAt - now;

  if (diff <= 0) return "Expirado";

  const hours = Math.floor(diff / 3600);
  const mins = Math.floor((diff % 3600) / 60);

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

// Porcentagem de tempo restante para barra de progresso
function timeProgress(createdAt: number, expiresAt: number): number {
  if (expiresAt === 0) return 100;
  const now = Math.floor(Date.now() / 1000);
  const total = expiresAt - createdAt;
  const elapsed = now - createdAt;
  const remaining = Math.max(0, 100 - (elapsed / total) * 100);
  return remaining;
}

export default function RefundPage() {
  const { wallet, status, connectors, connect } = useWalletConnection();
  const { send, isSending } = useSendTransaction();

  const [expiredDeposits, setExpiredDeposits] = useState<StoredDeposit[]>([]);
  const [activeDeposits, setActiveDeposits] = useState<StoredDeposit[]>([]);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [manualId, setManualId] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const walletAddress = wallet?.account.address;

  // Carregar depósitos do localStorage
  const loadDeposits = useCallback(() => {
    if (typeof window === "undefined" || !walletAddress) return;

    const stored: StoredDeposit[] = JSON.parse(
      localStorage.getItem("privylink_deposits") || "[]"
    );

    const now = Math.floor(Date.now() / 1000);
    const myDeposits = stored.filter((d) => d.depositor === walletAddress);

    // Separar expirados e ativos
    const expired = myDeposits.filter((d) => d.expiresAt > 0 && d.expiresAt < now);
    const active = myDeposits.filter((d) => d.expiresAt === 0 || d.expiresAt >= now);

    setExpiredDeposits(expired);
    setActiveDeposits(active);
  }, [walletAddress]);

  useEffect(() => {
    loadDeposits();
    // Atualizar a cada 30 segundos
    const interval = setInterval(loadDeposits, 30000);
    return () => clearInterval(interval);
  }, [loadDeposits]);

  const handleRefund = useCallback(async (depositId: string) => {
    if (!walletAddress || !wallet) return;

    setRefundingId(depositId);
    setTxStatus(null);

    try {
      const depositIdBigInt = BigInt(depositId);

      const depositPda = await getProgramDerivedAddress({
        programAddress: VAULT_PROGRAM_ADDRESS,
        seeds: [
          getBytesEncoder().encode(DEPOSIT_SEED),
          getAddressEncoder().encode(walletAddress as Address),
          getU64Encoder().encode(depositIdBigInt),
        ],
      });

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

      // Remover do localStorage
      const stored: StoredDeposit[] = JSON.parse(
        localStorage.getItem("privylink_deposits") || "[]"
      );
      const updated = stored.filter((d) => d.depositId !== depositId);
      localStorage.setItem("privylink_deposits", JSON.stringify(updated));

      loadDeposits();
      setTxStatus(`✅ Refund realizado!\nSignature: ${signature?.slice(0, 30)}...`);

    } catch (err: any) {
      console.error("Erro no refund:", err);
      let msg = err?.message || "Erro desconhecido";

      if (msg.includes("AlreadyClaimed") || msg.includes("0x1770")) {
        msg = "Já foi resgatado/reembolsado!";
        // Remover do localStorage
        const stored: StoredDeposit[] = JSON.parse(
          localStorage.getItem("privylink_deposits") || "[]"
        );
        localStorage.setItem(
          "privylink_deposits",
          JSON.stringify(stored.filter((d) => d.depositId !== depositId))
        );
        loadDeposits();
      } else if (msg.includes("NotExpiredYet") || msg.includes("0x1774")) {
        msg = "Ainda não expirou!";
      } else if (msg.includes("AccountNotFound")) {
        msg = "Depósito não encontrado.";
      }

      setTxStatus(`❌ ${msg}`);
    }

    setRefundingId(null);
  }, [walletAddress, wallet, send, loadDeposits]);

  const copyMagicLink = (deposit: StoredDeposit) => {
    if (!deposit.secret) {
      setTxStatus("❌ Secret não salvo. Use o magic link original.");
      return;
    }
    const code = encodeMagicLink(deposit.depositId, deposit.depositor, deposit.secret);
    const link = `${window.location.origin}/claim/${code}`;
    navigator.clipboard.writeText(link);
    setCopiedId(deposit.depositId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Não conectado
  if (status !== "connected") {
    return (
      <div className="min-h-screen bg-bg-primary relative">
        {/* Background Effects */}
        <div className="hero-glow" />
        <div className="fixed inset-0 grid-pattern opacity-30 pointer-events-none" />
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="floating-orb-purple w-[500px] h-[500px] top-[-20%] left-[-10%]" />
        </div>

        <div className="relative z-10 max-w-xl mx-auto px-6 py-12">
          <Link href="/" className="btn-ghost inline-flex items-center gap-2 mb-8">← Voltar</Link>

          <div className="glass-card p-8 text-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-sol-purple to-sol-green flex items-center justify-center text-4xl mx-auto mb-4 glow-purple">
              📋
            </div>
            <h1 className="text-3xl font-bold mb-4 text-gradient">Meus Depósitos</h1>
            <p className="text-muted mb-8">Conecte sua wallet para ver seus depósitos</p>

            <div className="space-y-4">
              {/* Solflare destacado */}
              {(() => {
                const solflareConnector = connectors.find(
                  (c) => c.name.toLowerCase().includes("solflare")
                );
                if (solflareConnector) {
                  return (
                    <button
                      onClick={() => connect(solflareConnector.id)}
                      className="btn-primary w-full flex items-center justify-center gap-3"
                    >
                      <span className="text-xl">🔥</span>
                      <span>Conectar com Solflare</span>
                    </button>
                  );
                }
                return null;
              })()}

              <div className="grid gap-3 sm:grid-cols-2">
                {connectors
                  .filter(
                    (c) =>
                      !c.name.toLowerCase().includes("solflare") &&
                      !c.name.toLowerCase().includes("metamask") &&
                      !c.name.toLowerCase().includes("brave")
                  )
                  .slice(0, 4)
                  .map((connector) => (
                    <button
                      key={connector.id}
                      onClick={() => connect(connector.id)}
                      className="btn-secondary"
                    >
                      {connector.name}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hasDeposits = expiredDeposits.length > 0 || activeDeposits.length > 0;

  return (
    <div className="min-h-screen bg-bg-primary relative">
      {/* Background Effects */}
      <div className="hero-glow" />
      <div className="fixed inset-0 grid-pattern opacity-30 pointer-events-none" />
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb-purple w-[500px] h-[500px] top-[-20%] left-[-10%]" />
        <div className="floating-orb-green w-[300px] h-[300px] bottom-[-10%] right-[10%]" style={{ animationDelay: '-4s' }} />
      </div>

      <div className="relative z-10 max-w-xl mx-auto px-6 py-12 space-y-6">
        <Link href="/" className="btn-ghost inline-flex items-center gap-2">← Voltar</Link>

        {/* Header */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sol-purple to-sol-green flex items-center justify-center text-2xl glow-purple">
              📋
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gradient">Meus Depósitos</h1>
              <p className="text-sm text-muted">Acompanhe e gerencie seus depósitos</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        {hasDeposits && (
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-card p-4 text-center">
              <p className="text-3xl font-bold text-sol-green">{activeDeposits.length}</p>
              <p className="text-xs text-muted">Ativos</p>
            </div>
            <div className="glass-card p-4 text-center">
              <p className="text-3xl font-bold text-sol-purple">{expiredDeposits.length}</p>
              <p className="text-xs text-muted">Expirados</p>
            </div>
          </div>
        )}

        {/* Depósitos Ativos */}
        {activeDeposits.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="status-dot-green" />
              <p className="font-semibold">Em andamento ({activeDeposits.length})</p>
            </div>

            {activeDeposits.map((d) => (
              <div key={d.depositId} className="glass-card glass-card-green p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-3xl font-bold text-sol-green">{d.amount} SOL</p>
                    <p className="text-xs text-muted-dark font-mono mt-1">ID: {d.depositId.slice(0, 15)}...</p>
                  </div>
                  <span className="badge-green">
                    {d.expiresAt === 0 ? "♾️ Sem expiração" : `⏱️ ${timeRemaining(d.expiresAt)}`}
                  </span>
                </div>

                {/* Progress bar */}
                {d.expiresAt > 0 && (
                  <div className="space-y-1">
                    <div className="h-1.5 bg-bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-sol-green to-sol-blue rounded-full transition-all"
                        style={{ width: `${timeProgress(d.createdAt, d.expiresAt)}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="card-section">
                    <p className="text-muted-dark mb-1">Criado</p>
                    <p className="font-medium">{new Date(d.createdAt * 1000).toLocaleDateString()}</p>
                  </div>
                  <div className="card-section">
                    <p className="text-muted-dark mb-1">Expira</p>
                    <p className="font-medium">
                      {d.expiresAt === 0 ? "Nunca" : new Date(d.expiresAt * 1000).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => copyMagicLink(d)}
                  className="btn-secondary w-full flex items-center justify-center gap-2"
                >
                  {copiedId === d.depositId ? (
                    <>
                      <span>✅</span>
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <span>📋</span>
                      <span>Copiar Magic Link</span>
                    </>
                  )}
                </button>

                <p className="text-xs text-muted-dark text-center">
                  {d.expiresAt === 0
                    ? "⚠️ Sem expiração - não pode ser reembolsado"
                    : "💡 Se não for resgatado, você poderá recuperar após expirar"
                  }
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Depósitos Expirados */}
        {expiredDeposits.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="status-dot-red" />
              <p className="font-semibold">Expirados ({expiredDeposits.length})</p>
            </div>

            {expiredDeposits.map((d) => (
              <div key={d.depositId} className="glass-card glass-card-purple p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-3xl font-bold text-sol-green">{d.amount} SOL</p>
                    <p className="text-xs text-muted-dark font-mono mt-1">ID: {d.depositId.slice(0, 15)}...</p>
                  </div>
                  <span className="badge-purple">⏰ Expirado</span>
                </div>

                <div className="card-section border-red-500/20 bg-red-500/5">
                  <p className="text-xs text-red-400">
                    Expirou em <span className="font-semibold">{new Date(d.expiresAt * 1000).toLocaleString()}</span>
                  </p>
                </div>

                <button
                  onClick={() => handleRefund(d.depositId)}
                  disabled={isSending}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {refundingId === d.depositId ? (
                    <>
                      <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      <span>Processando...</span>
                    </>
                  ) : (
                    <>
                      <span>🔄</span>
                      <span>Recuperar SOL</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Sem depósitos */}
        {!hasDeposits && (
          <div className="glass-card p-8 text-center">
            <div className="text-5xl mb-4">📭</div>
            <p className="text-xl font-bold mb-2">Nenhum depósito</p>
            <p className="text-sm text-muted mb-6">Depósitos criados neste navegador aparecerão aqui</p>
            <Link href="/send" className="btn-primary inline-flex items-center gap-2">
              <span>🚀</span>
              <span>Criar depósito</span>
            </Link>
          </div>
        )}

        {/* Input manual */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sol-blue/15 border border-sol-blue/30 flex items-center justify-center">
              <span>🔧</span>
            </div>
            <div>
              <p className="font-semibold">Refund Manual</p>
              <p className="text-xs text-muted">Criou em outro dispositivo? Insira o Deposit ID</p>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Deposit ID"
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              className="input flex-1 font-mono text-sm"
            />
            <button
              onClick={() => manualId && handleRefund(manualId)}
              disabled={isSending || !manualId}
              className="btn-secondary whitespace-nowrap"
            >
              Refund
            </button>
          </div>
        </div>

        {/* Status */}
        {txStatus && (
          <div className={`glass-card p-4 text-sm whitespace-pre-line ${
            txStatus.includes("✅") ? "border-sol-green/30 text-sol-green" : "border-red-500/30 text-red-400"
          }`}>
            {txStatus}
          </div>
        )}

        {/* Info */}
        <div className="glass-card p-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-sol-purple/15 border border-sol-purple/30 flex items-center justify-center flex-shrink-0">
              <span>💡</span>
            </div>
            <div>
              <p className="font-semibold mb-2">Como funciona:</p>
              <ul className="space-y-1 text-sm text-muted">
                <li>• Depósitos ativos podem ser resgatados pelo destinatário</li>
                <li>• Após expirar, só você pode recuperar os fundos</li>
                <li>• Depósitos sem expiração nunca podem ser reembolsados</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
