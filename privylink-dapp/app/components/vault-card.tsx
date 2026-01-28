"use client";

import { useState, useCallback, useEffect } from "react";
import {
  useWalletConnection,
  useSendTransaction,
} from "@solana/react-hooks";
import {
  getProgramDerivedAddress,
  getAddressEncoder,
  getBytesEncoder,
  getU64Encoder,
  getI64Encoder,
  getU32Encoder,
  getUtf8Encoder,
  addEncoderSizePrefix,
  getStructEncoder,
  fixEncoderSize,
  AccountRole,
  type Address,
} from "@solana/kit";

// "deposit" as bytes for PDA derivation
const DEPOSIT_SEED = new Uint8Array([100, 101, 112, 111, 115, 105, 116]);
import { VAULT_PROGRAM_ADDRESS } from "../generated/vault";

// Instruction discriminators
const CREATE_PRIVATE_DEPOSIT_DISCRIMINATOR = new Uint8Array([
  18, 31, 68, 39, 24, 0, 251, 139,
]);
const CLAIM_DEPOSIT_DISCRIMINATOR = new Uint8Array([
  201, 106, 1, 224, 122, 144, 210, 155,
]);

const LAMPORTS_PER_SOL = 1_000_000_000n;
const SYSTEM_PROGRAM_ADDRESS = "11111111111111111111111111111111" as Address;

export function VaultCard() {
  const { wallet, status } = useWalletConnection();
  const { send, isSending } = useSendTransaction();

  const [amount, setAmount] = useState("");
  const [secretCode, setSecretCode] = useState("");
  const [claimDepositId, setClaimDepositId] = useState("");
  const [claimSecret, setClaimSecret] = useState("");
  const [claimDepositorAddress, setClaimDepositorAddress] = useState("");
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [lastDepositInfo, setLastDepositInfo] = useState<{
    depositId: string;
    depositorAddress: string;
  } | null>(null);

  const walletAddress = wallet?.account.address;
  const [programDeployed, setProgramDeployed] = useState<boolean | null>(null);

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
          console.warn("💡 Para fazer deploy:");
          console.warn("   1. cd privylink-dapp/anchor");
          console.warn("   2. anchor deploy --provider.cluster devnet");
          console.warn("   (Veja GUIA_DEPLOY.md para instruções completas)");
        } else {
          console.log("✅ Programa está deployado:", VAULT_PROGRAM_ADDRESS);
        }
      } catch (err) {
        console.warn("⚠️ Não foi possível verificar o status do deploy do programa:", err);
        setProgramDeployed(null);
      }
    };

    checkProgramDeployment();
  }, []);

  // Debug: Log wallet and network info
  useEffect(() => {
    if (walletAddress) {
      console.log("👛 Wallet conectada:", walletAddress);
      console.log("🔗 RPC Endpoint do app:", process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com");
      console.log("⚠️ IMPORTANTE: Verifique se sua wallet está em DEVNET!");
    }
  }, [walletAddress]);

  // Hash function for secret code using Web Crypto API
  const hashSecret = async (secret: string): Promise<Uint8Array> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(secret);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return new Uint8Array(hashBuffer);
  };

  const handleCreatePrivateDeposit = useCallback(async () => {
    if (!walletAddress || !amount || !secretCode || !wallet) return;

    try {
      setTxStatus("Building transaction...");

      const depositAmount = BigInt(
        Math.floor(parseFloat(amount) * Number(LAMPORTS_PER_SOL))
      );

      // Validate minimum amount (rent + transaction fee)
      // Rent for 82 bytes account ≈ 0.00144 SOL
      const MIN_RENT = 1_440_000n; // lamports
      const MIN_AMOUNT = MIN_RENT + 5_000n; // rent + fee buffer
      
      if (depositAmount < MIN_AMOUNT) {
        setTxStatus(
          `❌ Valor muito baixo!\nMínimo: ${Number(MIN_AMOUNT) / Number(LAMPORTS_PER_SOL)} SOL\n(para cobrir rent + taxas)`
        );
        return;
      }

      // Generate deposit_id from timestamp
      const depositId = BigInt(Date.now());

      // Hash the secret code
      const claimHash = await hashSecret(secretCode);

      console.log("📦 Criando depósito:", {
        depositId: depositId.toString(),
        amount: depositAmount.toString(),
        depositor: walletAddress,
        programId: VAULT_PROGRAM_ADDRESS,
      });

      // Derive the deposit PDA manually
      const depositPda = await getProgramDerivedAddress({
        programAddress: VAULT_PROGRAM_ADDRESS,
        seeds: [
          getBytesEncoder().encode(DEPOSIT_SEED),
          getAddressEncoder().encode(walletAddress as Address),
          getU64Encoder().encode(depositId),
        ],
      });

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
        expiresAt: 0n, // never expires
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

      console.log("✅ Instrução criada:", instruction);

      setTxStatus("Awaiting signature...");

      const signature = await send({
        instructions: [instruction],
      });

      // Save deposit info for easy sharing
      setLastDepositInfo({
        depositId: depositId.toString(),
        depositorAddress: walletAddress,
      });

      setTxStatus(
        `✅ Depósito criado com sucesso!\n\n` +
        `📋 INFORMAÇÕES PARA CLAIM (compartilhe com o destinatário):\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Deposit ID: ${depositId.toString()}\n` +
        `Depositor: ${walletAddress}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `⚠️ SALVE O CÓDIGO SECRETO! Ele não pode ser recuperado.\n\n` +
        `🔗 Signature: ${signature?.slice(0, 20)}...`
      );
      setAmount("");
      setSecretCode("");
    } catch (err: any) {
      console.error("❌ Create deposit failed:", err);
      console.error("❌ Error details:", {
        message: err?.message,
        cause: err?.cause,
        transactionPlanResult: err?.transactionPlanResult,
        name: err?.name,
        stack: err?.stack,
        fullError: err,
      });
      
      // Extract detailed error information
      let errorMessage = "Erro desconhecido";
      
      if (err?.message) {
        errorMessage = err.message;
      } else if (typeof err === "string") {
        errorMessage = err;
      }

      // Check for transaction plan errors (most common)
      if (errorMessage.includes("transaction plan") || errorMessage.includes("failed to execute") || errorMessage.includes("simulation failed")) {
        const cause = err?.cause?.message || err?.cause || "";
        const planResult = err?.transactionPlanResult;
        
        // Extract more details from the error
        let detailedCause = "";
        if (err?.cause) {
          if (typeof err.cause === "string") {
            detailedCause = err.cause;
          } else if (err.cause?.message) {
            detailedCause = err.cause.message;
          } else {
            detailedCause = JSON.stringify(err.cause, null, 2);
          }
        }
        
        // Check if program is deployed
        const programStatus = programDeployed === false 
          ? "❌ PROGRAMA NÃO ESTÁ DEPLOYADO NA DEVNET!"
          : programDeployed === true
          ? "✅ Programa está deployado"
          : "⚠️ Status do deploy desconhecido";
        
        errorMessage = `❌ Falha ao executar transação\n\n🔍 Detalhes:\n${detailedCause || cause || "Transaction simulation failed"}\n\n${programStatus}\n\n💡 Possíveis causas:\n1. ⚠️ PROGRAMA NÃO ESTÁ DEPLOYADO (MAIS PROVÁVEL)\n   → Execute no terminal:\n      cd privylink-dapp/anchor\n      anchor deploy --provider.cluster devnet\n   → Você precisa ter:\n      - Solana CLI instalado\n      - Anchor instalado\n      - ~2 SOL na devnet para deploy\n2. Saldo insuficiente na wallet\n   → Precisa: valor + rent (~0.00144 SOL) + taxa\n   → Faça airdrop: solana airdrop 2 --url devnet\n3. Wallet não está em Devnet\n   → Solflare: Settings → Network → Devnet\n   → Phantom: Settings → Developer Mode → Change Network → Devnet\n4. Programa ID: ${VAULT_PROGRAM_ADDRESS}\n\n📋 Verifique o console (F12) para mais detalhes.`;
        
        if (planResult) {
          console.error("📋 Transaction Plan Result:", planResult);
          errorMessage += `\n\n📋 Resultado do plano: ${JSON.stringify(planResult, null, 2)}`;
        }
      } else if (errorMessage.includes("insufficient") || errorMessage.includes("balance")) {
        errorMessage = `❌ Saldo insuficiente!\n\nVocê precisa de pelo menos ${Number(1_440_000n + 5_000n) / Number(LAMPORTS_PER_SOL)} SOL para criar um depósito.\n\nIsso inclui:\n- Valor do depósito\n- Rent (~0.00144 SOL)\n- Taxa de transação (~0.000005 SOL)`;
      } else if (errorMessage.includes("Program") || errorMessage.includes("program")) {
        errorMessage = `❌ Erro do programa Solana\n\n${errorMessage}\n\n⚠️ O programa pode não estar deployado na devnet.\nExecute: cd anchor && anchor deploy`;
      }

      setTxStatus(errorMessage);
    }
  }, [walletAddress, wallet, amount, secretCode, send]);

  const handleClaimDeposit = useCallback(async () => {
    if (!walletAddress || !claimDepositId || !claimSecret || !claimDepositorAddress || !wallet) return;

    try {
      setTxStatus("Building claim transaction...");

      const depositId = BigInt(claimDepositId);

      // Validate depositor address format
      if (claimDepositorAddress.length < 32 || claimDepositorAddress.length > 44) {
        setTxStatus("❌ Endereço do depositante inválido.\nDeve ser um endereço Solana válido.");
        return;
      }

      console.log("🔓 Claiming deposit:", {
        depositId: depositId.toString(),
        depositorAddress: claimDepositorAddress,
        claimer: walletAddress,
      });

      // Derive the deposit PDA: ["deposit", depositor, deposit_id]
      const depositPda = await getProgramDerivedAddress({
        programAddress: VAULT_PROGRAM_ADDRESS,
        seeds: [
          getBytesEncoder().encode(DEPOSIT_SEED),
          getAddressEncoder().encode(claimDepositorAddress as Address),
          getU64Encoder().encode(depositId),
        ],
      });

      console.log("📍 Deposit PDA:", depositPda[0]);

      // Build instruction data manually
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

      console.log("✅ Claim instruction created:", instruction);

      setTxStatus("Aguardando assinatura...");

      const signature = await send({ instructions: [instruction] });

      setTxStatus(
        `✅ Depósito resgatado com sucesso!\n\n` +
        `💰 Os fundos foram transferidos para sua wallet.\n\n` +
        `🔗 Signature: ${signature?.slice(0, 20)}...`
      );

      // Clear form
      setClaimDepositId("");
      setClaimSecret("");
      setClaimDepositorAddress("");

    } catch (err: any) {
      console.error("❌ Claim deposit failed:", err);
      console.error("❌ Error details:", {
        message: err?.message,
        cause: err?.cause,
        name: err?.name,
        stack: err?.stack,
      });

      let errorMessage = "Erro desconhecido";

      if (err?.message) {
        errorMessage = err.message;
      }

      // Check for specific error types
      if (errorMessage.includes("InvalidSecret") || errorMessage.includes("0x1771")) {
        errorMessage = `❌ Código secreto inválido!\n\nO código secreto fornecido não corresponde ao depósito.\nVerifique se digitou corretamente.`;
      } else if (errorMessage.includes("AlreadyClaimed") || errorMessage.includes("0x1770")) {
        errorMessage = `❌ Depósito já resgatado!\n\nEste depósito já foi resgatado anteriormente.`;
      } else if (errorMessage.includes("AccountNotFound") || errorMessage.includes("account not found")) {
        errorMessage = `❌ Depósito não encontrado!\n\nVerifique:\n- Deposit ID está correto?\n- Endereço do depositante está correto?\n\nO depósito pode não existir ou os dados estão incorretos.`;
      } else if (errorMessage.includes("insufficient") || errorMessage.includes("balance")) {
        errorMessage = `❌ Saldo insuficiente para taxa de transação.`;
      } else if (errorMessage.includes("transaction plan") || errorMessage.includes("simulation failed")) {
        const programStatus = programDeployed === false
          ? "\n\n❌ PROGRAMA NÃO ESTÁ DEPLOYADO NA DEVNET!"
          : "";
        errorMessage = `❌ Falha na transação\n\nPossíveis causas:\n- Depósito não existe ou dados incorretos\n- Código secreto errado\n- Depósito já foi resgatado${programStatus}`;
      }

      setTxStatus(errorMessage);
    }
  }, [walletAddress, wallet, claimDepositId, claimSecret, claimDepositorAddress, send, programDeployed]);

  if (status !== "connected") {
    return (
      <section className="w-full max-w-3xl space-y-4 rounded-2xl border border-border-low bg-card p-6 shadow-[0_20px_80px_-50px_rgba(0,0,0,0.35)]">
        <div className="space-y-1">
          <p className="text-lg font-semibold">PrivyLink</p>
          <p className="text-sm text-muted">
            Connect your wallet to create private deposits or claim existing ones.
          </p>
        </div>
        <div className="rounded-lg bg-yellow-100/50 border border-yellow-300/50 p-4 text-sm">
          <p className="font-semibold text-yellow-800 mb-2">⚠️ IMPORTANTE: Configure sua wallet para DEVNET</p>
          <p className="text-yellow-700 text-xs mb-2">
            Este app usa <strong>Solana Devnet</strong> (rede de testes). Sua wallet precisa estar configurada para Devnet também.
          </p>
          <p className="text-yellow-700 text-xs">
            <strong>Phantom:</strong> Settings → Developer Mode → Change Network → Devnet<br/>
            <strong>Solflare:</strong> Settings → Network → Devnet
          </p>
        </div>
        <div className="rounded-lg bg-cream/50 p-4 text-center text-sm text-muted">
          Wallet not connected
        </div>
      </section>
    );
  }

  return (
    <section className="w-full max-w-3xl space-y-6 rounded-2xl border border-border-low bg-card p-6 shadow-[0_20px_80px_-50px_rgba(0,0,0,0.35)]">
      <div className="space-y-1">
        <p className="text-lg font-semibold">PrivyLink</p>
        <p className="text-sm text-muted">
          Create private SOL deposits with secret codes. Only those with the code can claim.
        </p>
      </div>

      {/* Create Private Deposit */}
      <div className="space-y-3 rounded-xl border border-border-low bg-cream/30 p-4">
        <p className="text-sm font-semibold">Create Private Deposit</p>
        <div className="space-y-2">
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Amount in SOL"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={isSending}
            className="w-full rounded-lg border border-border-low bg-card px-4 py-2.5 text-sm outline-none transition placeholder:text-muted focus:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <input
            type="text"
            placeholder="Secret code (save this!)"
            value={secretCode}
            onChange={(e) => setSecretCode(e.target.value)}
            disabled={isSending}
            className="w-full rounded-lg border border-border-low bg-card px-4 py-2.5 text-sm outline-none transition placeholder:text-muted focus:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            onClick={handleCreatePrivateDeposit}
            disabled={
              isSending ||
              !amount ||
              !secretCode ||
              parseFloat(amount) <= 0
            }
            className="w-full rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSending ? "Creating..." : "Create Deposit"}
          </button>
        </div>
      </div>

      {/* Claim Deposit */}
      <div className="space-y-3 rounded-xl border border-border-low bg-cream/30 p-4">
        <p className="text-sm font-semibold">Claim Deposit</p>
        <p className="text-xs text-muted">
          Insira as informações recebidas do depositante para resgatar os fundos.
        </p>
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Deposit ID (ex: 1706456789000)"
            value={claimDepositId}
            onChange={(e) => setClaimDepositId(e.target.value)}
            disabled={isSending}
            className="w-full rounded-lg border border-border-low bg-card px-4 py-2.5 text-sm outline-none transition placeholder:text-muted focus:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <input
            type="text"
            placeholder="Depositor address (ex: 7xKX...)"
            value={claimDepositorAddress}
            onChange={(e) => setClaimDepositorAddress(e.target.value)}
            disabled={isSending}
            className="w-full rounded-lg border border-border-low bg-card px-4 py-2.5 text-sm outline-none transition placeholder:text-muted focus:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <input
            type="text"
            placeholder="Secret code"
            value={claimSecret}
            onChange={(e) => setClaimSecret(e.target.value)}
            disabled={isSending}
            className="w-full rounded-lg border border-border-low bg-card px-4 py-2.5 text-sm outline-none transition placeholder:text-muted focus:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            onClick={handleClaimDeposit}
            disabled={isSending || !claimDepositId || !claimSecret || !claimDepositorAddress}
            className="w-full rounded-lg border border-border-low bg-card px-4 py-2.5 text-sm font-medium transition hover:-translate-y-0.5 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSending ? "Claiming..." : "Claim Deposit"}
          </button>
        </div>
      </div>

      {/* Last Deposit Info (for easy sharing) */}
      {lastDepositInfo && (
        <div className="space-y-2 rounded-xl border border-green-300/50 bg-green-50/30 p-4">
          <p className="text-sm font-semibold text-green-800">Ultimo Deposito Criado</p>
          <p className="text-xs text-green-700">Compartilhe estas informações com o destinatário:</p>
          <div className="rounded-lg bg-white/50 p-3 font-mono text-xs">
            <p><span className="text-muted">Deposit ID:</span> {lastDepositInfo.depositId}</p>
            <p><span className="text-muted">Depositor:</span> {lastDepositInfo.depositorAddress}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  `Deposit ID: ${lastDepositInfo.depositId}\nDepositor: ${lastDepositInfo.depositorAddress}`
                );
                setTxStatus("Informacoes copiadas para a area de transferencia!");
              }}
              className="flex-1 rounded-lg border border-green-300/50 bg-white/50 px-3 py-1.5 text-xs font-medium text-green-800 transition hover:bg-green-100/50"
            >
              Copiar Infos
            </button>
            <button
              onClick={() => setLastDepositInfo(null)}
              className="rounded-lg border border-green-300/50 bg-white/50 px-3 py-1.5 text-xs font-medium text-green-800 transition hover:bg-green-100/50"
            >
              Fechar
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
          <p className="text-red-700 mb-2">
            O programa precisa ser deployado na devnet antes de usar.
          </p>
          <div className="bg-red-50 p-2 rounded text-[10px] font-mono text-red-800">
            <p className="mb-1"><strong>Para fazer deploy:</strong></p>
            <p>1. cd privylink-dapp/anchor</p>
            <p>2. anchor deploy --provider.cluster devnet</p>
            <p className="mt-1 text-[9px] text-red-600">
              Requer: Solana CLI + Anchor instalados + ~2 SOL na devnet
            </p>
          </div>
        </div>
      )}

      {/* Network Warning */}
      <div className="rounded-lg bg-yellow-100/50 border border-yellow-300/50 p-3 text-xs">
        <p className="font-semibold text-yellow-800 mb-1">⚠️ Usando DEVNET (Rede de Testes)</p>
        <p className="text-yellow-700">
          Este app está conectado à <strong>Solana Devnet</strong>. Certifique-se de que sua wallet também está em Devnet.
        </p>
        <p className="text-yellow-700 mt-1">
          RPC: <code className="font-mono text-[10px]">{process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com"}</code>
        </p>
        <p className="text-yellow-700 mt-1">
          Programa: <code className="font-mono text-[10px]">{VAULT_PROGRAM_ADDRESS}</code>
        </p>
      </div>

      {/* Educational Footer */}
      <div className="border-t border-border-low pt-4 text-xs text-muted">
        <p className="mb-2">
          PrivyLink is an{" "}
          <a
            href="https://www.anchor-lang.com/docs"
            target="_blank"
            rel="noreferrer"
            className="font-medium underline underline-offset-2"
          >
            Anchor program
          </a>{" "}
          for private SOL transfers. Deposits can only be claimed with the correct secret code.
        </p>
      </div>
    </section>
  );
}
