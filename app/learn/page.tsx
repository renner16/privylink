"use client";
import Link from "next/link";
import { useState, useEffect, useRef, ReactNode } from "react";
import { useWalletConnection } from "@solana/react-hooks";

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

// Typewriter effect component
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

// Expandable Myth Card
function MythCard({ myth, reality, isFalse = true }: { myth: string; reality: string; isFalse?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="card cursor-pointer transition-all hover:bg-bg-card-hover"
      onClick={() => setIsOpen(!isOpen)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs font-bold uppercase tracking-wider ${isFalse ? 'text-red-400' : 'text-sol-green'}`}>
              {isFalse ? 'MYTH' : 'TRUTH'}
            </span>
          </div>
          <p className="font-medium text-foreground">{myth}</p>
        </div>
        <svg
          className={`h-5 w-5 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {isOpen && (
        <div className="mt-4 pt-4 border-t border-border-subtle">
          <div className="flex items-start gap-2">
            <span className={`text-lg ${isFalse ? 'text-red-400' : 'text-sol-green'}`}>
              {isFalse ? '❌' : '✅'}
            </span>
            <p className="text-sm text-muted leading-relaxed">{reality}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LearnPage() {
  const { status, disconnect, wallet } = useWalletConnection();
  const address = wallet?.account.address.toString();

  // Header hide/show on scroll
  const [headerVisible, setHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);

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
            <Link href="/" className="text-sm text-muted hover:text-foreground transition-colors">
              Home
            </Link>
            <span className="text-sm text-sol-purple font-medium">
              Learn
            </span>
            {status === "connected" && (
              <>
                <Link href="/deposits" className="text-sm text-muted hover:text-foreground transition-colors">
                  My Transfers
                </Link>
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
            )}
            {status !== "connected" && (
              <Link href="/" className="btn-primary py-2 text-xs">
                Try PrivyLink
              </Link>
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <TypewriterText texts={["PRIVACY_GUIDE", "CRYPTO_PRIVACY"]} speed={80} deleteSpeed={40} pauseDuration={3000} />
            </span>

            <h1 className="heading-1 mb-6 text-5xl md:text-6xl lg:text-7xl">
              <span className="text-gradient">Understanding</span>
              <br />
              <span>Crypto Privacy</span>
            </h1>

            <p className="body-large mx-auto mb-10 max-w-2xl">
              Blockchain is transparent by design - but that means everyone can see your transactions.
              Learn how to protect your financial privacy without technical complexity.
            </p>
          </div>
        </section>

        {/* ==================== THE PROBLEM ==================== */}
        <section className="container-main py-24">
          <div className="mb-16 text-center">
            <h2 className="heading-2 mb-4">The Problem: On-Chain Surveillance</h2>
            <p className="body-large mx-auto max-w-xl">
              Your transactions are more exposed than you think
            </p>
          </div>

          {/* What's Visible On-Chain */}
          <AnimatedCard className="mb-12" delay={0}>
            <h3 className="heading-3 mb-6 flex items-center gap-2">
              <svg className="h-6 w-6 text-sol-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              What&apos;s Visible On-Chain?
            </h3>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-8">
              {[
                { label: "Sender address", status: "public" },
                { label: "Receiver address", status: "public" },
                { label: "Amount sent", status: "public" },
                { label: "Timestamp", status: "public" },
                { label: "Complete wallet history", status: "public" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3">
                  <svg className="h-4 w-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span className="text-sm text-foreground">{item.label}</span>
                  <span className="ml-auto text-xs text-red-400 uppercase font-medium">{item.status}</span>
                </div>
              ))}
            </div>

            {/* Example Card */}
            <div className="card bg-bg-elevated">
              <p className="text-sm font-medium text-sol-purple mb-3">Example: When Alice sends 5 SOL to Bob</p>
              <div className="flex flex-col sm:flex-row items-center gap-4 text-center">
                <div className="rounded-lg bg-bg-secondary px-4 py-3 font-mono text-sm">
                  <span className="text-muted text-xs block mb-1">Sender</span>
                  ABC123...
                </div>
                <svg className="h-5 w-5 text-sol-purple rotate-90 sm:rotate-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                <div className="rounded-lg bg-bg-secondary px-4 py-3 font-mono text-sm">
                  <span className="text-muted text-xs block mb-1">Receiver</span>
                  XYZ789...
                </div>
              </div>
              <p className="text-sm text-muted mt-4">
                Anyone can see the connection, amount, and both wallets&apos; full history.
              </p>
            </div>
          </AnimatedCard>

          {/* Who's Watching */}
          <AnimatedCard className="mb-12" delay={0.1}>
            <h3 className="heading-3 mb-6 flex items-center gap-2">
              <svg className="h-6 w-6 text-sol-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Who&apos;s Watching?
            </h3>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: "🔍", title: "Blockchain Explorers", desc: "Solscan, Solana Explorer, SolanaFM" },
                { icon: "🏢", title: "Analytics Companies", desc: "Chainalysis, Elliptic, TRM Labs" },
                { icon: "🤖", title: "Trading Bots", desc: "Copy whale strategies, front-running" },
                { icon: "⚠️", title: "Bad Actors", desc: "Target high-balance wallets for phishing" },
              ].map((item, i) => (
                <div key={i} className="card text-center">
                  <span className="text-3xl mb-3 block">{item.icon}</span>
                  <h4 className="font-medium text-foreground mb-1">{item.title}</h4>
                  <p className="text-xs text-muted">{item.desc}</p>
                </div>
              ))}
            </div>
          </AnimatedCard>

          {/* Real Consequences */}
          <AnimatedCard delay={0.2}>
            <h3 className="heading-3 mb-6 flex items-center gap-2">
              <svg className="h-6 w-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Real Consequences
            </h3>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { title: "Financial Exposure", desc: "Your balance is public to everyone" },
                { title: "Targeted Attacks", desc: "Phishing and scams targeting known holders" },
                { title: "Discrimination", desc: "Exchanges may deny service based on history" },
                { title: "Relationship Surveillance", desc: "Governments and companies tracking connections" },
                { title: "Front-running", desc: "Bots anticipate and exploit your trades" },
                { title: "Social Engineering", desc: "Attackers use your on-chain data against you" },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg bg-red-500/5 border border-red-500/20 p-4">
                  <svg className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <div>
                    <h4 className="font-medium text-foreground text-sm">{item.title}</h4>
                    <p className="text-xs text-muted mt-1">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </AnimatedCard>
        </section>

        {/* ==================== TYPES OF PRIVACY ==================== */}
        <section className="container-main py-24">
          <div className="mb-16 text-center">
            <h2 className="heading-2 mb-4">Types of Privacy</h2>
            <p className="body-large mx-auto max-w-xl">
              Different tools solve different privacy problems
            </p>
          </div>

          {/* Comparison Table */}
          <AnimatedCard className="mb-12 overflow-x-auto" delay={0}>
            <div className="card min-w-[600px]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-subtle">
                    <th className="text-left py-3 px-4 font-medium text-muted">Type</th>
                    <th className="text-left py-3 px-4 font-medium text-muted">What it Hides</th>
                    <th className="text-left py-3 px-4 font-medium text-muted">Complexity</th>
                    <th className="text-left py-3 px-4 font-medium text-muted">Example</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border-subtle">
                    <td className="py-4 px-4 font-medium text-foreground">Relationship Privacy</td>
                    <td className="py-4 px-4 text-muted">Who → Who</td>
                    <td className="py-4 px-4">
                      <span className="badge-green">Simple</span>
                    </td>
                    <td className="py-4 px-4 text-sol-purple font-medium">PrivyLink</td>
                  </tr>
                  <tr className="border-b border-border-subtle">
                    <td className="py-4 px-4 font-medium text-foreground">Amount Privacy</td>
                    <td className="py-4 px-4 text-muted">Transaction values</td>
                    <td className="py-4 px-4">
                      <span className="badge-purple">Medium</span>
                    </td>
                    <td className="py-4 px-4 text-sol-purple font-medium">Encifher (FHE)</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-4 font-medium text-foreground">Full Anonymity</td>
                    <td className="py-4 px-4 text-muted">Everything</td>
                    <td className="py-4 px-4">
                      <span className="badge">High</span>
                    </td>
                    <td className="py-4 px-4 text-sol-purple font-medium">Monero, ZCash</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </AnimatedCard>

          {/* When to Use Each */}
          <div className="grid gap-6 lg:grid-cols-3">
            <AnimatedCard className="card-glow" delay={0.1}>
              <div className="flex items-center gap-3 mb-4">
                <div className="feature-icon">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <h3 className="heading-3">Relationship Privacy</h3>
              </div>
              <p className="text-sm text-sol-purple font-medium mb-4">PrivyLink</p>
              <ul className="space-y-2">
                {["Hide wallet connections", "Send to friends/family privately", "Simple UX (magic links)", "Amounts are visible (acceptable trade-off)"].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-muted">
                    <svg className="h-4 w-4 flex-shrink-0 text-sol-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </AnimatedCard>

            <AnimatedCard className="card-glow" delay={0.2}>
              <div className="flex items-center gap-3 mb-4">
                <div className="feature-icon">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="heading-3">Amount Privacy</h3>
              </div>
              <p className="text-sm text-sol-purple font-medium mb-4">Encifher (FHE)</p>
              <ul className="space-y-2">
                {["Hide transaction amounts", "Private swaps without revealing volumes", "Technical complexity (FHE)", "Addresses visible (encrypted)"].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-muted">
                    <svg className="h-4 w-4 flex-shrink-0 text-sol-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </AnimatedCard>

            <AnimatedCard className="card-glow" delay={0.3}>
              <div className="flex items-center gap-3 mb-4">
                <div className="feature-icon">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="heading-3">Full Anonymity</h3>
              </div>
              <p className="text-sm text-sol-purple font-medium mb-4">ZK / Monero</p>
              <ul className="space-y-2">
                {["Hide everything", "Advanced technical knowledge required", "Higher transaction costs", "Privacy is priority #1"].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-muted">
                    <svg className="h-4 w-4 flex-shrink-0 text-sol-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </AnimatedCard>
          </div>
        </section>

        {/* ==================== HOW TO PROTECT YOURSELF ==================== */}
        <section className="container-main py-24">
          <div className="mb-16 text-center">
            <h2 className="heading-2 mb-4">How to Protect Yourself</h2>
            <p className="body-large mx-auto max-w-xl">
              Practical tips you can apply today
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Tip 1 */}
            <AnimatedCard className="card" delay={0}>
              <div className="step-number mb-4">1</div>
              <h3 className="heading-3 mb-3">Use Separate Wallets</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-red-400">
                  <span>❌</span> One wallet for everything
                </div>
                <div className="flex items-center gap-2 text-sol-green">
                  <span>✅</span> Wallet A: Trading
                </div>
                <div className="flex items-center gap-2 text-sol-green">
                  <span>✅</span> Wallet B: Savings
                </div>
                <div className="flex items-center gap-2 text-sol-green">
                  <span>✅</span> Wallet C: DeFi
                </div>
              </div>
            </AnimatedCard>

            {/* Tip 2 */}
            <AnimatedCard className="card" delay={0.1}>
              <div className="step-number mb-4">2</div>
              <h3 className="heading-3 mb-3">Break On-Chain Links</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-sol-green">
                  <span>✅</span> Use tools like PrivyLink between wallets
                </div>
                <div className="flex items-center gap-2 text-sol-green">
                  <span>✅</span> Wait time between related transfers
                </div>
                <div className="flex items-center gap-2 text-sol-green">
                  <span>✅</span> Vary amounts (avoid exact values)
                </div>
              </div>
            </AnimatedCard>

            {/* Tip 3 */}
            <AnimatedCard className="card" delay={0.2}>
              <div className="step-number mb-4">3</div>
              <h3 className="heading-3 mb-3">Avoid Exposing Relationships</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-red-400">
                  <span>❌</span> Direct transfer to friend/family
                </div>
                <div className="flex items-center gap-2 text-sol-green">
                  <span>✅</span> Use intermediary (PDA vault, privacy tool)
                </div>
              </div>
            </AnimatedCard>

            {/* Tip 4 */}
            <AnimatedCard className="card" delay={0.3}>
              <div className="step-number mb-4">4</div>
              <h3 className="heading-3 mb-3">Don&apos;t Reuse Wallets</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-sol-green">
                  <span>✅</span> Fresh wallet for large sales
                </div>
                <div className="flex items-center gap-2 text-sol-green">
                  <span>✅</span> Fresh wallet after public exposure
                </div>
              </div>
            </AnimatedCard>

            {/* Tip 5 */}
            <AnimatedCard className="card" delay={0.4}>
              <div className="step-number mb-4">5</div>
              <h3 className="heading-3 mb-3">Watch Your Metadata</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-red-400">
                  <span>❌</span> Post address on Twitter
                </div>
                <div className="flex items-center gap-2 text-red-400">
                  <span>❌</span> Same name in ENS and social media
                </div>
                <div className="flex items-center gap-2 text-sol-green">
                  <span>✅</span> Keep addresses separate from identity
                </div>
              </div>
            </AnimatedCard>

            {/* Pro Tip */}
            <AnimatedCard className="card bg-sol-purple/10 border-sol-purple/30" delay={0.5}>
              <div className="flex items-center gap-2 mb-4">
                <svg className="h-6 w-6 text-sol-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span className="text-sm font-medium text-sol-purple">Pro Tip</span>
              </div>
              <h3 className="heading-3 mb-3">Layer Your Privacy</h3>
              <p className="text-sm text-muted">
                Combine tools for maximum protection! Example: PrivyLink + Encifher = relationship + amount privacy.
              </p>
            </AnimatedCard>
          </div>
        </section>

        {/* ==================== PRIVACY TOOLS COMPARISON ==================== */}
        <section className="container-main py-24">
          <div className="mb-16 text-center">
            <h2 className="heading-2 mb-4">Privacy Tools Comparison</h2>
            <p className="body-large mx-auto max-w-xl">
              Honest comparison of available tools
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* PrivyLink */}
            <AnimatedCard className="card-glow" delay={0}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🔐</span>
                <h3 className="heading-3">PrivyLink</h3>
              </div>
              <div className="space-y-3 text-sm mb-6">
                <div>
                  <span className="text-muted">What:</span>
                  <span className="ml-2 text-foreground">Private transfers via magic links</span>
                </div>
                <div>
                  <span className="text-muted">Hides:</span>
                  <span className="ml-2 text-sol-green">Sender-receiver connection</span>
                </div>
                <div>
                  <span className="text-muted">Visible:</span>
                  <span className="ml-2 text-foreground">Amounts, timing</span>
                </div>
                <div>
                  <span className="text-muted">UX:</span>
                  <span className="ml-2 text-sol-green">⭐⭐⭐⭐⭐ Very simple</span>
                </div>
                <div>
                  <span className="text-muted">Tech:</span>
                  <span className="ml-2 text-foreground">SHA-256 + PDA vaults</span>
                </div>
                <div>
                  <span className="text-muted">Cost:</span>
                  <span className="ml-2 text-foreground">Low (2 transactions)</span>
                </div>
              </div>
              <Link href="/" className="btn-primary w-full text-center">
                Try PrivyLink
              </Link>
            </AnimatedCard>

            {/* Encifher */}
            <AnimatedCard className="card-glow" delay={0.1}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🔐</span>
                <h3 className="heading-3">Encifher</h3>
              </div>
              <div className="space-y-3 text-sm mb-6">
                <div>
                  <span className="text-muted">What:</span>
                  <span className="ml-2 text-foreground">Private swaps with FHE</span>
                </div>
                <div>
                  <span className="text-muted">Hides:</span>
                  <span className="ml-2 text-sol-green">Transaction amounts</span>
                </div>
                <div>
                  <span className="text-muted">Visible:</span>
                  <span className="ml-2 text-foreground">Addresses (encrypted)</span>
                </div>
                <div>
                  <span className="text-muted">UX:</span>
                  <span className="ml-2 text-foreground">⭐⭐⭐ Moderate</span>
                </div>
                <div>
                  <span className="text-muted">Tech:</span>
                  <span className="ml-2 text-foreground">Fully Homomorphic Encryption</span>
                </div>
                <div>
                  <span className="text-muted">Cost:</span>
                  <span className="ml-2 text-foreground">Medium</span>
                </div>
              </div>
              <a
                href="https://app.encifher.io"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary w-full text-center flex items-center justify-center gap-2"
              >
                Learn More
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </AnimatedCard>

            {/* Light Protocol */}
            <AnimatedCard className="card-glow" delay={0.2}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🔐</span>
                <h3 className="heading-3">Light Protocol</h3>
              </div>
              <div className="space-y-3 text-sm mb-6">
                <div>
                  <span className="text-muted">What:</span>
                  <span className="ml-2 text-foreground">ZK compressed state</span>
                </div>
                <div>
                  <span className="text-muted">Hides:</span>
                  <span className="ml-2 text-sol-green">Account state</span>
                </div>
                <div>
                  <span className="text-muted">Visible:</span>
                  <span className="ml-2 text-foreground">Varies by implementation</span>
                </div>
                <div>
                  <span className="text-muted">UX:</span>
                  <span className="ml-2 text-foreground">⭐⭐⭐ Developer-focused</span>
                </div>
                <div>
                  <span className="text-muted">Tech:</span>
                  <span className="ml-2 text-foreground">ZK compression</span>
                </div>
                <div>
                  <span className="text-muted">Cost:</span>
                  <span className="ml-2 text-foreground">Low (compression benefits)</span>
                </div>
              </div>
              <a
                href="https://www.lightprotocol.com"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary w-full text-center flex items-center justify-center gap-2"
              >
                Learn More
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </AnimatedCard>
          </div>

          {/* Tip Box */}
          <AnimatedCard className="mt-8" delay={0.3}>
            <div className="card bg-sol-purple/10 border-sol-purple/30 text-center">
              <p className="text-lg font-medium text-foreground mb-2">
                💡 Combine tools for layered privacy!
              </p>
              <p className="text-sm text-muted">
                Example: PrivyLink + Encifher = relationship + amount privacy
              </p>
            </div>
          </AnimatedCard>
        </section>

        {/* ==================== MYTHS VS REALITY ==================== */}
        <section className="container-main py-24">
          <div className="mb-16 text-center">
            <h2 className="heading-2 mb-4">Myths vs Reality</h2>
            <p className="body-large mx-auto max-w-xl">
              Click to expand and learn the truth
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <AnimatedCard delay={0}>
              <MythCard
                myth={`"Blockchain is anonymous"`}
                reality="FALSE - Blockchain is pseudonymous (addresses have no names attached), BUT all transactions are public and traceable. Anyone can see every transaction ever made and follow the money trail."
              />
            </AnimatedCard>

            <AnimatedCard delay={0.1}>
              <MythCard
                myth={`"VPN protects me on-chain"`}
                reality="FALSE - A VPN hides your IP address, not your on-chain transactions. Blockchain transactions don't depend on IP addresses - they're signed with your wallet's private key and broadcast globally."
              />
            </AnimatedCard>

            <AnimatedCard delay={0.2}>
              <MythCard
                myth={`"Privacy is only for criminals"`}
                reality="FALSE - Privacy is a fundamental right. Legitimate uses include: salary privacy (employer doesn't need to see your balance), charitable donations without public exposure, and purchases without merchants seeing your total wealth."
              />
            </AnimatedCard>

            <AnimatedCard delay={0.3}>
              <MythCard
                myth={`"100% privacy is possible"`}
                reality="FALSE - Even with the best tools, timing analysis and network analysis can reveal patterns. Use privacy in layers (defense in depth) and accept that perfect privacy is a spectrum, not a binary."
              />
            </AnimatedCard>

            <AnimatedCard className="lg:col-span-2" delay={0.4}>
              <MythCard
                myth={`"Privacy requires trade-offs"`}
                reality="TRUE - There's always a balance between simplicity, privacy level, and cost. Choose based on your specific needs. PrivyLink optimizes for simplicity while providing meaningful relationship privacy."
                isFalse={false}
              />
            </AnimatedCard>
          </div>
        </section>

        {/* ==================== ADDITIONAL RESOURCES ==================== */}
        <section className="container-main py-24">
          <div className="mb-16 text-center">
            <h2 className="heading-2 mb-4">Additional Resources</h2>
            <p className="body-large mx-auto max-w-xl">
              Continue your privacy journey
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Learn More */}
            <AnimatedCard className="card" delay={0}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">📚</span>
                <h3 className="heading-3">Learn More</h3>
              </div>
              <ul className="space-y-3">
                <li>
                  <a
                    href="https://github.com/catmcgee/awesome-privacy-on-solana"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted hover:text-sol-purple transition-colors flex items-center gap-2"
                  >
                    Awesome Privacy on Solana
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </li>
                <li>
                  <a
                    href="https://solana.com/pt/privacyhack"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted hover:text-sol-purple transition-colors flex items-center gap-2"
                  >
                    Solana Privacy Hackathon
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.encrypt.trade"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted hover:text-sol-purple transition-colors flex items-center gap-2"
                  >
                    Encrypt.trade
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </li>
              </ul>
            </AnimatedCard>

            {/* Tools Mentioned */}
            <AnimatedCard className="card" delay={0.1}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">🛠️</span>
                <h3 className="heading-3">Tools Mentioned</h3>
              </div>
              <ul className="space-y-3">
                <li>
                  <Link
                    href="/"
                    className="text-sm text-muted hover:text-sol-purple transition-colors flex items-center gap-2"
                  >
                    PrivyLink
                    <span className="text-xs text-sol-green">(You&apos;re here!)</span>
                  </Link>
                </li>
                <li>
                  <a
                    href="https://app.encifher.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted hover:text-sol-purple transition-colors flex items-center gap-2"
                  >
                    Encifher
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.lightprotocol.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted hover:text-sol-purple transition-colors flex items-center gap-2"
                  >
                    Light Protocol
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </li>
              </ul>
            </AnimatedCard>

            {/* Check Your Exposure */}
            <AnimatedCard className="card" delay={0.2}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">🔍</span>
                <h3 className="heading-3">Check Your Exposure</h3>
              </div>
              <ul className="space-y-3">
                <li>
                  <a
                    href="https://solscan.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted hover:text-sol-purple transition-colors flex items-center gap-2"
                  >
                    Solscan
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </li>
                <li>
                  <a
                    href="https://explorer.solana.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted hover:text-sol-purple transition-colors flex items-center gap-2"
                  >
                    Solana Explorer
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </li>
                <li>
                  <a
                    href="https://solana.fm"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted hover:text-sol-purple transition-colors flex items-center gap-2"
                  >
                    SolanaFM
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </li>
              </ul>
            </AnimatedCard>
          </div>
        </section>

        {/* ==================== CALL TO ACTION ==================== */}
        <section className="container-main py-24">
          <AnimatedCard delay={0}>
            <div className="card text-center py-16">
              <h2 className="heading-2 mb-4">Protect Your Privacy Today</h2>
              <p className="body-large mx-auto mb-8 max-w-xl">
                Start using PrivyLink to break the on-chain connection between your wallets.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link href="/" className="btn-primary px-8 py-4 text-base">
                  Try PrivyLink
                </Link>
                <Link href="/" className="btn-secondary px-8 py-4 text-base">
                  Back to Home
                </Link>
              </div>
              <p className="text-sm text-muted mt-8">
                Privacy is not a luxury. It&apos;s a fundamental right.
              </p>
            </div>
          </AnimatedCard>
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
                <Link href="/" className="text-sm text-muted transition hover:text-foreground">
                  Home
                </Link>
                <span className="text-border-subtle">|</span>
                <a
                  href="https://solana.com/pt/privacyhack"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted transition hover:text-foreground"
                >
                  Built for <span className="text-gradient font-medium">Solana Privacy Hack 2026</span>
                </a>
              </div>
            </div>

            <p className="mt-8 text-center text-xs text-muted">
              Privacy is not a luxury, it&apos;s a fundamental right.
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
