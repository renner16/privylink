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
}

export default function RefundPage() {
  const { wallet, status } = useWalletConnection();
  const { send, isSending } = useSendTransaction();

  const [deposits, setDeposits] = useState<StoredDeposit[]>([]);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [manualId, setManualId] = useState("");

  const walletAddress = wallet?.account.address;

  // Carregar depósitos do localStorage
  useEffect(() => {
    if (typeof window === "undefined" || !walletAddress) return;

    const stored: StoredDeposit[] = JSON.parse(
      localStorage.getItem("privylink_deposits") || "[]"
    );

    // Filtrar: apenas do wallet atual e expirados
    const now = Math.floor(Date.now() / 1000);
    const expired = stored.filter(
      (d) => d.depositor === walletAddress && d.expiresAt > 0 && d.expiresAt < now
    );

    setDeposits(expired);
  }, [walletAddress]);

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

      // Atualizar lista local
      setDeposits((prev) => prev.filter((d) => d.depositId !== depositId));

      setTxStatus(`✅ Refund realizado!\nSignature: ${signature?.slice(0, 30)}...`);

    } catch (err: any) {
      console.error("Erro no refund:", err);
      let msg = err?.message || "Erro desconhecido";

      if (msg.includes("AlreadyClaimed") || msg.includes("0x1770")) {
        msg = "Ja foi resgatado/reembolsado!";
        // Remover do localStorage pois já foi usado
        const stored: StoredDeposit[] = JSON.parse(
          localStorage.getItem("privylink_deposits") || "[]"
        );
        localStorage.setItem(
          "privylink_deposits",
          JSON.stringify(stored.filter((d) => d.depositId !== depositId))
        );
        setDeposits((prev) => prev.filter((d) => d.depositId !== depositId));
      } else if (msg.includes("NotExpiredYet") || msg.includes("0x1774")) {
        msg = "Ainda nao expirou!";
      } else if (msg.includes("AccountNotFound")) {
        msg = "Deposito nao encontrado.";
      }

      setTxStatus(`❌ ${msg}`);
    }

    setRefundingId(null);
  }, [walletAddress, wallet, send]);

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
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold mb-4 text-gradient">Refund</h1>
            <p className="text-muted">Conecte sua wallet para ver depósitos expirados.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-sol-purple/15 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-xl mx-auto px-6 py-12 space-y-6">
        <Link href="/" className="btn-ghost inline-flex items-center gap-2">← Voltar</Link>

        <div className="glass-card p-6">
          <h1 className="text-2xl font-bold mb-2 text-gradient">Refund de Depósitos</h1>
          <p className="text-sm text-muted">Recupere SOL de depósitos expirados.</p>
        </div>

        {/* Lista de depósitos expirados */}
        {deposits.length > 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted">{deposits.length} depósito(s) expirado(s)</p>

            {deposits.map((d) => (
              <div key={d.depositId} className="glass-card p-5 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-2xl font-bold text-sol-green">{d.amount} SOL</p>
                    <p className="text-xs text-muted font-mono">ID: {d.depositId}</p>
                  </div>
                  <span className="badge-purple text-xs">Expirado</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-muted">
                  <div>
                    <p>Criado</p>
                    <p className="text-foreground">{new Date(d.createdAt * 1000).toLocaleString()}</p>
                  </div>
                  <div>
                    <p>Expirou</p>
                    <p className="text-red-400">{new Date(d.expiresAt * 1000).toLocaleString()}</p>
                  </div>
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
                    "Recuperar SOL"
                  )}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-card p-8 text-center">
            <div className="text-4xl mb-3">🕐</div>
            <p className="font-semibold mb-1">Nenhum depósito expirado</p>
            <p className="text-sm text-muted">Depósitos criados neste navegador aparecerão aqui quando expirarem.</p>
          </div>
        )}

        {/* Input manual */}
        <div className="glass-card p-5 space-y-3">
          <p className="text-sm font-medium">Refund manual</p>
          <p className="text-xs text-muted">Se criou o depósito em outro dispositivo, insira o ID:</p>
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
          <p className="font-medium text-foreground">Como funciona:</p>
          <ul className="space-y-1">
            <li>• Só depósitos expirados podem ser reembolsados</li>
            <li>• Só o criador do depósito pode pedir refund</li>
            <li>• O valor é devolvido menos taxa de rede (~0.00001 SOL)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
