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
  type Address,
} from "@solana/kit";
import {
  getCreatePrivateDepositInstructionAsync,
  getClaimDepositInstruction,
  VAULT_PROGRAM_ADDRESS,
} from "../generated/vault";

const LAMPORTS_PER_SOL = 1_000_000_000n;
const SYSTEM_PROGRAM_ADDRESS = "11111111111111111111111111111111" as Address;

export function VaultCard() {
  const { wallet, status } = useWalletConnection();
  const { send, isSending } = useSendTransaction();

  const [amount, setAmount] = useState("");
  const [secretCode, setSecretCode] = useState("");
  const [claimDepositId, setClaimDepositId] = useState("");
  const [claimSecret, setClaimSecret] = useState("");
  const [txStatus, setTxStatus] = useState<string | null>(null);

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

      // Get the instruction
      const instruction = await getCreatePrivateDepositInstructionAsync({
        depositor: wallet.account,
        depositId,
        amount: depositAmount,
        claimHash: claimHash as any,
      });

      console.log("✅ Instrução criada:", instruction);

      setTxStatus("Awaiting signature...");

      const signature = await send({
        instructions: [instruction],
      });

      setTxStatus(
        `✅ Depósito criado!\nID: ${depositId.toString()}\nSignature: ${signature?.slice(0, 20)}...\n\n⚠️ SALVE SEU CÓDIGO SECRETO!`
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
    if (!walletAddress || !claimDepositId || !claimSecret || !wallet) return;

    try {
      setTxStatus("Building transaction...");

      const depositId = BigInt(claimDepositId);

      // Note: To claim a deposit, we need the depositor's address to derive the PDA
      // In a production app, you would:
      // 1. Fetch all deposits or search by deposit_id
      // 2. Get the depositor address from the deposit account
      // 3. Derive the PDA: ["deposit", depositor, deposit_id]
      // 4. Create the claim instruction

      // For now, we'll show an informative message
      setTxStatus(
        "Claim functionality requires fetching the deposit account first.\n" +
        "Please provide the depositor's address or implement deposit lookup."
      );

      // Example of how it would work (commented out):
      // const depositPda = await getProgramDerivedAddress({
      //   programAddress: VAULT_PROGRAM_ADDRESS,
      //   seeds: [
      //     getBytesEncoder().encode(new Uint8Array([100, 101, 112, 111, 115, 105, 116])), // "deposit"
      //     getAddressEncoder().encode(depositorAddress),
      //     getU64Encoder().encode(depositId),
      //   ],
      // });
      //
      // const instruction = getClaimDepositInstruction({
      //   claimer: wallet.account,
      //   deposit: depositPda[0],
      //   depositId,
      //   secret: claimSecret,
      // });
      //
      // const signature = await send({ instructions: [instruction] });

    } catch (err) {
      console.error("Claim deposit failed:", err);
      setTxStatus(
        `Error: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }, [walletAddress, wallet, claimDepositId, claimSecret, send]);

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
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Deposit ID"
            value={claimDepositId}
            onChange={(e) => setClaimDepositId(e.target.value)}
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
            disabled={isSending || !claimDepositId || !claimSecret}
            className="w-full rounded-lg border border-border-low bg-card px-4 py-2.5 text-sm font-medium transition hover:-translate-y-0.5 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSending ? "Claiming..." : "Claim Deposit"}
          </button>
        </div>
      </div>

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
