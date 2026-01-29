"use client";

import { useState, useCallback, useEffect } from "react";
import {
  useWalletConnection,
  useSendTransaction,
  useTransactionPool,
} from "@solana/react-hooks";
import {
  getProgramDerivedAddress,
  getAddressEncoder,
  AccountRole,
  type Address,
} from "@solana/kit";
import {
  getCreatePrivateDepositInstructionAsync,
  VAULT_PROGRAM_ADDRESS,
} from "../generated/vault";

const LAMPORTS_PER_SOL = 1_000_000_000n;

// Magic Link data interface
interface MagicLinkData {
  depositor: string;
  depositId: string;
  secret?: string;
}

export function VaultCard() {
  const { wallet, status } = useWalletConnection();
  const { send, isSending } = useSendTransaction();
  const txPool = useTransactionPool();

  // Create deposit states
  const [amount, setAmount] = useState("");
  const [secretCode, setSecretCode] = useState("");

  // Claim deposit states
  const [claimDepositor, setClaimDepositor] = useState("");
  const [claimDepositId, setClaimDepositId] = useState("");
  const [claimSecret, setClaimSecret] = useState("");

  // UI states
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const [lastDepositSecret, setLastDepositSecret] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"create" | "claim">("create");

  const walletAddress = wallet?.account.address;
  const [programDeployed, setProgramDeployed] = useState<boolean | null>(null);

  // Parse Magic Link from URL on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const depositor = params.get("depositor");
    const depositId = params.get("deposit_id") || params.get("id"); // Accept both formats
    const secret = params.get("secret");

    if (depositor && depositId) {
      setClaimDepositor(depositor);
      setClaimDepositId(depositId);
      if (secret) {
        setClaimSecret(secret);
      }
      setActiveTab("claim");

      // Clean URL without reloading
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Check if program is deployed
  useEffect(() => {
    const checkProgramDeployment = async () => {
      try {
        const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
        const response = await fetch(RPC_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getAccountInfo",
            params: [
              VAULT_PROGRAM_ADDRESS,
              { encoding: "base58" }
            ]
          })
        });
        const data = await response.json();
        const isDeployed = data.result?.value !== null;
        setProgramDeployed(isDeployed);

        if (!isDeployed) {
          console.warn("⚠️ PROGRAMA NÃO ESTÁ DEPLOYADO NA DEVNET");
          console.warn("📋 Programa ID:", VAULT_PROGRAM_ADDRESS);
        } else {
          console.log("✅ Programa está deployado:", VAULT_PROGRAM_ADDRESS);
        }
      } catch (err) {
        console.warn("⚠️ Não foi possível verificar o status do deploy:", err);
        setProgramDeployed(null);
      }
    };

    checkProgramDeployment();
  }, []);

  // Hash function for secret code using Web Crypto API
  const hashSecret = async (secret: string): Promise<Uint8Array> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(secret);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return new Uint8Array(hashBuffer);
  };

  // Generate Magic Link
  const generateMagicLink = (depositor: string, depositId: string, includeSecret?: string): string => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const params = new URLSearchParams({
      depositor,
      deposit_id: depositId,
    });
    if (includeSecret) {
      params.set("secret", includeSecret);
    }
    return `${baseUrl}?${params.toString()}`;
  };

  // Copy to clipboard helper
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setTxStatus(`✅ ${label} copiado!`);
      setTimeout(() => setTxStatus(null), 2000);
    } catch {
      setTxStatus(`❌ Erro ao copiar. Copie manualmente:\n${text}`);
    }
  };

  const handleCreatePrivateDeposit = useCallback(async () => {
    if (!walletAddress || !amount || !secretCode || !wallet) return;

    try {
      setTxStatus("Construindo transação...");
      setMagicLink(null);
      setLastDepositSecret(null);

      const depositAmount = BigInt(
        Math.floor(parseFloat(amount) * Number(LAMPORTS_PER_SOL))
      );

      const MIN_RENT = 1_440_000n;
      const MIN_AMOUNT = MIN_RENT + 5_000n;

      if (depositAmount < MIN_AMOUNT) {
        setTxStatus(
          `❌ Valor muito baixo!\nMínimo: ${Number(MIN_AMOUNT) / Number(LAMPORTS_PER_SOL)} SOL\n(para cobrir rent + taxas)`
        );
        return;
      }

      const depositId = BigInt(Date.now());
      const claimHash = await hashSecret(secretCode);

      console.log("📦 Criando depósito:", {
        depositId: depositId.toString(),
        amount: depositAmount.toString(),
        depositor: walletAddress,
      });

      const instruction = await getCreatePrivateDepositInstructionAsync({
        depositor: walletAddress as any,
        depositId,
        amount: depositAmount,
        claimHash: claimHash as any,
      });

      setTxStatus("Aguardando assinatura...");

      const signature = await send({
        instructions: [instruction],
      });

      // Generate Magic Link after successful deposit
      const link = generateMagicLink(walletAddress, depositId.toString());
      setMagicLink(link);
      setLastDepositSecret(secretCode);

      setTxStatus(
        `✅ Depósito criado com sucesso!\n\n` +
        `📋 ID: ${depositId.toString()}\n` +
        `💰 Valor: ${amount} SOL\n` +
        `🔗 Signature: ${signature?.slice(0, 20)}...\n\n` +
        `⬇️ Use os botões abaixo para copiar o Magic Link e o código secreto.`
      );

      setAmount("");
      setSecretCode("");
    } catch (err: any) {
      console.error("❌ Create deposit failed:", err);

      let errorMessage = "Erro desconhecido";

      if (err?.message) {
        errorMessage = err.message;
      }

      if (errorMessage.includes("transaction plan") || errorMessage.includes("failed to execute") || errorMessage.includes("simulation failed")) {
        const programStatus = programDeployed === false
          ? "❌ PROGRAMA NÃO ESTÁ DEPLOYADO NA DEVNET!"
          : programDeployed === true
          ? "✅ Programa está deployado"
          : "⚠️ Status do deploy desconhecido";

        errorMessage = `❌ Falha ao executar transação\n\n${programStatus}\n\n💡 Possíveis causas:\n1. Programa não deployado\n2. Saldo insuficiente\n3. Wallet não está em Devnet`;
      }

      setTxStatus(errorMessage);
    }
  }, [walletAddress, wallet, amount, secretCode, send, programDeployed]);

  const handleClaimDeposit = useCallback(async () => {
    if (!walletAddress || !claimDepositId || !claimSecret || !claimDepositor || !wallet) return;

    try {
      setTxStatus("Construindo transação de claim...");

      const depositId = BigInt(claimDepositId);
      const depositorAddress = claimDepositor as Address;

      // Calculate PDA properly
      const depositIdBytes = new Uint8Array(8);
      const view = new DataView(depositIdBytes.buffer);
      view.setBigUint64(0, depositId, true); // little-endian

      const addressEncoder = getAddressEncoder();
      const depositorBytes = addressEncoder.encode(depositorAddress);

      const [calculatedPda] = await getProgramDerivedAddress({
        programAddress: VAULT_PROGRAM_ADDRESS,
        seeds: [
          new TextEncoder().encode("deposit"),
          depositorBytes,
          depositIdBytes,
        ],
      });

      // Also check known PDAs for comparison (with correct deposit IDs!)
      const knownPdas: Record<string, string> = {
        "1769705194651": "4mfneNYAYKeh9tLUVgHTuch1mnLvCAtS42rVHmBaU9xK", // 0.2 SOL deposit
        "1769702881159": "885qL44GUhzdWnTHscNVraYyDxmiS3JHUndyjYRk7s1p",
      };

      const knownPda = knownPdas[depositId.toString()];
      // Use calculated PDA - it should now work correctly!
      const depositPda = calculatedPda;

      console.log("🔓 PDA Debug:", {
        depositId: depositId.toString(),
        calculatedPda,
        knownPda,
        match: calculatedPda === knownPda,
        usingPda: depositPda,
      });

      console.log("🔓 Claiming deposit:", {
        depositId: depositId.toString(),
        depositor: depositorAddress,
        depositPda,
        claimer: walletAddress,
        secret: claimSecret,
      });

      // Build instruction data COMPLETELY manually
      // Discriminator for claim_deposit = SHA256("global:claim_deposit")[0:8]
      const discriminator = new Uint8Array([201, 106, 1, 224, 122, 144, 210, 155]);

      // deposit_id as u64 little-endian (reuse depositIdBytes from PDA calculation)

      // secret as Borsh string: u32 length + UTF-8 bytes
      const secretBytes = new TextEncoder().encode(claimSecret);
      const secretLengthBytes = new Uint8Array(4);
      new DataView(secretLengthBytes.buffer).setUint32(0, secretBytes.length, true);

      // Combine all: discriminator + deposit_id + secret_length + secret_data
      const instructionData = new Uint8Array(
        discriminator.length + depositIdBytes.length + secretLengthBytes.length + secretBytes.length
      );
      let offset = 0;
      instructionData.set(discriminator, offset); offset += discriminator.length;
      instructionData.set(depositIdBytes, offset); offset += depositIdBytes.length;
      instructionData.set(secretLengthBytes, offset); offset += secretLengthBytes.length;
      instructionData.set(secretBytes, offset);

      console.log("📋 Manual instruction data hex:",
        Array.from(instructionData).map(b => b.toString(16).padStart(2, '0')).join('')
      );

      const instruction = {
        programAddress: VAULT_PROGRAM_ADDRESS,
        accounts: [
          {
            address: walletAddress as Address,
            role: AccountRole.WRITABLE_SIGNER,
          },
          {
            address: depositPda,
            role: AccountRole.WRITABLE,
          },
          {
            address: "11111111111111111111111111111111" as Address,
            role: AccountRole.READONLY,
          },
        ],
        data: instructionData,
      };

      console.log("📋 Instruction built manually");

      setTxStatus("Aguardando assinatura...");

      const signature = await send({
        instructions: [instruction],
      });

      setTxStatus(
        `✅ Claim realizado com sucesso!\n\n` +
        `🎉 Os fundos foram transferidos para sua wallet.\n` +
        `🔗 Signature: ${signature?.slice(0, 20)}...`
      );

      setClaimDepositor("");
      setClaimDepositId("");
      setClaimSecret("");
    } catch (err: any) {
      console.error("❌ Claim deposit failed:", err);

      let errorMessage = err?.message || "Erro desconhecido";

      // Decode Anchor error codes
      if (errorMessage.includes("#2006")) {
        errorMessage = "❌ Erro #2006: ConstraintMut\n\nA conta deposit não está marcada como mutável na transação.";
      } else if (errorMessage.includes("#3012")) {
        errorMessage = "❌ Erro #3012: ConstraintSeeds\n\nO PDA derivado não corresponde ao esperado.";
      } else if (errorMessage.includes("InvalidSecret") || errorMessage.includes("invalid secret") || errorMessage.includes("#6001")) {
        errorMessage = "❌ Código secreto inválido!\n\nVerifique se o código está correto.";
      } else if (errorMessage.includes("AlreadyClaimed") || errorMessage.includes("already claimed") || errorMessage.includes("#6000")) {
        errorMessage = "❌ Este depósito já foi resgatado!";
      } else if (errorMessage.includes("AccountNotFound") || errorMessage.includes("not found")) {
        errorMessage = "❌ Depósito não encontrado!\n\nVerifique o ID e o endereço do depositante.";
      }

      setTxStatus(errorMessage);
    }
  }, [walletAddress, wallet, claimDepositId, claimSecret, claimDepositor, send]);

  if (status !== "connected") {
    return (
      <section className="w-full max-w-3xl space-y-4 rounded-2xl border border-border-low bg-card p-6 shadow-[0_20px_80px_-50px_rgba(0,0,0,0.35)]">
        <div className="space-y-1">
          <p className="text-lg font-semibold">PrivyLink</p>
          <p className="text-sm text-muted">
            Conecte sua wallet para criar depósitos privados ou resgatar existentes.
          </p>
        </div>
        <div className="rounded-lg bg-yellow-100/50 border border-yellow-300/50 p-4 text-sm">
          <p className="font-semibold text-yellow-800 mb-2">⚠️ Configure sua wallet para DEVNET</p>
          <p className="text-yellow-700 text-xs">
            <strong>Phantom:</strong> Settings → Developer Mode → Devnet<br/>
            <strong>Solflare:</strong> Settings → Network → Devnet
          </p>
        </div>
        <div className="rounded-lg bg-cream/50 p-4 text-center text-sm text-muted">
          Wallet não conectada
        </div>
      </section>
    );
  }

  return (
    <section className="w-full max-w-3xl space-y-6 rounded-2xl border border-border-low bg-card p-6 shadow-[0_20px_80px_-50px_rgba(0,0,0,0.35)]">
      <div className="space-y-1">
        <p className="text-lg font-semibold">PrivyLink</p>
        <p className="text-sm text-muted">
          Transferências privadas de SOL usando códigos secretos.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-border-low pb-2">
        <button
          onClick={() => setActiveTab("create")}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${
            activeTab === "create"
              ? "bg-foreground text-background"
              : "text-muted hover:text-foreground"
          }`}
        >
          Criar Depósito
        </button>
        <button
          onClick={() => setActiveTab("claim")}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${
            activeTab === "claim"
              ? "bg-foreground text-background"
              : "text-muted hover:text-foreground"
          }`}
        >
          Resgatar (Claim)
        </button>
      </div>

      {/* Create Private Deposit Tab */}
      {activeTab === "create" && (
        <div className="space-y-3 rounded-xl border border-border-low bg-cream/30 p-4">
          <p className="text-sm font-semibold">Criar Depósito Privado</p>
          <p className="text-xs text-muted">
            Deposite SOL e compartilhe o Magic Link + código secreto com o destinatário.
          </p>
          <div className="space-y-2">
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Valor em SOL"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isSending}
              className="w-full rounded-lg border border-border-low bg-card px-4 py-2.5 text-sm outline-none transition placeholder:text-muted focus:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <input
              type="text"
              placeholder="Código secreto (guarde bem!)"
              value={secretCode}
              onChange={(e) => setSecretCode(e.target.value)}
              disabled={isSending}
              className="w-full rounded-lg border border-border-low bg-card px-4 py-2.5 text-sm outline-none transition placeholder:text-muted focus:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              onClick={handleCreatePrivateDeposit}
              disabled={isSending || !amount || !secretCode || parseFloat(amount) <= 0}
              className="w-full rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSending ? "Criando..." : "Criar Depósito"}
            </button>
          </div>

          {/* Magic Link & Secret Copy Buttons */}
          {magicLink && lastDepositSecret && (
            <div className="mt-4 space-y-2 p-3 rounded-lg bg-green-50 border border-green-200">
              <p className="text-xs font-semibold text-green-800">
                🎉 Depósito criado! Compartilhe com o destinatário:
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => copyToClipboard(magicLink, "Magic Link")}
                  className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 transition"
                >
                  📋 Copiar Magic Link
                </button>
                <button
                  onClick={() => copyToClipboard(lastDepositSecret, "Código secreto")}
                  className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 transition"
                >
                  🔑 Copiar Código Secreto
                </button>
              </div>
              <button
                onClick={() => copyToClipboard(`${magicLink}&secret=${encodeURIComponent(lastDepositSecret)}`, "Link completo")}
                className="w-full rounded-lg bg-purple-600 px-3 py-2 text-xs font-medium text-white hover:bg-purple-700 transition"
              >
                🔗 Copiar Link Completo (com código)
              </button>
              <p className="text-[10px] text-green-700 mt-1">
                ⚠️ O link completo inclui o código secreto. Use apenas em canais seguros.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Claim Deposit Tab */}
      {activeTab === "claim" && (
        <div className="space-y-3 rounded-xl border border-border-low bg-cream/30 p-4">
          <p className="text-sm font-semibold">Resgatar Depósito</p>
          <p className="text-xs text-muted">
            Cole o Magic Link ou preencha os campos manualmente.
          </p>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Endereço do depositante"
              value={claimDepositor}
              onChange={(e) => setClaimDepositor(e.target.value)}
              disabled={isSending}
              className="w-full rounded-lg border border-border-low bg-card px-4 py-2.5 text-sm outline-none transition placeholder:text-muted focus:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-60 font-mono text-xs"
            />
            <input
              type="text"
              placeholder="ID do depósito"
              value={claimDepositId}
              onChange={(e) => setClaimDepositId(e.target.value)}
              disabled={isSending}
              className="w-full rounded-lg border border-border-low bg-card px-4 py-2.5 text-sm outline-none transition placeholder:text-muted focus:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <input
              type="text"
              placeholder="Código secreto"
              value={claimSecret}
              onChange={(e) => setClaimSecret(e.target.value)}
              disabled={isSending}
              className="w-full rounded-lg border border-border-low bg-card px-4 py-2.5 text-sm outline-none transition placeholder:text-muted focus:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              onClick={handleClaimDeposit}
              disabled={isSending || !claimDepositId || !claimSecret || !claimDepositor}
              className="w-full rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSending ? "Resgatando..." : "Resgatar Fundos"}
            </button>
          </div>
        </div>
      )}

      {/* Status */}
      {txStatus && (
        <div className="rounded-lg border border-border-low bg-cream/50 px-4 py-3 text-sm whitespace-pre-line">
          {txStatus}
        </div>
      )}

      {/* Program Deployment Status */}
      {programDeployed === false && (
        <div className="rounded-lg bg-red-100/50 border border-red-300/50 p-3 text-xs">
          <p className="font-semibold text-red-800 mb-1">❌ PROGRAMA NÃO ESTÁ DEPLOYADO</p>
          <p className="text-red-700">
            Execute: <code className="bg-red-100 px-1 rounded">cd anchor && anchor deploy --provider.cluster devnet</code>
          </p>
        </div>
      )}

      {/* Network Warning */}
      <div className="rounded-lg bg-yellow-100/50 border border-yellow-300/50 p-3 text-xs">
        <p className="font-semibold text-yellow-800 mb-1">⚠️ DEVNET (Rede de Testes)</p>
        <p className="text-yellow-700">
          Programa: <code className="font-mono text-[10px]">{VAULT_PROGRAM_ADDRESS}</code>
        </p>
      </div>
    </section>
  );
}
