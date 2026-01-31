"use client";

import { useState, useCallback, useEffect } from "react";
import {
  useWalletConnection,
  useSendTransaction,
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

interface MagicLinkData {
  depositor: string;
  depositId: string;
  secret?: string;
}

export function VaultCard() {
  const { wallet, status } = useWalletConnection();
  const { send, isSending } = useSendTransaction();

  // Create deposit states
  const [amount, setAmount] = useState("");
  const [secretCode, setSecretCode] = useState("");
  const [expirationHours, setExpirationHours] = useState("24");
  const [depositLabel, setDepositLabel] = useState("");

  // Claim deposit states
  const [claimDepositor, setClaimDepositor] = useState("");
  const [claimDepositId, setClaimDepositId] = useState("");
  const [claimSecret, setClaimSecret] = useState("");

  // UI states
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [txStatusType, setTxStatusType] = useState<"success" | "error" | "info">("info");
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const [lastDepositSecret, setLastDepositSecret] = useState<string | null>(null);
  const [lastDepositId, setLastDepositId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"create" | "claim">("create");
  const [showQrModal, setShowQrModal] = useState(false);

  // Detect mobile device
  const isMobile = () => {
    if (typeof window === "undefined") return false;
    return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
      (navigator.userAgent || "").toLowerCase()
    );
  };

  // Download QR Code as PNG
  const downloadQrCode = async (size: number = 300) => {
    if (!magicLink || !lastDepositSecret) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const svgElement = document.querySelector(".qr-download-source svg") as SVGElement;
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = async () => {
      canvas.width = size;
      canvas.height = size;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);

      URL.revokeObjectURL(url);

      const fileName = `privylink-qr-${lastDepositId?.slice(-6) || "code"}.png`;

      // Mobile: usar share API ou abrir em nova aba
      if (isMobile()) {
        try {
          // Converter canvas para blob
          const blob = await new Promise<Blob>((resolve) => {
            canvas.toBlob((b) => resolve(b!), "image/png");
          });

          // Tentar usar Web Share API (funciona bem em mobile)
          if (navigator.share && navigator.canShare) {
            const file = new File([blob], fileName, { type: "image/png" });
            if (navigator.canShare({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: "PrivyLink QR Code",
              });
              return;
            }
          }

          // Fallback: abrir imagem em nova aba para salvar manualmente
          const pngUrl = canvas.toDataURL("image/png");
          const newTab = window.open();
          if (newTab) {
            newTab.document.write(`
              <html>
                <head><title>Salvar QR Code</title></head>
                <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#1a1a2e;">
                  <div style="text-align:center;color:white;font-family:system-ui;">
                    <img src="${pngUrl}" style="max-width:90vw;border-radius:12px;" />
                    <p style="margin-top:16px;font-size:14px;">Segure na imagem para salvar</p>
                  </div>
                </body>
              </html>
            `);
            newTab.document.close();
          }
        } catch (err) {
          console.warn("Mobile download fallback:", err);
          // Último fallback: tentar download normal
          const pngUrl = canvas.toDataURL("image/png");
          const link = document.createElement("a");
          link.download = fileName;
          link.href = pngUrl;
          link.click();
        }
      } else {
        // Desktop: download normal
        const pngUrl = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.download = fileName;
        link.href = pngUrl;
        link.click();
      }
    };
    img.src = url;
  };

  const walletAddress = wallet?.account.address;
  const [programDeployed, setProgramDeployed] = useState<boolean | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  // Fetch wallet balance
  useEffect(() => {
    if (!walletAddress) {
      setWalletBalance(null);
      return;
    }
    const fetchBalance = async () => {
      try {
        const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
        const res = await fetch(RPC, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0", id: 1, method: "getBalance",
            params: [walletAddress]
          })
        });
        const data = await res.json();
        if (data.result?.value !== undefined) {
          setWalletBalance(data.result.value / 1e9);
        }
      } catch { setWalletBalance(null); }
    };
    fetchBalance();
  }, [walletAddress]);

  // Parse Magic Link and Tab from URL (with sessionStorage persistence)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const depositor = params.get("depositor");
    const depositId = params.get("deposit_id") || params.get("id");
    const secret = params.get("secret");
    const tab = params.get("tab");

    // Check if we have params in URL
    if (depositor && depositId) {
      // Save to sessionStorage for persistence across wallet connect
      sessionStorage.setItem("privylink_claim_data", JSON.stringify({
        depositor,
        depositId,
        secret: secret || ""
      }));
      setClaimDepositor(depositor);
      setClaimDepositId(depositId);
      if (secret) setClaimSecret(secret);
      setActiveTab("claim");
      window.history.replaceState({}, "", window.location.pathname);
      // Scroll to the vault card section
      setTimeout(() => {
        const sendSection = document.getElementById("send");
        if (sendSection) {
          sendSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    } else {
      // Check sessionStorage for saved claim data (after wallet connect reload)
      const savedClaimData = sessionStorage.getItem("privylink_claim_data");
      if (savedClaimData) {
        try {
          const data = JSON.parse(savedClaimData);
          if (data.depositor && data.depositId) {
            setClaimDepositor(data.depositor);
            setClaimDepositId(data.depositId);
            if (data.secret) setClaimSecret(data.secret);
            setActiveTab("claim");
            setTimeout(() => {
              const sendSection = document.getElementById("send");
              if (sendSection) {
                sendSection.scrollIntoView({ behavior: "smooth", block: "start" });
              }
            }, 100);
          }
        } catch (e) {
          console.warn("Failed to parse saved claim data:", e);
        }
      } else if (tab === "claim") {
        setActiveTab("claim");
        window.history.replaceState({}, "", window.location.pathname + window.location.hash);
        setTimeout(() => {
          const sendSection = document.getElementById("send");
          if (sendSection) {
            sendSection.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 100);
      } else if (tab === "send") {
        setActiveTab("create");
        window.history.replaceState({}, "", window.location.pathname + window.location.hash);
        setTimeout(() => {
          const sendSection = document.getElementById("send");
          if (sendSection) {
            sendSection.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 100);
      }
    }
  }, []);

  // Check program deployment
  useEffect(() => {
    const checkProgram = async () => {
      try {
        const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
        const res = await fetch(RPC, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0", id: 1, method: "getAccountInfo",
            params: [VAULT_PROGRAM_ADDRESS, { encoding: "base58" }]
          })
        });
        const data = await res.json();
        setProgramDeployed(data.result?.value !== null);
      } catch { setProgramDeployed(null); }
    };
    checkProgram();
  }, []);

  const hashSecret = async (secret: string): Promise<Uint8Array> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(secret);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return new Uint8Array(hashBuffer);
  };

  const generateRandomSecret = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let result = "";
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setSecretCode(result);
  };

  const generateMagicLink = (depositor: string, depositId: string, includeSecret?: string): string => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const params = new URLSearchParams({ depositor, deposit_id: depositId });
    if (includeSecret) params.set("secret", includeSecret);
    return `${baseUrl}?${params.toString()}`;
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setTxStatus(`${label} copied!`);
      setTxStatusType("success");
      setTimeout(() => setTxStatus(null), 2000);
    } catch {
      setTxStatus(`Failed to copy`);
      setTxStatusType("error");
    }
  };

  const handleCreateDeposit = useCallback(async () => {
    if (!walletAddress || !amount || !secretCode || !wallet) return;

    try {
      setTxStatus("Building transaction...");
      setTxStatusType("info");
      setMagicLink(null);
      setLastDepositSecret(null);

      const depositAmount = BigInt(Math.floor(parseFloat(amount) * Number(LAMPORTS_PER_SOL)));
      const MIN_AMOUNT = 1_605_000n;

      if (depositAmount < MIN_AMOUNT) {
        setTxStatus(`Minimum amount: ${Number(MIN_AMOUNT) / 1e9} SOL`);
        setTxStatusType("error");
        return;
      }

      const depositId = BigInt(Date.now());
      const claimHash = await hashSecret(secretCode);
      const expHours = BigInt(expirationHours);

      const instruction = await getCreatePrivateDepositInstructionAsync({
        depositor: walletAddress as any,
        depositId,
        amount: depositAmount,
        claimHash: claimHash as any,
        expirationHours: expHours,
      });

      setTxStatus("Waiting for signature...");
      await send({ instructions: [instruction] });

      const link = generateMagicLink(walletAddress, depositId.toString());
      setMagicLink(link);
      setLastDepositSecret(secretCode);
      setLastDepositId(depositId.toString());

      // Save label to localStorage if provided (using PDA as key) and history is enabled
      const saveHistoryForLabel = localStorage.getItem("privylink_save_history");
      const shouldSaveLabel = saveHistoryForLabel === null || saveHistoryForLabel === "true";
      if (depositLabel.trim() && shouldSaveLabel) {
        try {
          const depositIdBytes = new Uint8Array(8);
          new DataView(depositIdBytes.buffer).setBigUint64(0, depositId, true);
          const addressEncoder = getAddressEncoder();
          const depositorBytes = addressEncoder.encode(walletAddress as Address);
          const [pda] = await getProgramDerivedAddress({
            programAddress: VAULT_PROGRAM_ADDRESS,
            seeds: [new TextEncoder().encode("deposit"), depositorBytes, depositIdBytes],
          });
          const labels = JSON.parse(localStorage.getItem("privylink_labels") || "{}");
          labels[pda] = depositLabel.trim();
          localStorage.setItem("privylink_labels", JSON.stringify(labels));
        } catch (e) {
          console.warn("Failed to save label:", e);
        }
      }

      setTxStatus(`Deposit created! Amount: ${amount} SOL`);
      setTxStatusType("success");
      setAmount("");
      setSecretCode("");
      setDepositLabel("");
    } catch (err: any) {
      console.error("Create failed:", err);
      let msg = err?.message || "Transaction failed";
      const msgLower = msg.toLowerCase();

      if (
        msgLower.includes("insufficient") ||
        msgLower.includes("not enough") ||
        msgLower.includes("0x1") ||
        msgLower.includes("no record of a prior credit") ||
        msgLower.includes("lamports")
      ) {
        msg = "Saldo insuficiente. Verifique se você tem SOL suficiente para o depósito + taxa de rede (~0.002 SOL).";
      } else if (
        msgLower.includes("mainnet") ||
        msgLower.includes("mynet") ||
        msgLower.includes("wrong network") ||
        msgLower.includes("network mismatch")
      ) {
        msg = "Rede incorreta. Configure sua carteira para Devnet (Settings → Network → Devnet).";
      } else if (msgLower.includes("cancelled") || msgLower.includes("canceled") || msgLower.includes("rejected") || msgLower.includes("denied")) {
        msg = "Transação cancelada. Se você tem outra página aberta usando a carteira, feche-a e tente novamente.";
      } else if (msgLower.includes("already pending") || msgLower.includes("busy") || msgLower.includes("locked")) {
        msg = "Outra página está usando a carteira. Feche-a para continuar.";
      } else if (msgLower.includes("blockhash") || msgLower.includes("expired")) {
        msg = "Transação expirou. Tente novamente.";
      }
      setTxStatus(msg);
      setTxStatusType("error");
    }
  }, [walletAddress, wallet, amount, secretCode, expirationHours, send]);

  const handleClaimDeposit = useCallback(async () => {
    if (!walletAddress || !claimDepositId || !claimSecret || !claimDepositor || !wallet) return;

    try {
      setTxStatus("Verificando saldo...");
      setTxStatusType("info");

      // Verificar saldo ANTES de tentar a transação
      const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
      try {
        const balanceRes = await fetch(RPC, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [walletAddress] })
        });
        const balanceData = await balanceRes.json();
        const balanceLamports = balanceData.result?.value || 0;
        const balanceSOL = balanceLamports / 1e9;

        // Precisa de pelo menos 0.001 SOL para pagar taxa de rede
        if (balanceSOL < 0.001) {
          setTxStatus(`Saldo insuficiente para pagar taxa de rede. Seu saldo: ${balanceSOL.toFixed(6)} SOL. Mínimo necessário: ~0.001 SOL.`);
          setTxStatusType("error");
          return;
        }
      } catch (balanceErr) {
        console.warn("Failed to check balance:", balanceErr);
        // Continua mesmo se falhar a verificação de saldo
      }

      setTxStatus("Building claim transaction...");

      const depositId = BigInt(claimDepositId);
      const depositorAddress = claimDepositor as Address;

      const depositIdBytes = new Uint8Array(8);
      new DataView(depositIdBytes.buffer).setBigUint64(0, depositId, true);

      const addressEncoder = getAddressEncoder();
      const depositorBytes = addressEncoder.encode(depositorAddress);

      const [calculatedPda] = await getProgramDerivedAddress({
        programAddress: VAULT_PROGRAM_ADDRESS,
        seeds: [new TextEncoder().encode("deposit"), depositorBytes, depositIdBytes],
      });

      // Fetch deposit amount before claiming
      let claimAmount = 0;
      try {
        const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
        const res = await fetch(RPC, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0", id: 1, method: "getAccountInfo",
            params: [calculatedPda, { encoding: "base64" }]
          })
        });
        const data = await res.json();
        if (data.result?.value?.data?.[0]) {
          const base64 = data.result.value.data[0];
          const binaryString = atob(base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          if (bytes.length >= 80) {
            const dataView = new DataView(bytes.buffer);
            claimAmount = Number(dataView.getBigUint64(72, true)) / 1e9;
          }
        }
      } catch (e) {
        console.warn("Failed to fetch deposit amount:", e);
      }

      const discriminator = new Uint8Array([201, 106, 1, 224, 122, 144, 210, 155]);
      const secretBytes = new TextEncoder().encode(claimSecret);
      const secretLengthBytes = new Uint8Array(4);
      new DataView(secretLengthBytes.buffer).setUint32(0, secretBytes.length, true);

      const instructionData = new Uint8Array(
        discriminator.length + depositIdBytes.length + secretLengthBytes.length + secretBytes.length
      );
      let offset = 0;
      instructionData.set(discriminator, offset); offset += discriminator.length;
      instructionData.set(depositIdBytes, offset); offset += depositIdBytes.length;
      instructionData.set(secretLengthBytes, offset); offset += secretLengthBytes.length;
      instructionData.set(secretBytes, offset);

      const instruction = {
        programAddress: VAULT_PROGRAM_ADDRESS,
        accounts: [
          { address: walletAddress as Address, role: AccountRole.WRITABLE_SIGNER },
          { address: calculatedPda, role: AccountRole.WRITABLE },
          { address: "11111111111111111111111111111111" as Address, role: AccountRole.READONLY },
        ],
        data: instructionData,
      };

      setTxStatus("Waiting for signature...");
      await send({ instructions: [instruction] });

      // Save claim to history if enabled
      const saveHistorySetting = localStorage.getItem("privylink_save_history");
      const saveHistory = saveHistorySetting === null || saveHistorySetting === "true";
      if (saveHistory) {
        try {
          const claims = JSON.parse(localStorage.getItem("privylink_claims") || "[]");
          claims.unshift({
            pda: calculatedPda,
            depositor: claimDepositor,
            depositId: claimDepositId,
            amount: claimAmount,
            claimedAt: Date.now(),
          });
          localStorage.setItem("privylink_claims", JSON.stringify(claims.slice(0, 100))); // Keep last 100
        } catch (e) {
          console.warn("Failed to save claim history:", e);
        }
      }

      // Refresh wallet balance after claim
      try {
        const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
        const res = await fetch(RPC, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [walletAddress] })
        });
        const data = await res.json();
        if (data.result?.value !== undefined) {
          setWalletBalance(data.result.value / 1e9);
        }
      } catch (e) {
        console.warn("Failed to refresh balance after claim:", e);
      }

      const amountStr = claimAmount > 0 ? ` You received ${claimAmount.toFixed(4)} SOL!` : "";
      setTxStatus(`Claim successful!${amountStr}`);
      setTxStatusType("success");
      // Clear saved claim data from sessionStorage
      sessionStorage.removeItem("privylink_claim_data");
      setClaimDepositor("");
      setClaimDepositId("");
      setClaimSecret("");
    } catch (err: any) {
      console.error("Claim failed:", err);
      let msg = err?.message || "Unknown error";
      const msgLower = msg.toLowerCase();

      if (msg.includes("InvalidSecret") || msg.includes("#6001")) {
        msg = "Invalid secret code. Please check and try again.";
      } else if (msg.includes("AlreadyClaimed") || msg.includes("#6000")) {
        msg = "This deposit has already been claimed or refunded. The funds are no longer available.";
      } else if (msg.includes("DepositExpired") || msg.includes("#6003")) {
        msg = "This deposit has expired. The sender can now refund it.";
      } else if (
        msgLower.includes("insufficient") ||
        msgLower.includes("not enough") ||
        msgLower.includes("0x1") ||
        msgLower.includes("no record of a prior credit") ||
        msgLower.includes("lamports")
      ) {
        msg = "Saldo insuficiente para pagar a taxa de rede. Adicione SOL à sua carteira (mínimo ~0.001 SOL).";
      } else if (
        msgLower.includes("mainnet") ||
        msgLower.includes("mynet") ||
        msgLower.includes("wrong network") ||
        msgLower.includes("network mismatch")
      ) {
        msg = "Rede incorreta. Configure sua carteira para Devnet (Settings → Network → Devnet).";
      } else if (msgLower.includes("cancelled") || msgLower.includes("canceled") || msgLower.includes("rejected") || msgLower.includes("denied")) {
        msg = "Transação cancelada. Se você tem outra página aberta usando a carteira, feche-a e tente novamente.";
      } else if (msgLower.includes("already pending") || msgLower.includes("busy") || msgLower.includes("locked")) {
        msg = "Outra página está usando a carteira. Feche-a para continuar.";
      } else if (msgLower.includes("blockhash") || msgLower.includes("expired")) {
        msg = "Transação expirou. Tente novamente.";
      }
      setTxStatus(msg);
      setTxStatusType("error");
    }
  }, [walletAddress, wallet, claimDepositId, claimSecret, claimDepositor, send]);

  // Not connected state
  if (status !== "connected") {
    return (
      <div className="animated-border">
        <div className="card">
          <h2 className="heading-3 mb-2">Private Transfer</h2>
          <p className="body-small mb-6">
            Connect your wallet to create deposits or claim funds.
          </p>

          <div className="rounded-lg border border-sol-purple/20 bg-sol-purple/5 p-4 mb-6">
            <p className="text-sm font-medium text-sol-purple mb-1">Configure for Devnet</p>
            <p className="text-xs text-muted">Phantom/Solflare: Settings → Network → Devnet</p>
          </div>

          <div className="flex flex-col items-center justify-center rounded-xl border border-border-subtle bg-bg-elevated p-8">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-bg-secondary">
              <svg className="h-6 w-6 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-sm text-muted">Wallet not connected</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animated-border">
      <div className="card relative">
        {/* Loading Overlay */}
        {isSending && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-2xl bg-bg-primary/95 backdrop-blur-sm">
            <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-sol-purple/30 border-t-sol-purple"></div>
            <p className="text-lg font-medium text-foreground mb-2">Processando transação...</p>
            <p className="text-sm text-muted text-center max-w-xs">
              {txStatus || "Aguarde enquanto a transação é confirmada na blockchain."}
            </p>
          </div>
        )}

        <h2 className="heading-3 mb-2">Private Transfer</h2>
        <p className="body-small mb-6">Send SOL privately using secret codes.</p>

        {/* Tabs */}
        <div className="mb-6 flex rounded-lg bg-bg-elevated p-1">
          <button
            onClick={() => {
              setActiveTab("create");
              setMagicLink(null);
              setLastDepositSecret(null);
              setLastDepositId(null);
              setTxStatus(null);
            }}
            className={`flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition ${
              activeTab === "create"
                ? "bg-sol-purple text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            Send
          </button>
          <button
            onClick={() => {
              setActiveTab("claim");
              setTxStatus(null);
            }}
            className={`flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition ${
              activeTab === "claim"
                ? "bg-sol-purple text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            Claim
          </button>
        </div>

        {/* Create Tab */}
        {activeTab === "create" && (
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-medium text-muted">Amount (SOL)</label>
                {walletBalance !== null && (
                  <span className="text-xs text-muted">
                    Balance: <span className="text-sol-green font-medium">{walletBalance.toFixed(4)}</span> SOL
                  </span>
                )}
              </div>
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
              {amount && walletBalance !== null && parseFloat(amount) > walletBalance && (
                <p className="mt-1 text-xs text-red-400">Insufficient balance</p>
              )}
            </div>

            <div>
              <label className="mb-2 flex items-center gap-1 text-xs font-medium text-muted">
                Label <span className="text-muted/50">(optional)</span>
                <span className="group relative cursor-help">
                  <svg className="h-3.5 w-3.5 text-muted/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 rounded-lg bg-bg-primary border border-border-subtle p-2 text-[10px] text-white shadow-lg z-10">
                    Saved locally in your browser only. Not stored on-chain.
                  </span>
                </span>
              </label>
              <input
                type="text"
                placeholder="e.g. Payment to John"
                value={depositLabel}
                onChange={(e) => setDepositLabel(e.target.value)}
                disabled={isSending}
                className="input"
                maxLength={50}
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-muted">Secret Code</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Create a memorable secret"
                  value={secretCode}
                  onChange={(e) => setSecretCode(e.target.value)}
                  disabled={isSending}
                  className="input flex-1"
                />
                <button
                  type="button"
                  onClick={generateRandomSecret}
                  disabled={isSending}
                  className="btn-secondary px-3 shrink-0"
                  title="Generate random secret"
                  aria-label="Generate random secret"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </button>
              </div>
              {secretCode && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className={`h-1 w-6 rounded ${secretCode.length >= 4 ? 'bg-red-400' : 'bg-white/20'}`} />
                    <div className={`h-1 w-6 rounded ${secretCode.length >= 8 ? 'bg-amber-400' : 'bg-white/20'}`} />
                    <div className={`h-1 w-6 rounded ${secretCode.length >= 12 ? 'bg-sol-green' : 'bg-white/20'}`} />
                  </div>
                  <span className={`text-[10px] ${
                    secretCode.length >= 12 ? 'text-sol-green' :
                    secretCode.length >= 8 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {secretCode.length >= 12 ? 'Strong' : secretCode.length >= 8 ? 'Medium' : 'Weak'}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-muted">Expiration</label>
              <select
                value={expirationHours}
                onChange={(e) => setExpirationHours(e.target.value)}
                disabled={isSending}
                className="select"
              >
                <option value="1">1 hour</option>
                <option value="6">6 hours</option>
                <option value="24">24 hours</option>
                <option value="72">3 days</option>
                <option value="168">7 days</option>
                <option value="720">30 days</option>
              </select>
            </div>

            <button
              onClick={handleCreateDeposit}
              disabled={isSending || !amount || !secretCode || parseFloat(amount) <= 0 || (walletBalance !== null && parseFloat(amount) > walletBalance)}
              className="btn-primary w-full py-3"
            >
              {isSending ? <><span className="spinner" /> Creating...</> : "Create Deposit"}
            </button>

            {/* Success State with QR Code */}
            {magicLink && lastDepositSecret && lastDepositId && walletAddress && (
              <div className="mt-6 space-y-4 animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-center gap-2 text-sol-green">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-semibold">Deposit Created!</span>
                </div>

                {/* QR Code */}
                <div className="flex flex-col items-center gap-2">
                  {/* Hidden QR for download */}
                  <div className="qr-download-source hidden">
                    <QRCodeSVG value={`${magicLink}&secret=${encodeURIComponent(lastDepositSecret)}`} size={300} level="H" bgColor="#ffffff" fgColor="#000000" />
                  </div>
                  <button
                    onClick={() => setShowQrModal(true)}
                    className="qr-container cursor-pointer hover:scale-105 transition-transform"
                    title="Click to enlarge"
                  >
                    <QRCodeSVG value={`${magicLink}&secret=${encodeURIComponent(lastDepositSecret)}`} size={140} level="H" bgColor="#ffffff" fgColor="#000000" />
                  </button>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowQrModal(true)}
                      className="text-xs text-sol-purple hover:text-sol-purple/80 flex items-center gap-1"
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                      Enlarge
                    </button>
                    <span className="text-white/20">|</span>
                    <button
                      onClick={() => downloadQrCode(300)}
                      className="text-xs text-sol-green hover:text-sol-green/80 flex items-center gap-1"
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </button>
                  </div>
                </div>

                {/* Card 1: Complete Link */}
                <div className="rounded-xl border border-sol-purple/30 bg-sol-purple/5 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-sol-purple">Complete Magic Link</p>
                    <button
                      onClick={() => copyToClipboard(`${magicLink}&secret=${encodeURIComponent(lastDepositSecret)}`, "Complete link")}
                      className="text-xs text-sol-purple hover:text-sol-purple/80 flex items-center gap-1"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </button>
                  </div>
                  <p className="break-all font-mono text-[11px] text-subtle">{`${magicLink}&secret=${encodeURIComponent(lastDepositSecret)}`}</p>
                  <p className="mt-2 text-[10px] text-amber-400">Warning: includes secret. Share via secure channels only.</p>
                </div>

                {/* Card 2: Separate Info */}
                <div className="rounded-xl border border-border-subtle bg-bg-elevated p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted">Deposit Details</p>
                    <button
                      onClick={() => copyToClipboard(`Depositor: ${walletAddress}\nDeposit ID: ${lastDepositId}\nSecret Code: ${lastDepositSecret}`, "All details")}
                      className="text-xs text-sol-green hover:text-sol-green/80 flex items-center gap-1"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy All
                    </button>
                  </div>

                  {/* Depositor Address */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-wider text-subtle mb-1">Depositor Address</p>
                      <p className="break-all font-mono text-xs text-foreground">{walletAddress}</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(walletAddress, "Depositor")}
                      className="shrink-0 p-1.5 rounded hover:bg-bg-secondary text-muted hover:text-foreground"
                      title="Copy"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>

                  {/* Deposit ID */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-wider text-subtle mb-1">Deposit ID</p>
                      <p className="font-mono text-xs text-foreground">{lastDepositId}</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(lastDepositId, "Deposit ID")}
                      className="shrink-0 p-1.5 rounded hover:bg-bg-secondary text-muted hover:text-foreground"
                      title="Copy"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>

                  {/* Secret Code */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-wider text-subtle mb-1">Secret Code</p>
                      <p className="font-mono text-xs text-sol-green">{lastDepositSecret}</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(lastDepositSecret, "Secret")}
                      className="shrink-0 p-1.5 rounded hover:bg-bg-secondary text-muted hover:text-foreground"
                      title="Copy"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Claim Tab */}
        {activeTab === "claim" && (
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-medium text-muted">Depositor Address</label>
              <input
                type="text"
                placeholder="Wallet address of the sender"
                value={claimDepositor}
                onChange={(e) => setClaimDepositor(e.target.value)}
                disabled={isSending}
                className="input font-mono text-xs"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-muted">Deposit ID</label>
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
              <label className="mb-2 block text-xs font-medium text-muted">Secret Code</label>
              <input
                type="text"
                placeholder="Enter the secret code"
                value={claimSecret}
                onChange={(e) => setClaimSecret(e.target.value)}
                disabled={isSending}
                className="input"
              />
            </div>

            <button
              onClick={handleClaimDeposit}
              disabled={isSending || !claimDepositId || !claimSecret || !claimDepositor}
              className="btn-primary w-full py-3"
            >
              {isSending ? <><span className="spinner" /> Claiming...</> : "Claim Funds"}
            </button>
          </div>
        )}

        {/* Status Message */}
        {txStatus && (
          <div className={`mt-4 rounded-xl border p-4 text-sm ${
            txStatusType === "success"
              ? "border-sol-green/30 bg-sol-green/5 text-sol-green"
              : txStatusType === "error"
                ? "border-red-500/30 bg-red-500/5 text-red-400"
                : "border-border-subtle bg-bg-elevated text-muted"
          }`}>
            {txStatus}
          </div>
        )}

        {/* Program Status */}
        {programDeployed === false && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
            <p className="text-sm font-medium text-red-400">Program Not Deployed</p>
            <p className="mt-1 text-xs text-red-400/70">
              Run: <code className="rounded bg-red-500/10 px-1.5 py-0.5">anchor deploy --provider.cluster devnet</code>
            </p>
          </div>
        )}

        {/* Network Info */}
        <div className="mt-6 flex items-center justify-between rounded-lg border border-border-subtle bg-bg-elevated px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="status-online" />
            <span className="text-xs font-medium text-sol-green">Devnet</span>
          </div>
          <a
            href={`https://explorer.solana.com/address/${VAULT_PROGRAM_ADDRESS}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] text-subtle hover:text-foreground transition flex items-center gap-1"
            title="View on Solana Explorer"
          >
            {VAULT_PROGRAM_ADDRESS.slice(0, 8)}...{VAULT_PROGRAM_ADDRESS.slice(-8)}
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>

      {/* QR Code Modal */}
      {showQrModal && magicLink && lastDepositSecret && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowQrModal(false)}
          />
          <div className="relative rounded-2xl border border-border-subtle bg-bg-primary p-6 shadow-2xl">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-3 right-3 p-2 rounded-lg hover:bg-white/10 transition"
              aria-label="Close"
            >
              <svg className="h-5 w-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="qr-container mx-auto" style={{ padding: "16px" }}>
              <QRCodeSVG
                value={`${magicLink}&secret=${encodeURIComponent(lastDepositSecret)}`}
                size={280}
                level="H"
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>
            <p className="mt-4 text-center text-sm text-muted">Scan to claim this deposit</p>
            <p className="mt-1 text-center text-xs text-amber-400">Contains secret code</p>
            <button
              onClick={() => {
                downloadQrCode(500);
                setShowQrModal(false);
              }}
              className="mt-4 w-full btn-primary py-2.5 flex items-center justify-center gap-2"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download PNG
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
