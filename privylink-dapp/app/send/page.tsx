"use client";

import { useState, useCallback } from "react";
import { useWalletConnection, useSendTransaction } from "@solana/react-hooks";
import {
  getProgramDerivedAddress,
  getAddressEncoder,
  getU64Encoder,
  getI64Encoder,
  getBytesEncoder,
  getStructEncoder,
  fixEncoderSize,
  AccountRole,
  type Address,
} from "@solana/kit";
import { QRCodeSVG } from "qrcode.react";
import { VAULT_PROGRAM_ADDRESS } from "../generated/vault";
import Link from "next/link";

// Instruction discriminator for create_private_deposit
const CREATE_PRIVATE_DEPOSIT_DISCRIMINATOR = new Uint8Array([
  18, 31, 68, 39, 24, 0, 251, 139,
]);

const SYSTEM_PROGRAM_ADDRESS = "11111111111111111111111111111111" as Address;

const LAMPORTS_PER_SOL = 1_000_000_000n;

// Expiration options in seconds
const EXPIRATION_OPTIONS = [
  { label: "1 hora", value: 3600 },
  { label: "24 horas", value: 86400 },
  { label: "7 dias", value: 604800 },
  { label: "30 dias", value: 2592000 },
  { label: "Nunca expira", value: 0 },
];

// Generate magic link code (base64 encoded)
function encodeMagicLink(depositId: string, depositorAddress: string, secret: string): string {
  const data = `${depositId}:${depositorAddress}:${secret}`;
  return btoa(data).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export default function SendPage() {
  const { wallet, status } = useWalletConnection();
  const { send, isSending } = useSendTransaction();

  const [amount, setAmount] = useState("");
  const [secretCode, setSecretCode] = useState("");
  const [expiresIn, setExpiresIn] = useState(86400); // Default 24 hours
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const [depositInfo, setDepositInfo] = useState<{
    depositId: string;
    depositorAddress: string;
    secret: string;
    expiresAt: number;
  } | null>(null);

  const walletAddress = wallet?.account.address;

  // Generate random secret code
  const generateSecret = useCallback(() => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let result = "";
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setSecretCode(result);
  }, []);

  // Hash function for secret code using Web Crypto API
  const hashSecret = async (secret: string): Promise<Uint8Array> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(secret);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return new Uint8Array(hashBuffer);
  };

  const handleCreateDeposit = useCallback(async () => {
    if (!walletAddress || !amount || !secretCode || !wallet) return;

    try {
      setTxStatus("Criando deposito...");
      setMagicLink(null);
      setDepositInfo(null);

      const depositAmount = BigInt(
        Math.floor(parseFloat(amount) * Number(LAMPORTS_PER_SOL))
      );

      // Validate minimum amount
      const MIN_RENT = 1_500_000n; // ~0.0015 SOL for 90 bytes
      const MIN_AMOUNT = MIN_RENT + 5_000n;

      if (depositAmount < MIN_AMOUNT) {
        setTxStatus(`Valor minimo: ${Number(MIN_AMOUNT) / Number(LAMPORTS_PER_SOL)} SOL`);
        return;
      }

      // Generate deposit_id from timestamp
      const depositId = BigInt(Date.now());

      // Calculate expiration timestamp
      const expiresAt = expiresIn > 0 ? Math.floor(Date.now() / 1000) + expiresIn : 0;

      // Hash the secret code
      const claimHash = await hashSecret(secretCode);

      console.log("Criando deposito:", {
        depositId: depositId.toString(),
        amount: depositAmount.toString(),
        expiresAt,
        depositor: walletAddress,
      });

      // Derive the deposit PDA manually
      const depositPda = await getProgramDerivedAddress({
        programAddress: VAULT_PROGRAM_ADDRESS,
        seeds: [
          getBytesEncoder().encode(
            new Uint8Array([100, 101, 112, 111, 115, 105, 116]) // "deposit"
          ),
          getAddressEncoder().encode(walletAddress as Address),
          getU64Encoder().encode(depositId),
        ],
      });

      console.log("Deposit PDA:", depositPda[0]);

      // Build instruction data manually
      const instructionDataEncoder = getStructEncoder([
        ["discriminator", fixEncoderSize(getBytesEncoder(), 8)],
        ["depositId", getU64Encoder()],
        ["amount", getU64Encoder()],
        ["claimHash", fixEncoderSize(getBytesEncoder(), 32)],
        ["expiresAt", getI64Encoder()],
      ]);

      const instructionData = instructionDataEncoder.encode({
        discriminator: CREATE_PRIVATE_DEPOSIT_DISCRIMINATOR,
        depositId,
        amount: depositAmount,
        claimHash,
        expiresAt: BigInt(expiresAt),
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

      const signature = await send({
        instructions: [instruction],
      });

      console.log("Transaction signature:", signature);
      console.log("Deposit PDA expected:", depositPda[0]);

      // Verify the transaction status
      const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

      // Wait a bit for confirmation
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check transaction status
      const txStatusResponse = await fetch(RPC_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getSignatureStatuses",
          params: [[signature], { searchTransactionHistory: true }]
        })
      });
      const txStatusData = await txStatusResponse.json();
      console.log("Transaction status:", txStatusData);

      if (txStatusData.result?.value?.[0]?.err) {
        console.error("Transaction failed:", txStatusData.result.value[0].err);
        setTxStatus(`Erro: Transacao falhou.\n\nErro: ${JSON.stringify(txStatusData.result.value[0].err)}\n\nSignature: ${signature}\n\nVerifique no explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
        return;
      }

      // Check if the deposit account was created
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
      console.log("Deposit account verification:", accountData);

      if (!accountData.result?.value) {
        console.warn("WARNING: Deposit account not found after transaction!");
        console.log("Expected PDA:", depositPda[0]);
        console.log("Wallet address used:", walletAddress);
        console.log("Deposit ID used:", depositId.toString());
        setTxStatus(`Aviso: Transacao enviada mas deposito nao confirmado.\n\nPDA esperado: ${depositPda[0]}\nDeposit ID: ${depositId}\n\nSignature: ${signature}\n\nVerifique no explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
        return;
      }

      console.log("Deposit confirmed! Lamports:", accountData.result.value.lamports);

      // Generate magic link
      const code = encodeMagicLink(depositId.toString(), walletAddress, secretCode);
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
      const link = `${baseUrl}/claim/${code}`;

      setMagicLink(link);
      setDepositInfo({
        depositId: depositId.toString(),
        depositorAddress: walletAddress,
        secret: secretCode,
        expiresAt,
      });

      setTxStatus(`Deposito criado com sucesso!\nSignature: ${signature?.slice(0, 20)}...`);
      setAmount("");
      setSecretCode("");

    } catch (err: any) {
      console.error("Erro ao criar deposito:", err);
      setTxStatus(`Erro: ${err?.message || "Erro desconhecido"}`);
    }
  }, [walletAddress, wallet, amount, secretCode, expiresIn, send]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setTxStatus("Link copiado!");
  };

  if (status !== "connected") {
    return (
      <div className="min-h-screen bg-bg1 text-foreground p-6">
        <div className="max-w-xl mx-auto">
          <Link href="/" className="text-sm text-muted hover:underline mb-4 inline-block">
            &larr; Voltar
          </Link>
          <div className="rounded-2xl border border-border-low bg-card p-6 shadow-lg">
            <h1 className="text-2xl font-bold mb-4">Enviar SOL Privado</h1>
            <p className="text-muted mb-4">Conecte sua wallet para criar um deposito privado.</p>
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

        <div className="rounded-2xl border border-border-low bg-card p-6 shadow-lg">
          <h1 className="text-2xl font-bold mb-2">Enviar SOL Privado</h1>
          <p className="text-sm text-muted mb-6">
            Crie um deposito que so pode ser resgatado com o codigo secreto.
          </p>

          {!magicLink ? (
            <div className="space-y-4">
              {/* Amount */}
              <div>
                <label className="block text-sm font-medium mb-1">Valor (SOL)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={isSending}
                  className="w-full rounded-lg border border-border-low bg-card px-4 py-3 text-lg outline-none transition focus:border-foreground/30 disabled:opacity-60"
                />
              </div>

              {/* Secret Code */}
              <div>
                <label className="block text-sm font-medium mb-1">Codigo Secreto</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Digite ou gere um codigo"
                    value={secretCode}
                    onChange={(e) => setSecretCode(e.target.value)}
                    disabled={isSending}
                    className="flex-1 rounded-lg border border-border-low bg-card px-4 py-3 outline-none transition focus:border-foreground/30 disabled:opacity-60"
                  />
                  <button
                    onClick={generateSecret}
                    disabled={isSending}
                    className="px-4 py-3 rounded-lg border border-border-low bg-cream hover:bg-cream/80 transition font-medium"
                  >
                    Gerar
                  </button>
                </div>
              </div>

              {/* Expiration */}
              <div>
                <label className="block text-sm font-medium mb-1">Expiracao</label>
                <select
                  value={expiresIn}
                  onChange={(e) => setExpiresIn(Number(e.target.value))}
                  disabled={isSending}
                  className="w-full rounded-lg border border-border-low bg-card px-4 py-3 outline-none transition focus:border-foreground/30 disabled:opacity-60"
                >
                  {EXPIRATION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted mt-1">
                  Apos expirar, voce pode recuperar os fundos.
                </p>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleCreateDeposit}
                disabled={isSending || !amount || !secretCode || parseFloat(amount) <= 0}
                className="w-full rounded-lg bg-foreground px-4 py-3 text-lg font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSending ? "Criando..." : "Criar Deposito"}
              </button>
            </div>
          ) : (
            /* Success - Show Magic Link and QR Code */
            <div className="space-y-6">
              <div className="text-center">
                <div className="inline-block p-4 bg-white rounded-xl shadow-sm">
                  <QRCodeSVG value={magicLink} size={200} />
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium">Magic Link</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={magicLink}
                    readOnly
                    className="flex-1 rounded-lg border border-border-low bg-cream/50 px-3 py-2 text-sm font-mono"
                  />
                  <button
                    onClick={() => copyToClipboard(magicLink)}
                    className="px-4 py-2 rounded-lg bg-foreground text-background font-medium hover:opacity-90"
                  >
                    Copiar
                  </button>
                </div>
              </div>

              {depositInfo && (
                <div className="rounded-lg bg-green-50 border border-green-200 p-4 space-y-2">
                  <p className="font-semibold text-green-800">Deposito Criado!</p>
                  <div className="text-xs text-green-700 space-y-1">
                    <p><span className="font-medium">ID:</span> {depositInfo.depositId}</p>
                    <p><span className="font-medium">Codigo:</span> {depositInfo.secret}</p>
                    {depositInfo.expiresAt > 0 && (
                      <p>
                        <span className="font-medium">Expira:</span>{" "}
                        {new Date(depositInfo.expiresAt * 1000).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setMagicLink(null);
                    setDepositInfo(null);
                    setTxStatus(null);
                  }}
                  className="flex-1 rounded-lg border border-border-low px-4 py-3 font-medium hover:bg-cream/50 transition"
                >
                  Criar Novo
                </button>
                <Link
                  href={`/claim/${encodeMagicLink(depositInfo!.depositId, depositInfo!.depositorAddress, depositInfo!.secret)}`}
                  className="flex-1 rounded-lg bg-cream px-4 py-3 font-medium text-center hover:bg-cream/80 transition"
                >
                  Testar Claim
                </Link>
              </div>
            </div>
          )}

          {/* Status */}
          {txStatus && !magicLink && (
            <div className="mt-4 rounded-lg border border-border-low bg-cream/50 px-4 py-3 text-sm whitespace-pre-line">
              {txStatus}
            </div>
          )}
        </div>

        {/* Info Card */}
        <div className="rounded-xl border border-border-low bg-card p-4 text-sm text-muted">
          <p className="font-medium text-foreground mb-2">Como funciona:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Voce cria um deposito com um codigo secreto</li>
            <li>Compartilha o link ou QR code com o destinatario</li>
            <li>O destinatario usa o link para resgatar os SOL</li>
            <li>Se nao for resgatado, voce recupera apos expirar</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
