"use client";

import { useState, useCallback } from "react";
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

// Instruction discriminator for refund_expired
const REFUND_EXPIRED_DISCRIMINATOR = new Uint8Array([
  118, 153, 164, 244, 40, 128, 242, 250,
]);

const SYSTEM_PROGRAM_ADDRESS = "11111111111111111111111111111111" as Address;

export default function RefundPage() {
  const { wallet, status } = useWalletConnection();
  const { send, isSending } = useSendTransaction();

  const [depositId, setDepositId] = useState("");
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [refunded, setRefunded] = useState(false);

  const walletAddress = wallet?.account.address;

  const handleRefund = useCallback(async () => {
    if (!walletAddress || !wallet || !depositId) return;

    try {
      setTxStatus("Verificando deposito...");

      const depositIdBigInt = BigInt(depositId);

      console.log("Refund deposito:", {
        depositId: depositIdBigInt.toString(),
        depositor: walletAddress,
      });

      // Derive the deposit PDA (same format as createPrivateDeposit)
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

      console.log("Deposit PDA:", depositPda[0]);

      // Build instruction data manually
      const instructionDataEncoder = getStructEncoder([
        ["discriminator", fixEncoderSize(getBytesEncoder(), 8)],
        ["depositId", getU64Encoder()],
      ]);

      const instructionData = instructionDataEncoder.encode({
        discriminator: REFUND_EXPIRED_DISCRIMINATOR,
        depositId: depositIdBigInt,
      });

      // Build instruction manually without attaching signer objects
      const instruction = {
        programAddress: VAULT_PROGRAM_ADDRESS,
        accounts: [
          { address: walletAddress as Address, role: AccountRole.WRITABLE_SIGNER },
          { address: depositPda[0], role: AccountRole.WRITABLE },
          { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
        ],
        data: instructionData,
      };

      setTxStatus("Aguardando assinatura...");

      const signature = await send({ instructions: [instruction] });

      setRefunded(true);
      setTxStatus(`Refund realizado com sucesso!\n\nOs SOL foram devolvidos para sua wallet.\n\nSignature: ${signature?.slice(0, 30)}...`);
      setDepositId("");

    } catch (err: any) {
      console.error("Erro no refund:", err);

      let errorMessage = err?.message || "Erro desconhecido";

      if (errorMessage.includes("AlreadyClaimed") || errorMessage.includes("0x1770")) {
        errorMessage = "Este deposito ja foi resgatado ou reembolsado!";
      } else if (errorMessage.includes("DepositNotExpired") || errorMessage.includes("0x1774")) {
        errorMessage = "Este deposito ainda nao expirou. Aguarde a data de expiracao.";
      } else if (errorMessage.includes("DepositNeverExpires") || errorMessage.includes("0x1775")) {
        errorMessage = "Este deposito foi criado sem expiracao. Nao pode ser reembolsado.";
      } else if (errorMessage.includes("NotDepositor") || errorMessage.includes("0x1776")) {
        errorMessage = "Apenas o criador do deposito pode solicitar reembolso.";
      } else if (errorMessage.includes("AccountNotFound") || errorMessage.includes("account not found")) {
        errorMessage = "Deposito nao encontrado. Verifique o ID e se voce e o criador.";
      }

      setTxStatus(`Erro: ${errorMessage}`);
    }
  }, [walletAddress, wallet, depositId, send]);

  if (status !== "connected") {
    return (
      <div className="min-h-screen bg-background">
        {/* Background glow */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-sol-purple/15 rounded-full blur-[120px]" />
        </div>

        <div className="relative z-10 max-w-xl mx-auto px-6 py-12">
          <Link href="/" className="btn-ghost inline-flex items-center gap-2 mb-8">
            ← Voltar
          </Link>

          <div className="glass-card p-8">
            <h1 className="text-2xl font-bold mb-4 text-gradient">Recuperar Deposito</h1>
            <p className="text-muted mb-6">
              Conecte sua wallet para recuperar depositos expirados.
            </p>

            <div className="card-section border-sol-purple/30 bg-sol-purple/5">
              <p className="text-sm text-sol-purple font-medium">⚠️ Configure sua wallet para DEVNET</p>
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

      <div className="relative z-10 max-w-xl mx-auto px-6 py-12 space-y-6">
        <Link href="/" className="btn-ghost inline-flex items-center gap-2">
          ← Voltar
        </Link>

        <div className="glass-card p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold mb-2 text-gradient">Recuperar Deposito Expirado</h1>
            <p className="text-sm text-muted">
              Se voce criou um deposito que expirou sem ser resgatado, pode recuperar os fundos aqui.
            </p>
          </div>

          {/* Info Box */}
          <div className="card-section border-sol-blue/30 bg-sol-blue/5">
            <p className="font-medium text-sol-blue mb-2">Importante:</p>
            <ul className="text-muted space-y-1 text-sm">
              <li>• Apenas o criador do deposito pode solicitar reembolso</li>
              <li>• O deposito deve ter expirado (passar da data limite)</li>
              <li>• Depositos sem expiracao nao podem ser reembolsados</li>
              <li>• Depositos ja resgatados nao podem ser reembolsados</li>
            </ul>
          </div>

          {!refunded ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Deposit ID</label>
                <input
                  type="text"
                  placeholder="Ex: 1706456789000"
                  value={depositId}
                  onChange={(e) => setDepositId(e.target.value)}
                  disabled={isSending}
                  className="input"
                />
                <p className="text-xs text-muted mt-2">
                  O Deposit ID foi mostrado quando voce criou o deposito.
                </p>
              </div>

              {/* Wallet Info */}
              <div className="card-section">
                <p className="text-sm text-muted">
                  <span className="font-medium text-foreground">Sua wallet:</span>{" "}
                  <span className="font-mono text-xs text-sol-purple">{walletAddress}</span>
                </p>
              </div>

              <button
                onClick={handleRefund}
                disabled={isSending || !depositId}
                className="btn-primary w-full"
              >
                {isSending ? "Processando..." : "Recuperar Fundos"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="card-section border-sol-green/30 bg-sol-green/10 text-center">
                <p className="text-3xl mb-2">✅</p>
                <p className="text-sol-green font-semibold">Sucesso!</p>
                <p className="text-sm text-muted mt-1">Os fundos foram devolvidos para sua wallet.</p>
              </div>
              <button
                onClick={() => {
                  setRefunded(false);
                  setTxStatus(null);
                }}
                className="btn-secondary w-full"
              >
                Recuperar outro deposito
              </button>
            </div>
          )}

          {/* Status */}
          {txStatus && (
            <div className={`card-section text-sm whitespace-pre-line ${
              refunded
                ? "border-sol-green/30 bg-sol-green/10 text-sol-green"
                : txStatus.includes("Erro")
                ? "border-red-500/30 bg-red-500/10 text-red-400"
                : "border-border text-muted"
            }`}>
              {txStatus}
            </div>
          )}
        </div>

        {/* Help Card */}
        <div className="glass-card p-6 text-sm text-muted">
          <p className="font-medium text-foreground mb-2">Onde encontrar o Deposit ID?</p>
          <p>
            O Deposit ID e mostrado na tela de sucesso apos criar um deposito.
            Se voce nao salvou, nao sera possivel recuperar os fundos automaticamente.
          </p>
        </div>
      </div>
    </div>
  );
}
