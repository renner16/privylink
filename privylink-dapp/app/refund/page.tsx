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

const LAMPORTS_PER_SOL = 1_000_000_000n;

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
      <div className="min-h-screen bg-bg1 text-foreground p-6">
        <div className="max-w-xl mx-auto">
          <Link href="/" className="text-sm text-muted hover:underline mb-4 inline-block">
            &larr; Voltar
          </Link>
          <div className="rounded-2xl border border-border-low bg-card p-6 shadow-lg">
            <h1 className="text-2xl font-bold mb-4">Recuperar Deposito</h1>
            <p className="text-muted mb-4">
              Conecte sua wallet para recuperar depositos expirados.
            </p>
            <div className="rounded-lg bg-yellow-100/50 border border-yellow-300/50 p-4 text-sm">
              <p className="font-semibold text-yellow-800">Configure sua wallet para DEVNET</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg1 text-foreground p-6">
      <div className="max-w-xl mx-auto space-y-6">
        <Link href="/" className="text-sm text-muted hover:underline mb-4 inline-block">
          &larr; Voltar
        </Link>

        <div className="rounded-2xl border border-border-low bg-card p-6 shadow-lg space-y-6">
          <div>
            <h1 className="text-2xl font-bold mb-2">Recuperar Deposito Expirado</h1>
            <p className="text-sm text-muted">
              Se voce criou um deposito que expirou sem ser resgatado, pode recuperar os fundos aqui.
            </p>
          </div>

          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm">
            <p className="font-medium text-amber-800 mb-1">Importante:</p>
            <ul className="text-amber-700 space-y-1 text-xs">
              <li>Apenas o criador do deposito pode solicitar reembolso</li>
              <li>O deposito deve ter expirado (passar da data limite)</li>
              <li>Depositos sem expiracao nao podem ser reembolsados</li>
              <li>Depositos ja resgatados nao podem ser reembolsados</li>
            </ul>
          </div>

          {!refunded ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Deposit ID</label>
                <input
                  type="text"
                  placeholder="Ex: 1706456789000"
                  value={depositId}
                  onChange={(e) => setDepositId(e.target.value)}
                  disabled={isSending}
                  className="w-full rounded-lg border border-border-low bg-card px-4 py-3 outline-none transition focus:border-foreground/30 disabled:opacity-60"
                />
                <p className="text-xs text-muted mt-1">
                  O Deposit ID foi mostrado quando voce criou o deposito.
                </p>
              </div>

              <div className="rounded-lg bg-cream/50 border border-border-low p-3 text-sm">
                <p className="text-muted">
                  <span className="font-medium">Sua wallet:</span>{" "}
                  <span className="font-mono text-xs">{walletAddress}</span>
                </p>
              </div>

              <button
                onClick={handleRefund}
                disabled={isSending || !depositId}
                className="w-full rounded-lg bg-foreground px-4 py-3 text-lg font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSending ? "Processando..." : "Recuperar Fundos"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-center">
                <p className="text-2xl mb-2">Sucesso!</p>
                <p className="text-green-700">Os fundos foram devolvidos para sua wallet.</p>
              </div>
              <button
                onClick={() => {
                  setRefunded(false);
                  setTxStatus(null);
                }}
                className="w-full rounded-lg border border-border-low px-4 py-3 font-medium hover:bg-cream/50 transition"
              >
                Recuperar outro deposito
              </button>
            </div>
          )}

          {/* Status */}
          {txStatus && (
            <div className={`rounded-lg border px-4 py-3 text-sm whitespace-pre-line ${
              refunded
                ? "border-green-200 bg-green-50 text-green-800"
                : txStatus.includes("Erro")
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-border-low bg-cream/50"
            }`}>
              {txStatus}
            </div>
          )}
        </div>

        {/* Help Card */}
        <div className="rounded-xl border border-border-low bg-card p-4 text-sm text-muted">
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
