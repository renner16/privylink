"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
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
  { label: "1 hora", value: 3600, icon: "⏱️" },
  { label: "24 horas", value: 86400, icon: "📅" },
  { label: "7 dias", value: 604800, icon: "📆" },
  { label: "30 dias", value: 2592000, icon: "🗓️" },
  { label: "Nunca expira", value: 0, icon: "♾️" },
];

// Generate magic link code (base64 encoded)
function encodeMagicLink(depositId: string, depositorAddress: string, secret: string): string {
  const data = `${depositId}:${depositorAddress}:${secret}`;
  return btoa(data).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function SendPageContent() {
  const searchParams = useSearchParams();
  const { wallet, status, connectors, connect } = useWalletConnection();
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
      setTxStatus("Criando depósito...");
      setMagicLink(null);
      setDepositInfo(null);

      const depositAmount = BigInt(
        Math.floor(parseFloat(amount) * Number(LAMPORTS_PER_SOL))
      );

      // Validate minimum amount
      const MIN_RENT = 1_500_000n;
      const MIN_AMOUNT = MIN_RENT + 5_000n;

      if (depositAmount < MIN_AMOUNT) {
        setTxStatus(`Valor mínimo: ${Number(MIN_AMOUNT) / Number(LAMPORTS_PER_SOL)} SOL`);
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

      setTxStatus(`Depósito criado!\nSignature: ${signature?.slice(0, 20)}...`);
      setAmount("");
      setSecretCode("");

    } catch (err: any) {
      console.error("Erro ao criar depósito:", err);
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
        errorMessage = "Código secreto inválido!";
      } else if (errorMessage.includes("AlreadyClaimed")) {
        errorMessage = "Este depósito já foi resgatado!";
      } else if (errorMessage.includes("DepositExpired")) {
        errorMessage = "Este depósito expirou.";
      }

      setTxStatus(`Erro: ${errorMessage}`);
    }
  }, [walletAddress, wallet, claimDepositId, claimSecret, claimDepositorAddress, send]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setTxStatus("Copiado!");
  };

  // Not connected
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
          <Link href="/" className="btn-ghost inline-flex items-center gap-2 mb-8">
            ← Voltar
          </Link>

          <div className="glass-card p-8">
            <div className="text-center mb-8">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-sol-purple to-sol-green flex items-center justify-center text-4xl mx-auto mb-4 glow-purple">
                🔐
              </div>
              <h1 className="text-3xl font-bold mb-2 text-gradient">PrivyLink</h1>
              <p className="text-muted">Conecte sua wallet para continuar</p>
            </div>

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

            <div className="card-section border-sol-purple/30 bg-sol-purple/5 mt-6">
              <div className="flex items-start gap-3">
                <span className="text-xl">⚠️</span>
                <div>
                  <p className="font-semibold text-sol-purple-light mb-1">Rede de Testes</p>
                  <p className="text-xs text-muted">
                    Configure sua wallet para <strong>Solana Devnet</strong>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary relative">
      {/* Background Effects */}
      <div className="hero-glow" />
      <div className="fixed inset-0 grid-pattern opacity-30 pointer-events-none" />
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb-purple w-[500px] h-[500px] top-[-20%] left-[-10%]" />
        <div className="floating-orb-green w-[400px] h-[400px] bottom-[-10%] right-[-10%]" style={{ animationDelay: '-3s' }} />
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
              className={`flex-1 px-6 py-4 font-semibold transition-all relative ${
                activeTab === "send"
                  ? "text-sol-purple"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <span>📤</span>
                <span>Enviar</span>
              </span>
              {activeTab === "send" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-sol-purple to-sol-green" />
              )}
            </button>
            <button
              onClick={() => { setActiveTab("claim"); setTxStatus(null); }}
              className={`flex-1 px-6 py-4 font-semibold transition-all relative ${
                activeTab === "claim"
                  ? "text-sol-green"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <span>📥</span>
                <span>Resgatar</span>
              </span>
              {activeTab === "claim" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-sol-green to-sol-blue" />
              )}
            </button>
          </div>

          <div className="p-6">
            {/* ===== SEND TAB ===== */}
            {activeTab === "send" && !magicLink && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Criar Depósito Privado</h2>
                  <p className="text-sm text-muted">
                    Envie SOL que só pode ser resgatado com o código secreto
                  </p>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-semibold mb-2">Valor (SOL)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="0.1"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      disabled={isSending}
                      className="input text-2xl font-bold pr-16"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted font-semibold">
                      SOL
                    </span>
                  </div>
                </div>

                {/* Secret Code */}
                <div>
                  <label className="block text-sm font-semibold mb-2">Código Secreto</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Digite ou gere um código"
                      value={secretCode}
                      onChange={(e) => setSecretCode(e.target.value)}
                      disabled={isSending}
                      className="input flex-1 font-mono text-lg tracking-wider"
                    />
                    <button
                      onClick={generateSecret}
                      disabled={isSending}
                      className="btn-secondary whitespace-nowrap flex items-center gap-2"
                    >
                      <span>🎲</span>
                      <span>Gerar</span>
                    </button>
                  </div>
                  <p className="text-xs text-muted-dark mt-2">
                    Este código será necessário para resgatar os fundos
                  </p>
                </div>

                {/* Expiration */}
                <div>
                  <label className="block text-sm font-semibold mb-2">Expiração</label>
                  <select
                    value={expiresIn}
                    onChange={(e) => setExpiresIn(Number(e.target.value))}
                    disabled={isSending}
                    className="input"
                  >
                    {EXPIRATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.icon} {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-dark mt-2">
                    Após expirar, você pode recuperar os fundos na página "Meus Depósitos"
                  </p>
                </div>

                {/* Submit Button */}
                <button
                  onClick={handleCreateDeposit}
                  disabled={isSending || !amount || !secretCode || parseFloat(amount) <= 0}
                  className="btn-primary w-full text-lg py-4 flex items-center justify-center gap-3"
                >
                  {isSending ? (
                    <>
                      <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                      <span>Criando...</span>
                    </>
                  ) : (
                    <>
                      <span>🚀</span>
                      <span>Criar Depósito</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* ===== SUCCESS - MAGIC LINK ===== */}
            {activeTab === "send" && magicLink && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="inline-block p-4 bg-white rounded-2xl glow-green mb-4">
                    <QRCodeSVG value={magicLink} size={200} />
                  </div>
                  <p className="text-sm text-muted">Escaneie o QR code para resgatar</p>
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-semibold">Magic Link</label>
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
                      📋 Copiar
                    </button>
                  </div>
                </div>

                {depositInfo && (
                  <div className="card-section border-sol-green/30 bg-sol-green/5 space-y-3">
                    <div className="flex items-center gap-2 text-sol-green font-semibold">
                      <span>✅</span>
                      <span>Depósito Criado com Sucesso!</span>
                    </div>
                    <div className="text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted">ID:</span>
                        <span className="font-mono">{depositInfo.depositId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Código:</span>
                        <span className="font-mono text-sol-purple-light font-bold">{depositInfo.secret}</span>
                      </div>
                      {depositInfo.expiresAt > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted">Expira:</span>
                          <span>{new Date(depositInfo.expiresAt * 1000).toLocaleString()}</span>
                        </div>
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
                  Criar Novo Depósito
                </button>
              </div>
            )}

            {/* ===== CLAIM TAB ===== */}
            {activeTab === "claim" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Resgatar Depósito</h2>
                  <p className="text-sm text-muted">
                    Digite as informações do depósito para resgatar os SOL
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Deposit ID</label>
                  <input
                    type="text"
                    placeholder="Ex: 1706456789000"
                    value={claimDepositId}
                    onChange={(e) => setClaimDepositId(e.target.value)}
                    disabled={isSending}
                    className="input font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Endereço do Depositante</label>
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
                  <label className="block text-sm font-semibold mb-2">Código Secreto</label>
                  <input
                    type="text"
                    placeholder="O código que você recebeu"
                    value={claimSecret}
                    onChange={(e) => setClaimSecret(e.target.value)}
                    disabled={isSending}
                    className="input font-mono text-lg tracking-wider"
                  />
                </div>

                <button
                  onClick={handleClaim}
                  disabled={isSending || !claimDepositId || !claimSecret || !claimDepositorAddress}
                  className="btn-primary w-full text-lg py-4 flex items-center justify-center gap-3"
                >
                  {isSending ? (
                    <>
                      <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                      <span>Processando...</span>
                    </>
                  ) : (
                    <>
                      <span>🎁</span>
                      <span>Resgatar SOL</span>
                    </>
                  )}
                </button>

                <div className="card-section text-center">
                  <p className="text-sm text-muted">
                    💡 Recebeu um <span className="text-sol-purple-light font-semibold">Magic Link</span>?
                    Basta abrir o link diretamente!
                  </p>
                </div>
              </div>
            )}

            {/* Status */}
            {txStatus && (
              <div className={`mt-6 card-section text-sm whitespace-pre-line ${
                txStatus.includes("sucesso") || txStatus.includes("Criado") || txStatus.includes("Copiado")
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
        <div className="glass-card p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-sol-purple/15 border border-sol-purple/30 flex items-center justify-center flex-shrink-0">
              <span>💡</span>
            </div>
            <div>
              <p className="font-semibold mb-2">Como funciona:</p>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted">
                <li>Você cria um depósito com um código secreto</li>
                <li>Compartilha o Magic Link ou QR code</li>
                <li>O destinatário usa o link para resgatar</li>
                <li>Se não for resgatado, você recupera após expirar</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SendPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-sol-purple border-t-transparent rounded-full" />
      </div>
    }>
      <SendPageContent />
    </Suspense>
  );
}
