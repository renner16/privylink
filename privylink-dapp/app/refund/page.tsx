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

export default function RefundPage() {
  const { wallet, status } = useWalletConnection();
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
        msg = "Ja foi resgatado/reembolsado!";
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
        msg = "Ainda nao expirou!";
      } else if (msg.includes("AccountNotFound")) {
        msg = "Deposito nao encontrado.";
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
      <div className="min-h-screen bg-background">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-sol-purple/15 rounded-full blur-[120px]" />
        </div>
        <div className="relative z-10 max-w-xl mx-auto px-6 py-12">
          <Link href="/" className="btn-ghost inline-flex items-center gap-2 mb-8">← Voltar</Link>
          <div className="glass-card p-8 text-center">
            <div className="text-5xl mb-4">📋</div>
            <h1 className="text-2xl font-bold mb-4 text-gradient">Meus Depósitos</h1>
            <p className="text-muted">Conecte sua wallet para ver seus depósitos.</p>
          </div>
        </div>
      </div>
    );
  }

  const hasDeposits = expiredDeposits.length > 0 || activeDeposits.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-sol-purple/15 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-xl mx-auto px-6 py-12 space-y-6">
        <Link href="/" className="btn-ghost inline-flex items-center gap-2">← Voltar</Link>

        <div className="glass-card p-6">
          <h1 className="text-2xl font-bold mb-2 text-gradient">Meus Depósitos</h1>
          <p className="text-sm text-muted">Acompanhe e gerencie seus depósitos.</p>
        </div>

        {/* Depósitos Ativos */}
        {activeDeposits.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sol-green animate-pulse" />
              <p className="text-sm font-medium">Em andamento ({activeDeposits.length})</p>
            </div>

            {activeDeposits.map((d) => (
              <div key={d.depositId} className="glass-card p-5 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-2xl font-bold text-sol-green">{d.amount} SOL</p>
                    <p className="text-xs text-muted font-mono">ID: {d.depositId.slice(0, 15)}...</p>
                  </div>
                  <span className="badge-green text-xs">
                    {d.expiresAt === 0 ? "Sem expiração" : timeRemaining(d.expiresAt)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-muted">
                  <div>
                    <p>Criado</p>
                    <p className="text-foreground">{new Date(d.createdAt * 1000).toLocaleString()}</p>
                  </div>
                  <div>
                    <p>Expira</p>
                    <p className="text-foreground">
                      {d.expiresAt === 0 ? "Nunca" : new Date(d.expiresAt * 1000).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => copyMagicLink(d)}
                    className="btn-secondary flex-1 text-sm"
                  >
                    {copiedId === d.depositId ? "✅ Copiado!" : "📋 Copiar Link"}
                  </button>
                </div>

                <p className="text-xs text-muted text-center">
                  {d.expiresAt === 0
                    ? "Sem expiração - não pode ser reembolsado"
                    : "Se não for claimado, você poderá recuperar após expirar"
                  }
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Depósitos Expirados */}
        {expiredDeposits.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <p className="text-sm font-medium">Expirados ({expiredDeposits.length})</p>
            </div>

            {expiredDeposits.map((d) => (
              <div key={d.depositId} className="glass-card p-5 space-y-3 border-red-500/20">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-2xl font-bold text-sol-green">{d.amount} SOL</p>
                    <p className="text-xs text-muted font-mono">ID: {d.depositId.slice(0, 15)}...</p>
                  </div>
                  <span className="badge-purple text-xs">Expirado</span>
                </div>

                <div className="text-xs text-muted">
                  <p>Expirou em <span className="text-red-400">{new Date(d.expiresAt * 1000).toLocaleString()}</span></p>
                </div>

                <button
                  onClick={() => handleRefund(d.depositId)}
                  disabled={isSending}
                  className="btn-primary w-full"
                >
                  {refundingId === d.depositId ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      Processando...
                    </span>
                  ) : (
                    "🔄 Recuperar SOL"
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Sem depósitos */}
        {!hasDeposits && (
          <div className="glass-card p-8 text-center">
            <div className="text-4xl mb-3">📭</div>
            <p className="font-semibold mb-1">Nenhum depósito</p>
            <p className="text-sm text-muted mb-4">Depósitos criados neste navegador aparecerão aqui.</p>
            <Link href="/send" className="btn-primary inline-block">
              Criar depósito
            </Link>
          </div>
        )}

        {/* Input manual */}
        <div className="glass-card p-5 space-y-3">
          <p className="text-sm font-medium">Refund manual</p>
          <p className="text-xs text-muted">Criou em outro dispositivo? Insira o Deposit ID:</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Deposit ID"
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              className="input flex-1 text-sm"
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
            txStatus.includes("✅") ? "text-sol-green" : "text-red-400"
          }`}>
            {txStatus}
          </div>
        )}

        {/* Info */}
        <div className="glass-card p-5 text-xs text-muted space-y-2">
          <p className="font-medium text-foreground">Info:</p>
          <ul className="space-y-1">
            <li>• Depósitos ativos podem ser resgatados pelo destinatário</li>
            <li>• Após expirar, só você pode recuperar os fundos</li>
            <li>• Depósitos sem expiração nunca podem ser reembolsados</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
