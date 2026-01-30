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
import { QRCodeSVG } from "qrcode.react";

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
  const [expirationHours, setExpirationHours] = useState("24"); // Default: 24 hours

  // Claim deposit states
  const [claimDepositor, setClaimDepositor] = useState("");
  const [claimDepositId, setClaimDepositId] = useState("");
  const [claimSecret, setClaimSecret] = useState("");

  // UI states
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [txStatusType, setTxStatusType] = useState<"success" | "error" | "info">("info");
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const [lastDepositSecret, setLastDepositSecret] = useState<string | null>(null);
  const [lastExpirationHours, setLastExpirationHours] = useState<string | null>(null);
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
          console.warn("Program not deployed on devnet");
          console.warn("Program ID:", VAULT_PROGRAM_ADDRESS);
        } else {
          console.log("Program deployed:", VAULT_PROGRAM_ADDRESS);
        }
      } catch (err) {
        console.warn("Could not verify deployment status:", err);
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
      setTxStatus(`${label} copied to clipboard`);
      setTxStatusType("success");
      setTimeout(() => setTxStatus(null), 2000);
    } catch {
      setTxStatus(`Failed to copy. Manual copy: ${text}`);
      setTxStatusType("error");
    }
  };

  const handleCreatePrivateDeposit = useCallback(async () => {
    if (!walletAddress || !amount || !secretCode || !wallet) return;

    try {
      setTxStatus("Building transaction...");
      setTxStatusType("info");
      setMagicLink(null);
      setLastDepositSecret(null);
      setLastExpirationHours(null);

      const depositAmount = BigInt(
        Math.floor(parseFloat(amount) * Number(LAMPORTS_PER_SOL))
      );

      const MIN_RENT = 1_600_000n; // Updated for new account size (98 bytes)
      const MIN_AMOUNT = MIN_RENT + 5_000n;

      if (depositAmount < MIN_AMOUNT) {
        setTxStatus(
          `Amount too low. Minimum: ${Number(MIN_AMOUNT) / Number(LAMPORTS_PER_SOL)} SOL`
        );
        setTxStatusType("error");
        return;
      }

      const depositId = BigInt(Date.now());
      const claimHash = await hashSecret(secretCode);
      const expHours = BigInt(expirationHours);

      console.log("Creating deposit:", {
        depositId: depositId.toString(),
        amount: depositAmount.toString(),
        depositor: walletAddress,
        expirationHours: expHours.toString(),
      });

      const instruction = await getCreatePrivateDepositInstructionAsync({
        depositor: walletAddress as any,
        depositId,
        amount: depositAmount,
        claimHash: claimHash as any,
        expirationHours: expHours,
      });

      setTxStatus("Waiting for signature...");

      const signature = await send({
        instructions: [instruction],
      });

      // Generate Magic Link after successful deposit
      const link = generateMagicLink(walletAddress, depositId.toString());
      setMagicLink(link);
      setLastDepositSecret(secretCode);
      setLastExpirationHours(expirationHours);

      // Format expiration display
      const expDisplay = expirationHours === "0" ? "No expiration" :
        parseInt(expirationHours) >= 24
          ? `${Math.floor(parseInt(expirationHours) / 24)} days`
          : `${expirationHours} hours`;

      setTxStatus(
        `Deposit created successfully!\n\nID: ${depositId.toString()}\nAmount: ${amount} SOL\nExpires: ${expDisplay}`
      );
      setTxStatusType("success");

      setAmount("");
      setSecretCode("");
    } catch (err: any) {
      console.error("Create deposit failed:", err);

      let errorMessage = "Unknown error";

      if (err?.message) {
        errorMessage = err.message;
      }

      if (errorMessage.includes("transaction plan") || errorMessage.includes("failed to execute") || errorMessage.includes("simulation failed")) {
        const programStatus = programDeployed === false
          ? "Program not deployed on devnet"
          : programDeployed === true
          ? "Program is deployed"
          : "Deployment status unknown";

        errorMessage = `Transaction failed\n\n${programStatus}\n\nPossible causes:\n1. Program not deployed\n2. Insufficient balance\n3. Wrong network`;
      }

      setTxStatus(errorMessage);
      setTxStatusType("error");
    }
  }, [walletAddress, wallet, amount, secretCode, expirationHours, send, programDeployed]);

  const handleClaimDeposit = useCallback(async () => {
    if (!walletAddress || !claimDepositId || !claimSecret || !claimDepositor || !wallet) return;

    try {
      setTxStatus("Building claim transaction...");
      setTxStatusType("info");

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

      console.log("PDA Debug:", {
        depositId: depositId.toString(),
        calculatedPda,
        knownPda,
        match: calculatedPda === knownPda,
        usingPda: depositPda,
      });

      console.log("Claiming deposit:", {
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

      console.log("Manual instruction data hex:",
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

      console.log("Instruction built manually");

      setTxStatus("Waiting for signature...");

      const signature = await send({
        instructions: [instruction],
      });

      setTxStatus(
        `Claim successful!\n\nFunds transferred to your wallet.\nSignature: ${signature?.slice(0, 20)}...`
      );
      setTxStatusType("success");

      setClaimDepositor("");
      setClaimDepositId("");
      setClaimSecret("");
    } catch (err: any) {
      console.error("Claim deposit failed:", err);

      let errorMessage = err?.message || "Unknown error";

      // Decode Anchor error codes
      if (errorMessage.includes("#2006")) {
        errorMessage = "Error #2006: ConstraintMut\n\nThe deposit account is not marked as mutable.";
      } else if (errorMessage.includes("#3012")) {
        errorMessage = "Error #3012: ConstraintSeeds\n\nPDA derivation mismatch.";
      } else if (errorMessage.includes("InvalidSecret") || errorMessage.includes("invalid secret") || errorMessage.includes("#6001")) {
        errorMessage = "Invalid secret code!\n\nPlease verify the code is correct.";
      } else if (errorMessage.includes("AlreadyClaimed") || errorMessage.includes("already claimed") || errorMessage.includes("#6000")) {
        errorMessage = "This deposit has already been claimed!";
      } else if (errorMessage.includes("AccountNotFound") || errorMessage.includes("not found")) {
        errorMessage = "Deposit not found!\n\nVerify the ID and depositor address.";
      }

      setTxStatus(errorMessage);
      setTxStatusType("error");
    }
  }, [walletAddress, wallet, claimDepositId, claimSecret, claimDepositor, send]);

  if (status !== "connected") {
    return (
      <div className="animated-border">
        <div className="glass-card space-y-6 p-6 md:p-8">
          <div>
            <h2 className="text-xl font-semibold md:text-2xl">
              Private Transfer
            </h2>
            <p className="mt-1 text-sm text-muted">
              Connect your wallet to create private deposits or claim existing ones.
            </p>
          </div>

          <div className="glass-card space-y-3 p-4">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-sol-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="font-medium">Configure wallet for Devnet</span>
            </div>
            <div className="text-xs text-muted space-y-1">
              <p><span className="text-foreground">Phantom:</span> Settings &rarr; Developer Mode &rarr; Devnet</p>
              <p><span className="text-foreground">Solflare:</span> Settings &rarr; Network &rarr; Devnet</p>
            </div>
          </div>

          <div className="rounded-xl border border-border-low bg-bg-elevated/50 p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-border-subtle">
              <svg className="h-6 w-6 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-muted">Wallet not connected</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animated-border">
      <div className="glass-card space-y-6 p-6 md:p-8">
        <div>
          <h2 className="text-xl font-semibold md:text-2xl">
            Private Transfer
          </h2>
          <p className="mt-1 text-sm text-muted">
            Send SOL privately using secret codes.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex rounded-xl bg-bg-elevated/50 p-1">
          <button
            onClick={() => setActiveTab("create")}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
              activeTab === "create"
                ? "bg-gradient-to-r from-sol-purple to-sol-green text-white shadow-lg"
                : "text-muted hover:text-foreground"
            }`}
          >
            Create Deposit
          </button>
          <button
            onClick={() => setActiveTab("claim")}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
              activeTab === "claim"
                ? "bg-gradient-to-r from-sol-purple to-sol-green text-white shadow-lg"
                : "text-muted hover:text-foreground"
            }`}
          >
            Claim Deposit
          </button>
        </div>

        {/* Create Private Deposit Tab */}
        {activeTab === "create" && (
          <div className="space-y-4">
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">
                  Amount (SOL)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={isSending}
                  className="input"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">
                  Secret Code
                </label>
                <input
                  type="text"
                  placeholder="Create a memorable secret"
                  value={secretCode}
                  onChange={(e) => setSecretCode(e.target.value)}
                  disabled={isSending}
                  className="input"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">
                  Expiration
                </label>
                <select
                  value={expirationHours}
                  onChange={(e) => setExpirationHours(e.target.value)}
                  disabled={isSending}
                  className="select"
                >
                  <option value="1">1 hour</option>
                  <option value="6">6 hours</option>
                  <option value="24">24 hours (default)</option>
                  <option value="72">3 days</option>
                  <option value="168">7 days</option>
                  <option value="720">30 days</option>
                  <option value="0">No expiration</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleCreatePrivateDeposit}
              disabled={isSending || !amount || !secretCode || parseFloat(amount) <= 0}
              className="btn-primary w-full py-3"
            >
              {isSending ? (
                <>
                  <span className="spinner" />
                  Creating...
                </>
              ) : (
                "Create Deposit"
              )}
            </button>

            {/* Magic Link & Secret Copy Buttons with QR Code */}
            {magicLink && lastDepositSecret && (
              <div className="space-y-4 rounded-xl border border-sol-green/30 bg-sol-green/5 p-5">
                <div className="flex items-center justify-center gap-2 text-sol-green">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-semibold">Deposit Created!</span>
                </div>

                {/* QR Code */}
                <div className="flex justify-center">
                  <div className="qr-container">
                    <QRCodeSVG
                      value={magicLink}
                      size={160}
                      level="H"
                      includeMargin={false}
                      bgColor="#ffffff"
                      fgColor="#000000"
                    />
                  </div>
                </div>

                <p className="text-center text-xs text-muted">
                  Scan to share the Magic Link
                </p>

                {/* Magic Link Display */}
                <div className="rounded-lg bg-bg-elevated p-3">
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-subtle">Magic Link</p>
                  <p className="break-all font-mono text-xs text-muted">{magicLink}</p>
                </div>

                {/* Action Buttons */}
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    onClick={() => copyToClipboard(magicLink, "Magic Link")}
                    className="btn-secondary text-sm"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copy Link
                  </button>
                  <button
                    onClick={() => copyToClipboard(lastDepositSecret, "Secret code")}
                    className="btn-secondary text-sm"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    Copy Secret
                  </button>
                </div>

                <button
                  onClick={() => copyToClipboard(`${magicLink}&secret=${encodeURIComponent(lastDepositSecret)}`, "Complete link")}
                  className="btn-primary w-full text-sm"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Copy Complete Link (with secret)
                </button>

                <p className="text-center text-[10px] text-subtle">
                  Warning: Complete link includes the secret. Only share on secure channels.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Claim Deposit Tab */}
        {activeTab === "claim" && (
          <div className="space-y-4">
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">
                  Depositor Address
                </label>
                <input
                  type="text"
                  placeholder="Depositor wallet address"
                  value={claimDepositor}
                  onChange={(e) => setClaimDepositor(e.target.value)}
                  disabled={isSending}
                  className="input font-mono text-xs"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">
                  Deposit ID
                </label>
                <input
                  type="text"
                  placeholder="Deposit identifier"
                  value={claimDepositId}
                  onChange={(e) => setClaimDepositId(e.target.value)}
                  disabled={isSending}
                  className="input"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">
                  Secret Code
                </label>
                <input
                  type="text"
                  placeholder="Enter the secret code"
                  value={claimSecret}
                  onChange={(e) => setClaimSecret(e.target.value)}
                  disabled={isSending}
                  className="input"
                />
              </div>
            </div>

            <button
              onClick={handleClaimDeposit}
              disabled={isSending || !claimDepositId || !claimSecret || !claimDepositor}
              className="btn-primary w-full py-3"
            >
              {isSending ? (
                <>
                  <span className="spinner" />
                  Claiming...
                </>
              ) : (
                "Claim Funds"
              )}
            </button>
          </div>
        )}

        {/* Status */}
        {txStatus && (
          <div className={`rounded-xl border p-4 text-sm whitespace-pre-line ${
            txStatusType === "success"
              ? "border-sol-green/30 bg-sol-green/5 text-sol-green"
              : txStatusType === "error"
                ? "border-red-500/30 bg-red-500/5 text-red-400"
                : "border-border-subtle bg-bg-elevated text-muted"
          }`}>
            {txStatus}
          </div>
        )}

        {/* Program Deployment Status */}
        {programDeployed === false && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
            <div className="flex items-center gap-2 text-red-400">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">Program Not Deployed</span>
            </div>
            <p className="mt-2 text-xs text-red-400/80">
              Run: <code className="rounded bg-red-500/10 px-1.5 py-0.5">cd anchor && anchor deploy --provider.cluster devnet</code>
            </p>
          </div>
        )}

        {/* Network Info */}
        <div className="flex items-center justify-between rounded-xl border border-border-subtle bg-bg-elevated/50 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="status-dot-pending" />
            <span className="text-xs font-medium">Devnet</span>
          </div>
          <code className="font-mono text-[10px] text-subtle">
            {VAULT_PROGRAM_ADDRESS.slice(0, 8)}...{VAULT_PROGRAM_ADDRESS.slice(-8)}
          </code>
        </div>
      </div>
    </div>
  );
}
