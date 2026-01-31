"use client";
import { useWalletConnection } from "@solana/react-hooks";
import { VaultCard } from "./components/vault-card";
import Link from "next/link";
import { useState, useEffect, useRef, ReactNode } from "react";

// Animated card component with scroll reveal
function AnimatedCard({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(40px)',
        transition: `opacity 0.6s ease-out ${delay}s, transform 0.6s ease-out ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

function TypewriterText({ texts, speed = 100, deleteSpeed = 50, pauseDuration = 2000 }: {
  texts: string[];
  speed?: number;
  deleteSpeed?: number;
  pauseDuration?: number;
}) {
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [textIndex, setTextIndex] = useState(0);

  const currentText = texts[textIndex];

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    if (!isDeleting && displayText === currentText) {
      timeout = setTimeout(() => setIsDeleting(true), pauseDuration);
    } else if (isDeleting && displayText === "") {
      timeout = setTimeout(() => {
        setTextIndex((prev) => (prev + 1) % texts.length);
        setIsDeleting(false);
      }, 500);
    } else if (isDeleting) {
      timeout = setTimeout(() => {
        setDisplayText(currentText.slice(0, displayText.length - 1));
      }, deleteSpeed);
    } else {
      timeout = setTimeout(() => {
        setDisplayText(currentText.slice(0, displayText.length + 1));
      }, speed);
    }

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, currentText, texts.length, speed, deleteSpeed, pauseDuration]);

  return (
    <span className="typewriter-text">
      {displayText}
      <span className="typewriter-cursor">|</span>
    </span>
  );
}

// Wallet definitions for fallback when extensions aren't detected
const WALLET_OPTIONS = [
  {
    id: "solflare",
    name: "Solflare",
    icon: "/solflare.png",
    downloadUrl: "https://solflare.com/download",
    recommended: true,
    detectGlobal: () => typeof window !== "undefined" && !!(window as any).solflare,
  },
  {
    id: "phantom",
    name: "Phantom",
    icon: "/phantom.png",
    downloadUrl: "https://phantom.app/download",
    recommended: false,
    detectGlobal: () => typeof window !== "undefined" && !!(window as any).phantom?.solana,
  },
];


export default function Home() {
  const { connectors, connect, disconnect, wallet, status } =
    useWalletConnection();

  const address = wallet?.account.address.toString();

  // State for showing network warning
  const [showNetworkWarning, setShowNetworkWarning] = useState(false);

  // State for connection errors
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // State for client-side detection (avoids hydration mismatch)
  const [isClient, setIsClient] = useState(false);
  const [detectedWallets, setDetectedWallets] = useState<Record<string, boolean>>({});

  // Mark as client-side and detect wallets
  useEffect(() => {
    setIsClient(true);
    const detected: Record<string, boolean> = {};
    WALLET_OPTIONS.forEach(wallet => {
      detected[wallet.id] = wallet.detectGlobal();
    });
    setDetectedWallets(detected);
  }, []);

  // Helper to find connector or fallback to download
  const handleWalletClick = async (walletOption: typeof WALLET_OPTIONS[0]) => {
    setConnectionError(null);

    const connector = connectors.find(
      (c) => c.name.toLowerCase().includes(walletOption.id)
    );

    // Real-time detection (more reliable than state)
    const isDetectedNow = walletOption.detectGlobal();

    if (connector) {
      try {
        await connect(connector.id);
      } catch (err: any) {
        console.error("Wallet connection failed:", err);
        const errorMsg = err?.message?.toLowerCase() || "";
        if (errorMsg.includes("already pending") || errorMsg.includes("resource") || errorMsg.includes("busy") || errorMsg.includes("locked")) {
          setConnectionError("Outra página está usando a carteira. Feche-a para continuar.");
        } else if (errorMsg.includes("rejected") || errorMsg.includes("denied") || errorMsg.includes("cancelled")) {
          setConnectionError("Conexão rejeitada pelo usuário.");
        } else {
          setConnectionError("Erro ao conectar. Tente novamente.");
        }
      }
    } else if (isDetectedNow) {
      // Extension detected via window global - try to connect directly
      try {
        if (walletOption.id === "solflare" && (window as any).solflare) {
          const solflare = (window as any).solflare;
          await solflare.connect();
          // Reload page to let the provider detect the connected wallet
          window.location.reload();
        } else if (walletOption.id === "phantom" && (window as any).phantom?.solana) {
          const phantom = (window as any).phantom.solana;
          await phantom.connect();
          window.location.reload();
        } else {
          setShowNetworkWarning(true);
        }
      } catch (err: any) {
        console.error("Direct wallet connection failed:", err);
        const errorMsg = err?.message?.toLowerCase() || "";
        if (errorMsg.includes("already pending") || errorMsg.includes("resource") || errorMsg.includes("busy") || errorMsg.includes("locked") || errorMsg.includes("already processing")) {
          setConnectionError("Outra página está usando a carteira. Feche-a para continuar.");
        } else if (errorMsg.includes("rejected") || errorMsg.includes("denied") || errorMsg.includes("cancelled")) {
          setConnectionError("Conexão rejeitada pelo usuário.");
        } else {
          setShowNetworkWarning(true);
        }
      }
    } else {
      // Wallet not installed - open download page
      window.open(walletOption.downloadUrl, "_blank");
    }
  };

  // Check if a wallet is available (via connector or global detection in real-time)
  const isWalletAvailable = (walletId: string) => {
    const viaConnector = connectors.some((c) => c.name.toLowerCase().includes(walletId));
    // Real-time detection only on client-side to avoid hydration mismatch
    if (isClient) {
      const walletOption = WALLET_OPTIONS.find(w => w.id === walletId);
      const directDetection = walletOption?.detectGlobal() || false;
      return viaConnector || directDetection;
    }
    return viaConnector || detectedWallets[walletId];
  };

  // Check if wallet can actually connect (connector available)
  const canWalletConnect = (walletId: string) => {
    return connectors.some((c) => c.name.toLowerCase().includes(walletId));
  };

  // Header hide/show on scroll
  const [headerVisible, setHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);

  // Wallet dropdown
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY < 100) {
        setHeaderVisible(true);
      } else if (currentScrollY > lastScrollY.current) {
        setHeaderVisible(false);
      } else {
        setHeaderVisible(true);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-bg-primary text-foreground">
      {/* Background Gradient Effects */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -top-[400px] left-1/2 h-[800px] w-[800px] -translate-x-1/2 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(153, 69, 255, 0.15) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute top-1/3 -right-[200px] h-[600px] w-[600px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(20, 241, 149, 0.08) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Header */}
      <header className={`fixed top-0 left-0 right-0 z-50 border-b border-border-subtle bg-bg-primary/80 backdrop-blur-xl transition-transform duration-300 ${headerVisible ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="container-main flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center">
            <img src="/logo-privylink.png" alt="PrivyLink" className="h-8" />
          </Link>

          <div className="flex items-center gap-4">
            {status === "connected" ? (
              <>
                <div className="hidden items-center gap-2 sm:flex">
                  <span className="status-online" />
                  <span className="text-xs font-medium text-sol-green">Devnet</span>
                </div>
                <code className="hidden rounded-md bg-bg-elevated px-3 py-1.5 font-mono text-xs text-muted lg:block">
                  {address?.slice(0, 4)}...{address?.slice(-4)}
                </code>
                <button onClick={() => disconnect()} className="btn-ghost text-xs">
                  Disconnect
                </button>
              </>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setWalletDropdownOpen(!walletDropdownOpen)}
                  className="btn-primary py-2 text-xs"
                >
                  Connect
                </button>

                {walletDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => {
                        setWalletDropdownOpen(false);
                        setConnectionError(null);
                      }}
                    />
                    <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-lg border border-border-subtle bg-bg-primary p-2 shadow-lg">
                      {connectionError && (
                        <div className="mb-2 rounded-md bg-red-500/10 border border-red-500/30 p-3">
                          <p className="text-xs text-red-400">{connectionError}</p>
                        </div>
                      )}
                      {showNetworkWarning && (
                        <div className="mb-2 rounded-md bg-amber-500/10 border border-amber-500/30 p-3">
                          <p className="text-xs text-amber-400 font-medium mb-1">Cannot connect via IP</p>
                          <p className="text-[10px] text-amber-400/80">
                            Wallet extensions only work on <strong>localhost</strong> or <strong>HTTPS</strong>.
                            Access via localhost:3000 or deploy to connect.
                          </p>
                        </div>
                      )}
                      {WALLET_OPTIONS.map((walletOption) => {
                        const installed = isWalletAvailable(walletOption.id);
                        const canConnect = canWalletConnect(walletOption.id);
                        const isAvailable = installed || canConnect;
                        return (
                          <button
                            key={walletOption.id}
                            onClick={async () => {
                              if (isAvailable) {
                                setWalletDropdownOpen(false);
                              }
                              await handleWalletClick(walletOption);
                            }}
                            disabled={status === "connecting"}
                            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm hover:bg-bg-elevated transition"
                          >
                            <img src={walletOption.icon} alt={walletOption.name} className="h-5 w-5" />
                            <span>{walletOption.name}</span>
                            {isAvailable && walletOption.recommended && (
                              <span className="ml-auto text-xs text-sol-green">Recommended</span>
                            )}
                            {isAvailable && !walletOption.recommended && (
                              <span className="ml-auto text-xs text-sol-green">Connect</span>
                            )}
                            {!isAvailable && (
                              <span className="ml-auto text-[10px] text-muted">Install</span>
                            )}
                          </button>
                        );
                      })}
                      <div className="mt-2 border-t border-border-subtle pt-2">
                        <p className="px-3 py-1 text-[10px] text-muted">Configure: Settings → Network → Devnet</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Spacer for fixed header */}
      <div className="h-16" />

      <main className="relative z-10">
        {/* ==================== HERO SECTION ==================== */}
        <section className="container-main py-24 lg:py-32">
          <div className="mx-auto max-w-4xl text-center">
            <span className="badge-purple mb-6 inline-flex items-center gap-2 text-sm px-5 py-2">
                <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <TypewriterText texts={["PRIVACY_HACKATHON_2026", "PRIVY_LINK"]} speed={80} deleteSpeed={40} pauseDuration={3000} />
              </span>

            <h1 className="heading-1 mb-6 text-5xl md:text-6xl lg:text-7xl">
              <span className="text-gradient">Private Transfers</span>
              <br />
              <span>on Solana</span>
            </h1>

            <p className="body-large mx-auto mb-10 max-w-2xl">
              Send SOL without linking wallets. No direct on-chain connection
              between sender and receiver. True financial privacy.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <a href="?tab=send#send" className="btn-primary px-8 py-4 text-base">
                Send Privately
              </a>
              <a href="?tab=claim#send" className="btn-secondary px-8 py-4 text-base">
                Claim Transfer
              </a>
            </div>
          </div>
        </section>

        {/* ==================== HOW IT WORKS ==================== */}
        <section id="how-it-works" className="container-main py-24 scroll-mt-20">
          <div className="mb-16 text-center">
            <h2 className="heading-2 mb-4">How It Works</h2>
            <p className="body-large mx-auto max-w-xl">
              Three simple steps to private transfers
            </p>
          </div>

          {/* Flow Diagram */}
          <div className="mb-12 flex items-center justify-center gap-2 text-sm text-muted">
            <span className="rounded-lg bg-sol-purple/20 px-3 py-1.5 text-sol-purple font-medium">Sender</span>
            <svg className="h-4 w-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            <span className="rounded-lg bg-white/10 px-3 py-1.5 text-white font-medium">Vault PDA</span>
            <svg className="h-4 w-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            <span className="rounded-lg bg-sol-green/20 px-3 py-1.5 text-sol-green font-medium">Receiver</span>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {/* Step 1 */}
            <AnimatedCard className="card-hover text-center" delay={0}>
              <div className="step-number mx-auto mb-6">1</div>
              <h3 className="heading-3 mb-3">Commit Funds</h3>
              <p className="body-small">
                Deposit SOL into a neutral vault PDA with a secret hash.
                Your funds are securely locked until claimed or refunded.
              </p>
            </AnimatedCard>

            {/* Step 2 */}
            <AnimatedCard className="card-hover text-center" delay={0.15}>
              <div className="step-number mx-auto mb-6">2</div>
              <h3 className="heading-3 mb-3">Share Private Link</h3>
              <p className="body-small">
                Generate a magic link with the deposit details.
                Share it with your recipient through any secure channel.
              </p>
            </AnimatedCard>

            {/* Step 3 */}
            <AnimatedCard className="card-hover text-center" delay={0.3}>
              <div className="step-number mx-auto mb-6">3</div>
              <h3 className="heading-3 mb-3">Claim with Secret</h3>
              <p className="body-small">
                The recipient proves knowledge of the secret code
                and receives the SOL directly to their wallet.
              </p>
            </AnimatedCard>
          </div>
        </section>

        {/* ==================== SEND / CLAIM SECTION ==================== */}
        <section id="send" className="container-main py-24 scroll-mt-20">
          <div className="mx-auto max-w-3xl space-y-6">
            {/* Wallet Card - Top */}
            <div className="card">
              {status !== "connected" ? (
                <div className="flex flex-col gap-4">
                  {connectionError && (
                    <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4">
                      <p className="text-sm text-red-400">{connectionError}</p>
                    </div>
                  )}
                  {showNetworkWarning && (
                    <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-4">
                      <p className="text-sm text-amber-400 font-medium mb-1">Cannot connect via network IP</p>
                      <p className="text-xs text-amber-400/80">
                        Wallet extensions only work on <strong>localhost</strong> or <strong>HTTPS</strong> domains.
                        Please access via <a href="http://localhost:3000" className="underline">localhost:3000</a> or use the deployed version.
                      </p>
                    </div>
                  )}
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="heading-3 mb-1">Connect Wallet</h2>
                      <p className="text-xs text-muted">Settings → Network → Devnet</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {WALLET_OPTIONS.map((walletOption, index) => {
                        const installed = isWalletAvailable(walletOption.id);
                        const canConnect = canWalletConnect(walletOption.id);
                        const isAvailable = installed || canConnect;
                        return (
                          <button
                            key={walletOption.id}
                            onClick={() => handleWalletClick(walletOption)}
                            disabled={status === "connecting"}
                            className={`${index === 0 ? 'btn-primary' : 'btn-secondary'} gap-2 py-2.5`}
                          >
                            <img src={walletOption.icon} alt={walletOption.name} className="h-5 w-5" />
                            {walletOption.name}
                            {!isAvailable && (
                              <span className="text-[10px] opacity-70">(Install)</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="status-online" />
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-muted">Connected</p>
                      <code className="font-mono text-sm">{address?.slice(0, 8)}...{address?.slice(-8)}</code>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link href="/deposits" className="btn-secondary py-2.5">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      My Transfers
                    </Link>
                    <button onClick={() => disconnect()} className="btn-ghost text-xs">
                      Disconnect
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Vault Card - Full Width */}
            <VaultCard />
          </div>
        </section>

        {/* ==================== PRIVACY FEATURES ==================== */}
        <section id="features" className="container-main py-24 scroll-mt-20">
          <div className="mb-16 text-center">
            <h2 className="heading-2 mb-4">Privacy by Design</h2>
            <p className="body-large mx-auto max-w-xl">
              Built from the ground up for unlinkability
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
                title: "No Direct Transfers",
                desc: "Sender and receiver never interact directly on-chain. All funds flow through neutral vault PDAs."
              },
              {
                icon: "M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z",
                title: "No On-Chain Recipient",
                desc: "The recipient is never defined on-chain. Only the hash of a secret is stored."
              },
              {
                icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1",
                title: "Unlinkability by Default",
                desc: "Transactions are unlinkable. No blockchain analyst can prove sender-receiver relationships."
              },
              {
                icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
                title: "SHA-256 Verification",
                desc: "Cryptographic proof ensures only the intended recipient can claim the funds."
              },
              {
                icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
                title: "Auto-Expiration",
                desc: "Unclaimed deposits automatically become refundable after the set expiration time."
              },
              {
                icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
                title: "Open Source",
                desc: "Fully auditable smart contracts and frontend. Trust through transparency."
              },
            ].map((feature, i) => (
              <AnimatedCard key={i} className="card-glow" delay={i * 0.1}>
                <div className="feature-icon mb-4">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.icon} />
                  </svg>
                </div>
                <h3 className="heading-3 mb-2">{feature.title}</h3>
                <p className="body-small">{feature.desc}</p>
              </AnimatedCard>
            ))}
          </div>
        </section>

        {/* ==================== ROADMAP ==================== */}
        <section className="container-main py-24">
          <div className="mb-16 text-center">
            <h2 className="heading-2 mb-4">Roadmap</h2>
            <p className="body-large mx-auto max-w-xl">
              From basic privacy to full anonymity
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Phase 1 */}
            <AnimatedCard className="card" delay={0}>
              <span className="badge-green mb-4">Complete</span>
              <h3 className="heading-3 mb-3">Phase 1: PDA Vaults</h3>
              <ul className="space-y-2">
                {["Private deposits with hash", "Secret-based claims", "Auto-expiration & refunds", "Magic links with QR codes"].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-muted">
                    <svg className="h-4 w-4 flex-shrink-0 text-sol-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </AnimatedCard>

            {/* Phase 2 */}
            <AnimatedCard className="card" delay={0.15}>
              <span className="badge-purple mb-4">Planned</span>
              <h3 className="heading-3 mb-3">Phase 2: Arcium MPC</h3>
              <ul className="space-y-2">
                {["Multi-party computation", "Enhanced unlinkability", "Threshold signatures", "Distributed key generation"].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-muted">
                    <span className="h-4 w-4 flex-shrink-0 rounded-full border border-current" />
                    {item}
                  </li>
                ))}
              </ul>
            </AnimatedCard>

            {/* Phase 3 */}
            <AnimatedCard className="card" delay={0.3}>
              <span className="badge mb-4">Future</span>
              <h3 className="heading-3 mb-3">Phase 3: Global Vault + ZK</h3>
              <ul className="space-y-2">
                {["Zero-knowledge proofs", "Shared anonymity pool", "Cross-chain privacy", "Full privacy guarantees"].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-muted">
                    <span className="h-4 w-4 flex-shrink-0 rounded-full border border-current" />
                    {item}
                  </li>
                ))}
              </ul>
            </AnimatedCard>
          </div>
        </section>

        {/* ==================== FOOTER ==================== */}
        <footer className="border-t border-border-subtle">
          <div className="container-main py-12">
            <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
              <div className="flex items-center">
                <img src="/logo-privylink.png" alt="PrivyLink" className="h-8" />
              </div>

              <div className="flex items-center gap-6">
                <a
                  href="https://github.com/renner16/privylink"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-muted transition hover:text-foreground"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                  <span className="hidden sm:inline">Open Source</span>
                </a>
                <span className="text-border-subtle">|</span>
                <a
                  href="https://explorer.solana.com/address/98WwJxc1aAeqGWuaouQntJYmdQEnELntf9BqKXD3o34W?cluster=devnet"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-muted transition hover:text-foreground"
                  title="View program on Solana Explorer"
                >
                  <span className="status-online" />
                  <span className="text-sol-green">Devnet</span>
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                <span className="text-border-subtle">|</span>
                <a
                  href="https://solana.com/pt/privacyhack"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted transition hover:text-foreground"
                >
                  Built for <span className="text-gradient font-medium">Solana Privacy Hack 2026</span>
                  <svg className="inline-block ml-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>

            <p className="mt-8 text-center text-xs text-muted">
              Privacy is not a luxury, it's a fundamental right.
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
