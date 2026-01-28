"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import { useWalletConnection, useSendTransaction } from "@solana/react-hooks";
import {
  getProgramDerivedAddress,
  getAddressEncoder,
  getBytesEncoder,
  getU64Encoder,
  getU32Encoder,
  getUtf8Encoder,
  addEncoderSizePrefix,
  getStructEncoder,
  fixEncoderSize,
  AccountRole,
  type Address,
} from "@solana/kit";
import { VAULT_PROGRAM_ADDRESS } from "../../generated/vault";
import Link from "next/link";

// Instruction discriminator for claim_deposit
const CLAIM_DEPOSIT_DISCRIMINATOR = new Uint8Array([
  201, 106, 1, 224, 122, 144, 210, 155,
]);

const SYSTEM_PROGRAM_ADDRESS = "11111111111111111111111111111111" as Address;

const LAMPORTS_PER_SOL = 1_000_000_000n;

// Decode magic link code
function decodeMagicLink(code: string): { depositId: string; depositorAddress: string; secret: string } | null {
  try {
    // Restore base64 padding and special chars
    let base64 = code.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    const decoded = atob(base64);
    const [depositId, depositorAddress, secret] = decoded.split(":");
    if (!depositId || !depositorAddress || !secret) {
      return null;
    }
    return { depositId, depositorAddress, secret };
  } catch {
    return null;
  }
}

export default function ClaimPage() {
  const params = useParams();
  const code = params.code as string;

  const { wallet, status, connectors, connect } = useWalletConnection();
  const { send, isSending } = useSendTransaction();

  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);
  const [linkData, setLinkData] = useState<{
    depositId: string;
    depositorAddress: string;
    secret: string;
  } | null>(null);

  const walletAddress = wallet?.account.address;

  // Decode magic link on mount
  useEffect(() => {
    if (code) {
      const decoded = decodeMagicLink(code);
      setLinkData(decoded);
      if (!decoded) {
        setTxStatus("Link invalido. Verifique se copiou corretamente.");
      }
    }
  }, [code]);

  const handleClaim = useCallback(async () => {
    if (!walletAddress || !wallet || !linkData) return;

    try {
      setTxStatus("Preparando resgate...");

      const depositId = BigInt(linkData.depositId);

      console.log("Resgatando deposito:", {
        depositId: depositId.toString(),
        depositorAddress: linkData.depositorAddress,
        claimer: walletAddress,
      });

      // Derive the deposit PDA (same format as createPrivateDeposit)
      const depositPda = await getProgramDerivedAddress({
        programAddress: VAULT_PROGRAM_ADDRESS,
        seeds: [
          getBytesEncoder().encode(
            new Uint8Array([100, 101, 112, 111, 115, 105, 116]) // "deposit"
          ),
          getAddressEncoder().encode(linkData.depositorAddress as Address),
          getU64Encoder().encode(depositId),
        ],
      });

      console.log("Deposit PDA:", depositPda[0]);

      // Verify the deposit exists on-chain before trying to claim
      const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
      const accountResponse = await fetch(RPC_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getAccountInfo",
          params: [depositPda[0], { encoding: "base64" }]
        })
      });
      const accountData = await accountResponse.json();
      console.log("Deposit account check:", accountData);

      if (!accountData.result?.value) {
        setTxStatus("Erro: Deposito nao encontrado na blockchain.\n\nO deposito pode nao ter sido criado com sucesso.\nVerifique se a transacao de criacao foi confirmada.");
        return;
      }

      console.log("Deposit exists! Lamports:", accountData.result.value.lamports);

      // Build instruction data manually
      const instructionDataEncoder = getStructEncoder([
        ["discriminator", fixEncoderSize(getBytesEncoder(), 8)],
        ["depositId", getU64Encoder()],
        ["secret", addEncoderSizePrefix(getUtf8Encoder(), getU32Encoder())],
      ]);

      const instructionData = instructionDataEncoder.encode({
        discriminator: CLAIM_DEPOSIT_DISCRIMINATOR,
        depositId,
        secret: linkData.secret,
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

      setClaimed(true);
      setTxStatus(`Resgate realizado com sucesso!\n\nOs SOL foram transferidos para sua wallet.\n\nSignature: ${signature?.slice(0, 30)}...`);

    } catch (err: any) {
      console.error("Erro no claim:", err);

      let errorMessage = err?.message || "Erro desconhecido";

      if (errorMessage.includes("InvalidSecret") || errorMessage.includes("0x1771")) {
        errorMessage = "Codigo secreto invalido!";
      } else if (errorMessage.includes("AlreadyClaimed") || errorMessage.includes("0x1770")) {
        errorMessage = "Este deposito ja foi resgatado!";
      } else if (errorMessage.includes("DepositExpired") || errorMessage.includes("0x1773")) {
        errorMessage = "Este deposito expirou e nao pode mais ser resgatado.";
      } else if (errorMessage.includes("AccountNotFound") || errorMessage.includes("account not found")) {
        errorMessage = "Deposito nao encontrado. O link pode estar incorreto.";
      }

      setTxStatus(`Erro: ${errorMessage}`);
    }
  }, [walletAddress, wallet, linkData, send]);

  // Invalid link
  if (!linkData && code) {
    return (
      <div className="min-h-screen bg-bg1 text-foreground p-6">
        <div className="max-w-xl mx-auto">
          <Link href="/" className="text-sm text-muted hover:underline mb-4 inline-block">
            &larr; Voltar
          </Link>
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-lg">
            <h1 className="text-2xl font-bold text-red-800 mb-4">Link Invalido</h1>
            <p className="text-red-700">
              Este link de resgate e invalido. Verifique se copiou o link completo.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Wallet not connected
  if (status !== "connected") {
    return (
      <div className="min-h-screen bg-bg1 text-foreground p-6">
        <div className="max-w-xl mx-auto">
          <Link href="/" className="text-sm text-muted hover:underline mb-4 inline-block">
            &larr; Voltar
          </Link>
          <div className="rounded-2xl border border-border-low bg-card p-6 shadow-lg space-y-6">
            <div>
              <h1 className="text-2xl font-bold mb-2">Resgatar SOL</h1>
              <p className="text-muted">
                Conecte sua wallet para resgatar os fundos.
              </p>
            </div>

            {linkData && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                <p className="text-sm font-medium text-green-800">Link valido!</p>
                <p className="text-xs text-green-700 mt-1">
                  Deposit ID: {linkData.depositId.slice(0, 10)}...
                </p>
              </div>
            )}

            <div className="rounded-lg bg-yellow-100/50 border border-yellow-300/50 p-4 text-sm">
              <p className="font-semibold text-yellow-800 mb-2">Configure sua wallet para DEVNET</p>
              <p className="text-yellow-700 text-xs">
                <strong>Phantom:</strong> Settings - Developer Mode - Devnet<br/>
                <strong>Solflare:</strong> Settings - Network - Devnet
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Conectar wallet:</p>
              <div className="grid gap-2">
                {connectors
                  .filter((c) => !c.name.toLowerCase().includes("metamask"))
                  .slice(0, 3)
                  .map((connector) => (
                    <button
                      key={connector.id}
                      onClick={() => connect(connector.id)}
                      className="w-full rounded-lg border border-border-low bg-card px-4 py-3 text-left font-medium transition hover:bg-cream/50"
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

  // Connected - show claim UI
  return (
    <div className="min-h-screen bg-bg1 text-foreground p-6">
      <div className="max-w-xl mx-auto space-y-6">
        <Link href="/" className="text-sm text-muted hover:underline mb-4 inline-block">
          &larr; Voltar
        </Link>

        <div className="rounded-2xl border border-border-low bg-card p-6 shadow-lg space-y-6">
          <div>
            <h1 className="text-2xl font-bold mb-2">
              {claimed ? "Resgatado!" : "Resgatar SOL"}
            </h1>
            <p className="text-muted text-sm">
              {claimed
                ? "Os fundos foram transferidos para sua wallet."
                : "Clique no botao abaixo para resgatar os SOL."}
            </p>
          </div>

          {linkData && !claimed && (
            <div className="rounded-lg bg-cream/50 border border-border-low p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Deposit ID:</span>
                <span className="font-mono">{linkData.depositId.slice(0, 15)}...</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">De:</span>
                <span className="font-mono">{linkData.depositorAddress.slice(0, 8)}...{linkData.depositorAddress.slice(-4)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Para:</span>
                <span className="font-mono">{walletAddress?.slice(0, 8)}...{walletAddress?.slice(-4)}</span>
              </div>
            </div>
          )}

          {!claimed && (
            <button
              onClick={handleClaim}
              disabled={isSending}
              className="w-full rounded-lg bg-foreground px-4 py-4 text-lg font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSending ? "Resgatando..." : "Resgatar SOL"}
            </button>
          )}

          {claimed && (
            <div className="space-y-3">
              <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-center">
                <p className="text-2xl mb-2">Parabens!</p>
                <p className="text-green-700">O resgate foi realizado com sucesso.</p>
              </div>
              <Link
                href="/send"
                className="block w-full rounded-lg border border-border-low px-4 py-3 font-medium text-center hover:bg-cream/50 transition"
              >
                Criar meu proprio envio
              </Link>
            </div>
          )}

          {/* Status */}
          {txStatus && (
            <div className={`rounded-lg border px-4 py-3 text-sm whitespace-pre-line ${
              claimed
                ? "border-green-200 bg-green-50 text-green-800"
                : txStatus.includes("Erro")
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-border-low bg-cream/50"
            }`}>
              {txStatus}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
