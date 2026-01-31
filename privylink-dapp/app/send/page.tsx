"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useWalletConnection, useSendTransaction } from "@solana/react-hooks";
import {
  getProgramDerivedAddress,
  getAddressEncoder,
  getU64Encoder,
  getI64Encoder,
  getU32Encoder,
  getBytesEncoder,
  getUtf8Encoder,
  getStructEncoder,
  fixEncoderSize,
  addEncoderSizePrefix,
  AccountRole,
  type Address,
} from "@solana/kit";
import { QRCodeSVG } from "qrcode.react";
import { VAULT_PROGRAM_ADDRESS } from "../generated/vault";
import Link from "next/link";

// Instruction discriminators
const CREATE_PRIVATE_DEPOSIT_DISCRIMINATOR = new Uint8Array([
  18, 31, 68, 39, 24, 0, 251, 139,
]);
const CLAIM_DEPOSIT_DISCRIMINATOR = new Uint8Array([
  201, 106, 1, 224, 122, 144, 210, 155,
]);

const SYSTEM_PROGRAM_ADDRESS = "11111111111111111111111111111111" as Address;
const DEPOSIT_SEED = new Uint8Array([100, 101, 112, 111, 115, 105, 116]); // "deposit"

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
  const searchParams = useSearchParams();
  const { wallet, status } = useWalletConnection();
  const { send, isSending } = useSendTransaction();

  const [activeTab, setActiveTab] = useState<"send" | "claim">("send");
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

  // Claim state
  const [claimDepositId, setClaimDepositId] = useState("");
  const [claimDepositorAddress, setClaimDepositorAddress] = useState("");
  const [claimSecret, setClaimSecret] = useState("");

  const walletAddress = wallet?.account.address;

  // Check URL params for tab
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "claim") {
      setActiveTab("claim");
    }
  }, [searchParams]);

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
      const MIN_RENT = 1_500_000n;
      const MIN_AMOUNT = MIN_RENT + 5_000n;

      if (depositAmount < MIN_AMOUNT) {
        setTxStatus(`Valor minimo: ${Number(MIN_AMOUNT) / Number(LAMPORTS_PER_SOL)} SOL`);
        return;
      }

      const depositId = BigInt(Date.now());
      const expiresAt = expiresIn > 0 ? Math.floor(Date.now() / 1000) + expiresIn : 0;
      const claimHash = await hashSecret(secretCode);

      const depositPda = await getProgramDerivedAddress({
        programAddress: VAULT_PROGRAM_ADDRESS,
        seeds: [
          getBytesEncoder().encode(DEPOSIT_SEED),
          getAddressEncoder().encode(walletAddress as Address),
          getU64Encoder().encode(depositId),
        ],
      });

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

      // Wait for confirmation
      await new Promise(resolve => setTimeout(resolve, 2000));

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

      // Salvar no localStorage para página de refund
      if (typeof window !== "undefined") {
        const stored = JSON.parse(localStorage.getItem("privylink_deposits") || "[]");
        stored.push({
          depositId: depositId.toString(),
          depositor: walletAddress,
          amount: parseFloat(amount),
          expiresAt,
          createdAt: Math.floor(Date.now() / 1000),
          secret: secretCode, // Para poder copiar magic link depois
        });
        localStorage.setItem("privylink_deposits", JSON.stringify(stored));
      }

      setTxStatus(`Deposito criado!\nSignature: ${signature?.slice(0, 20)}...`);
      setAmount("");
      setSecretCode("");

    } catch (err: any) {
      console.error("Erro ao criar deposito:", err);
      setTxStatus(`Erro: ${err?.message || "Erro desconhecido"}`);
    }
  }, [walletAddress, wallet, amount, secretCode, expiresIn, send]);

  const handleClaim = useCallback(async () => {
    if (!walletAddress || !claimDepositId || !claimSecret || !claimDepositorAddress || !wallet) return;

    try {
      setTxStatus("Processando claim...");

      const depositId = BigInt(claimDepositId);

      const depositPda = await getProgramDerivedAddress({
        programAddress: VAULT_PROGRAM_ADDRESS,
        seeds: [
          getBytesEncoder().encode(DEPOSIT_SEED),
          getAddressEncoder().encode(claimDepositorAddress as Address),
          getU64Encoder().encode(depositId),
        ],
      });

      const instructionDataEncoder = getStructEncoder([
        ["discriminator", fixEncoderSize(getBytesEncoder(), 8)],
        ["depositId", getU64Encoder()],
        ["secret", addEncoderSizePrefix(getUtf8Encoder(), getU32Encoder())],
      ]);

      const instructionData = instructionDataEncoder.encode({
        discriminator: CLAIM_DEPOSIT_DISCRIMINATOR,
        depositId,
        secret: claimSecret,
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

      setTxStatus(`Resgatado com sucesso!\n\nOs SOL foram transferidos para sua wallet.\n\nSignature: ${signature?.slice(0, 20)}...`);
      setClaimDepositId("");
      setClaimDepositorAddress("");
      setClaimSecret("");

    } catch (err: any) {
      console.error("Erro no claim:", err);
      let errorMessage = err?.message || "Erro desconhecido";

      if (errorMessage.includes("InvalidSecret")) {
        errorMessage = "Codigo secreto invalido!";
      } else if (errorMessage.includes("AlreadyClaimed")) {
        errorMessage = "Este deposito ja foi resgatado!";
      } else if (errorMessage.includes("DepositExpired")) {
        errorMessage = "Este deposito expirou.";
      }

      setTxStatus(`Erro: ${errorMessage}`);
    }
  }, [walletAddress, wallet, claimDepositId, claimSecret, claimDepositorAddress, send]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setTxStatus("Copiado!");
  };

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

          <div className="glass-card p-8">
            <h1 className="text-2xl font-bold mb-4 text-gradient">PrivyLink</h1>
            <p className="text-muted mb-6">Conecte sua wallet para continuar.</p>

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
        <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-sol-green/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-xl mx-auto px-6 py-12 space-y-6">
        <Link href="/" className="btn-ghost inline-flex items-center gap-2">
          ← Voltar
        </Link>

        <div className="glass-card overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-border">
            <button
              onClick={() => { setActiveTab("send"); setTxStatus(null); }}
              className={`flex-1 px-6 py-4 text-sm font-semibold transition-colors ${
                activeTab === "send"
                  ? "text-sol-purple border-b-2 border-sol-purple bg-sol-purple/5"
                  : "text-muted hover:text-foreground"
              }`}
            >
              📤 Enviar
            </button>
            <button
              onClick={() => { setActiveTab("claim"); setTxStatus(null); }}
              className={`flex-1 px-6 py-4 text-sm font-semibold transition-colors ${
                activeTab === "claim"
                  ? "text-sol-green border-b-2 border-sol-green bg-sol-green/5"
                  : "text-muted hover:text-foreground"
              }`}
            >
              📥 Resgatar
            </button>
          </div>

          <div className="p-6">
            {activeTab === "send" && !magicLink && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold mb-1">Criar Deposito</h2>
                  <p className="text-sm text-muted">
                    Envie SOL que so pode ser resgatado com o codigo secreto.
                  </p>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium mb-2">Valor (SOL)</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0.1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={isSending}
                    className="input text-lg"
                  />
                </div>

                {/* Secret Code */}
                <div>
                  <label className="block text-sm font-medium mb-2">Codigo Secreto</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Digite ou gere um codigo"
                      value={secretCode}
                      onChange={(e) => setSecretCode(e.target.value)}
                      disabled={isSending}
                      className="input flex-1"
                    />
                    <button
                      onClick={generateSecret}
                      disabled={isSending}
                      className="btn-secondary whitespace-nowrap"
                    >
                      Gerar
                    </button>
                  </div>
                </div>

                {/* Expiration */}
                <div>
                  <label className="block text-sm font-medium mb-2">Expiracao</label>
                  <select
                    value={expiresIn}
                    onChange={(e) => setExpiresIn(Number(e.target.value))}
                    disabled={isSending}
                    className="input"
                  >
                    {EXPIRATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted mt-2">
                    Apos expirar, voce pode recuperar os fundos na pagina Recuperar.
                  </p>
                </div>

                {/* Submit Button */}
                <button
                  onClick={handleCreateDeposit}
                  disabled={isSending || !amount || !secretCode || parseFloat(amount) <= 0}
                  className="btn-primary w-full"
                >
                  {isSending ? "Criando..." : "Criar Deposito"}
                </button>
              </div>
            )}

            {activeTab === "send" && magicLink && (
              /* Success - Show Magic Link and QR Code */
              <div className="space-y-6">
                <div className="text-center">
                  <div className="inline-block p-4 bg-white rounded-xl">
                    <QRCodeSVG value={magicLink} size={180} />
                  </div>
                  <p className="text-sm text-muted mt-3">Escaneie para resgatar</p>
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-medium">Magic Link</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={magicLink}
                      readOnly
                      className="input flex-1 text-xs font-mono"
                    />
                    <button
                      onClick={() => copyToClipboard(magicLink)}
                      className="btn-primary whitespace-nowrap"
                    >
                      Copiar
                    </button>
                  </div>
                </div>

                {depositInfo && (
                  <div className="card-section border-sol-green/30 bg-sol-green/5 space-y-2">
                    <p className="font-semibold text-sol-green">Deposito Criado!</p>
                    <div className="text-sm text-muted space-y-1">
                      <p><span className="font-medium text-foreground">ID:</span> {depositInfo.depositId}</p>
                      <p><span className="font-medium text-foreground">Codigo:</span> <span className="font-mono text-sol-purple">{depositInfo.secret}</span></p>
                      {depositInfo.expiresAt > 0 && (
                        <p>
                          <span className="font-medium text-foreground">Expira:</span>{" "}
                          {new Date(depositInfo.expiresAt * 1000).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    setMagicLink(null);
                    setDepositInfo(null);
                    setTxStatus(null);
                  }}
                  className="btn-secondary w-full"
                >
                  Criar Novo Deposito
                </button>
              </div>
            )}

            {activeTab === "claim" && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold mb-1">Resgatar Deposito</h2>
                  <p className="text-sm text-muted">
                    Digite as informacoes do deposito para resgatar os SOL.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Deposit ID</label>
                  <input
                    type="text"
                    placeholder="Ex: 1706456789000"
                    value={claimDepositId}
                    onChange={(e) => setClaimDepositId(e.target.value)}
                    disabled={isSending}
                    className="input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Endereco do Depositante</label>
                  <input
                    type="text"
                    placeholder="Ex: 7xKX..."
                    value={claimDepositorAddress}
                    onChange={(e) => setClaimDepositorAddress(e.target.value)}
                    disabled={isSending}
                    className="input font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Codigo Secreto</label>
                  <input
                    type="text"
                    placeholder="O codigo que voce recebeu"
                    value={claimSecret}
                    onChange={(e) => setClaimSecret(e.target.value)}
                    disabled={isSending}
                    className="input"
                  />
                </div>

                <button
                  onClick={handleClaim}
                  disabled={isSending || !claimDepositId || !claimSecret || !claimDepositorAddress}
                  className="btn-primary w-full"
                >
                  {isSending ? "Processando..." : "Resgatar SOL"}
                </button>

                <p className="text-xs text-muted text-center">
                  Recebeu um Magic Link? Basta abrir o link diretamente.
                </p>
              </div>
            )}

            {/* Status */}
            {txStatus && (
              <div className={`mt-6 card-section text-sm whitespace-pre-line ${
                txStatus.includes("sucesso") || txStatus.includes("Criado")
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

        {/* Info Card */}
        <div className="glass-card p-6 text-sm text-muted">
          <p className="font-medium text-foreground mb-3">Como funciona:</p>
          <ol className="list-decimal list-inside space-y-2">
            <li>Voce cria um deposito com um codigo secreto</li>
            <li>Compartilha o Magic Link ou QR code</li>
            <li>O destinatario usa o link para resgatar</li>
            <li>Se nao for resgatado, voce recupera apos expirar</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
