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

      // Derive the deposit PDA
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

      // Verify the deposit exists on-chain
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

      if (!accountData.result?.value) {
        setTxStatus("Erro: Deposito nao encontrado na blockchain.\n\nO deposito pode nao ter sido criado com sucesso.");
        return;
      }

      // Build instruction data
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
      setTxStatus(`Resgate realizado!\n\nSignature: ${signature?.slice(0, 30)}...`);

    } catch (err: any) {
      console.error("Erro no claim:", err);

      let errorMessage = err?.message || "Erro desconhecido";

      if (errorMessage.includes("InvalidSecret") || errorMessage.includes("0x1771")) {
        errorMessage = "Codigo secreto invalido!";
      } else if (errorMessage.includes("AlreadyClaimed") || errorMessage.includes("0x1770")) {
        errorMessage = "Este deposito ja foi resgatado!";
      } else if (errorMessage.includes("DepositExpired") || errorMessage.includes("0x1773")) {
        errorMessage = "Este deposito expirou.";
      } else if (errorMessage.includes("AccountNotFound") || errorMessage.includes("account not found")) {
        errorMessage = "Deposito nao encontrado.";
      }

      setTxStatus(`Erro: ${errorMessage}`);
    }
  }, [walletAddress, wallet, linkData, send]);

  // Invalid link
  if (!linkData && code) {
    return (
      <div className="min-h-screen bg-background">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] right-[-10%] w-[400px] h-[400px] bg-red-500/10 rounded-full blur-[100px]" />
        </div>

        <div className="relative z-10 max-w-xl mx-auto px-6 py-12">
          <Link href="/" className="btn-ghost inline-flex items-center gap-2 mb-8">
            ← Voltar
          </Link>

          <div className="glass-card p-8 border-red-500/30">
            <div className="text-center mb-6">
              <span className="text-5xl">❌</span>
            </div>
            <h1 className="text-2xl font-bold text-red-400 mb-4 text-center">Link Invalido</h1>
            <p className="text-muted text-center">
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
      <div className="min-h-screen bg-background">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-sol-green/15 rounded-full blur-[120px]" />
        </div>

        <div className="relative z-10 max-w-xl mx-auto px-6 py-12">
          <Link href="/" className="btn-ghost inline-flex items-center gap-2 mb-8">
            ← Voltar
          </Link>

          <div className="glass-card p-8 space-y-6">
            <div className="text-center">
              <span className="text-5xl mb-4 block">🎁</span>
              <h1 className="text-2xl font-bold mb-2 text-gradient">Resgatar SOL</h1>
              <p className="text-muted">
                Conecte sua wallet para resgatar os fundos.
              </p>
            </div>

            {linkData && (
              <div className="card-section border-sol-green/30 bg-sol-green/5 text-center">
                <span className="text-sol-green font-semibold">Link valido!</span>
                <p className="text-xs text-muted mt-1">
                  Deposit ID: {linkData.depositId.slice(0, 10)}...
                </p>
              </div>
            )}

            <div className="card-section border-sol-purple/30 bg-sol-purple/5">
              <p className="font-medium text-sol-purple mb-2">⚠️ Configure para DEVNET</p>
              <p className="text-xs text-muted">
                <strong>Phantom:</strong> Settings → Developer Mode → Devnet<br/>
                <strong>Solflare:</strong> Settings → Network → Devnet
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Conectar wallet:</p>
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
                      <span>🔥</span>
                      <span>Conectar com Solflare</span>
                    </button>
                  );
                }
                return null;
              })()}

              <div className="grid gap-2">
                {connectors
                  .filter((c) =>
                    !c.name.toLowerCase().includes("metamask") &&
                    !c.name.toLowerCase().includes("solflare") &&
                    !c.name.toLowerCase().includes("brave")
                  )
                  .slice(0, 2)
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

  // Connected - show claim UI
  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-sol-green/15 rounded-full blur-[120px]" />
        {claimed && (
          <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-sol-purple/15 rounded-full blur-[100px]" />
        )}
      </div>

      <div className="relative z-10 max-w-xl mx-auto px-6 py-12 space-y-6">
        <Link href="/" className="btn-ghost inline-flex items-center gap-2">
          ← Voltar
        </Link>

        <div className="glass-card p-8 space-y-6">
          {!claimed ? (
            <>
              <div className="text-center">
                <span className="text-5xl mb-4 block">🎁</span>
                <h1 className="text-2xl font-bold mb-2">Resgatar SOL</h1>
                <p className="text-muted">
                  Clique no botao abaixo para resgatar os fundos.
                </p>
              </div>

              {linkData && (
                <div className="card-section space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Deposit ID:</span>
                    <span className="font-mono text-sol-purple">{linkData.depositId.slice(0, 15)}...</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">De:</span>
                    <span className="font-mono">{linkData.depositorAddress.slice(0, 8)}...{linkData.depositorAddress.slice(-4)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Para:</span>
                    <span className="font-mono text-sol-green">{walletAddress?.slice(0, 8)}...{walletAddress?.slice(-4)}</span>
                  </div>
                </div>
              )}

              <button
                onClick={handleClaim}
                disabled={isSending}
                className="btn-primary w-full text-lg py-4"
              >
                {isSending ? "Resgatando..." : "Resgatar SOL"}
              </button>
            </>
          ) : (
            <>
              <div className="text-center">
                <span className="text-6xl mb-4 block">🎉</span>
                <h1 className="text-2xl font-bold mb-2 text-gradient">Parabens!</h1>
                <p className="text-muted">
                  O resgate foi realizado com sucesso.
                </p>
              </div>

              <div className="card-section border-sol-green/30 bg-sol-green/5 text-center">
                <p className="text-sol-green font-semibold">
                  Os SOL foram transferidos para sua wallet!
                </p>
              </div>

              <Link href="/send" className="btn-secondary w-full text-center block">
                Criar meu proprio envio
              </Link>
            </>
          )}

          {/* Status */}
          {txStatus && (
            <div className={`card-section text-sm whitespace-pre-line ${
              claimed
                ? "border-sol-green/30 bg-sol-green/5 text-sol-green"
                : txStatus.includes("Erro")
                ? "border-red-500/30 bg-red-500/5 text-red-400"
                : "border-border text-muted"
            }`}>
              {txStatus}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
