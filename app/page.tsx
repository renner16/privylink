"use client";
import { useWalletConnection } from "@solana/react-hooks";
import { VaultCard } from "./components/vault-card";
import Link from "next/link";

export default function Home() {
  const { connectors, connect, disconnect, wallet, status } =
    useWalletConnection();

  const address = wallet?.account.address.toString();

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
      <header className="sticky top-0 z-50 border-b border-border-subtle bg-bg-primary/80 backdrop-blur-xl">
        <div className="container-main flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sol-purple">
              <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <span className="text-lg font-semibold">PrivyLink</span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            <a href="#how-it-works" className="text-sm text-muted transition hover:text-foreground">
              How It Works
            </a>
            <a href="#features" className="text-sm text-muted transition hover:text-foreground">
              Features
            </a>
            <Link href="/deposits" className="text-sm text-muted transition hover:text-foreground">
              My Deposits
            </Link>
          </nav>

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
              <span className="text-sm text-muted">Not Connected</span>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* ==================== HERO SECTION ==================== */}
        <section className="container-main py-24 lg:py-32">
          <div className="mx-auto max-w-4xl text-center">
            <span className="badge-purple mb-6 inline-flex">Solana Privacy Hack 2026</span>

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
              <a href="#send" className="btn-primary px-8 py-4 text-base">
                Send Privately
              </a>
              <a href="#send" className="btn-secondary px-8 py-4 text-base">
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

          <div className="grid gap-8 md:grid-cols-3">
            {/* Step 1 */}
            <div className="card-hover text-center">
              <div className="step-number mx-auto mb-6">1</div>
              <h3 className="heading-3 mb-3">Commit Funds</h3>
              <p className="body-small">
                Deposit SOL into a neutral vault PDA with a secret hash.
                Your funds are securely locked until claimed or refunded.
              </p>
            </div>

            {/* Step 2 */}
            <div className="card-hover text-center">
              <div className="step-number mx-auto mb-6">2</div>
              <h3 className="heading-3 mb-3">Share Private Link</h3>
              <p className="body-small">
                Generate a magic link with the deposit details.
                Share it with your recipient through any secure channel.
              </p>
            </div>

            {/* Step 3 */}
            <div className="card-hover text-center">
              <div className="step-number mx-auto mb-6">3</div>
              <h3 className="heading-3 mb-3">Claim with Secret</h3>
              <p className="body-small">
                The recipient proves knowledge of the secret code
                and receives the SOL directly to their wallet.
              </p>
            </div>
          </div>
        </section>

        {/* ==================== SEND / CLAIM SECTION ==================== */}
        <section id="send" className="container-main py-24 scroll-mt-20">
          <div className="grid gap-8 lg:grid-cols-5">
            {/* Wallet Sidebar */}
            <div className="lg:col-span-2">
              <div className="card lg:sticky lg:top-24">
                <h2 className="heading-3 mb-4">Connect Wallet</h2>

                {status !== "connected" ? (
                  <div className="space-y-4">
                    {/* Solflare - Primary */}
                    {(() => {
                      const solflare = connectors.find(
                        (c) => c.name.toLowerCase().includes("solflare")
                      );
                      if (solflare) {
                        return (
                          <button
                            onClick={() => connect(solflare.id)}
                            disabled={status === "connecting"}
                            className="btn-primary w-full justify-start gap-3 py-4"
                          >
                            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
                              <svg className="h-6 w-6" viewBox="0 0 32 32" fill="currentColor">
                                <path d="M16 0L3 8v16l13 8 13-8V8L16 0zm0 4l9 5.5v11L16 26l-9-5.5v-11L16 4z" />
                              </svg>
                            </span>
                            <span className="text-left">
                              <span className="block font-semibold">Solflare</span>
                              <span className="block text-xs opacity-70">Recommended</span>
                            </span>
                          </button>
                        );
                      }
                      return null;
                    })()}

                    {/* Other Wallets */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted">
                        Other Wallets
                      </p>
                      {connectors
                        .filter((c) => !c.name.toLowerCase().includes("solflare"))
                        .map((connector) => (
                          <button
                            key={connector.id}
                            onClick={() => connect(connector.id)}
                            disabled={status === "connecting"}
                            className="card-hover w-full p-4 text-left"
                          >
                            <span className="font-medium">{connector.name}</span>
                          </button>
                        ))}
                    </div>

                    {/* Devnet Notice */}
                    <div className="rounded-lg border border-sol-purple/20 bg-sol-purple/5 p-4">
                      <p className="text-xs font-medium text-sol-purple">Configure for Devnet</p>
                      <p className="mt-1 text-xs text-muted">
                        Settings → Network → Devnet
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-lg bg-bg-elevated p-4">
                      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted">
                        Connected Wallet
                      </p>
                      <code className="block break-all font-mono text-sm">{address}</code>
                    </div>
                    <Link href="/deposits" className="btn-secondary w-full">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      My Deposits
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Vault Card */}
            <div className="lg:col-span-3">
              <VaultCard />
            </div>
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
              <div key={i} className="card-glow">
                <div className="feature-icon mb-4">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.icon} />
                  </svg>
                </div>
                <h3 className="heading-3 mb-2">{feature.title}</h3>
                <p className="body-small">{feature.desc}</p>
              </div>
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
            <div className="card">
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
            </div>

            {/* Phase 2 */}
            <div className="card">
              <span className="badge-purple mb-4">In Progress</span>
              <h3 className="heading-3 mb-3">Phase 2: Arcium MPC</h3>
              <ul className="space-y-2">
                {["Multi-party computation", "Enhanced unlinkability", "Threshold signatures", "Distributed key generation"].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-muted">
                    <span className="h-4 w-4 flex-shrink-0 rounded-full border border-current" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Phase 3 */}
            <div className="card">
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
            </div>
          </div>
        </section>

        {/* ==================== FOOTER ==================== */}
        <footer className="border-t border-border-subtle">
          <div className="container-main py-12">
            <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sol-purple">
                  <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <span className="font-semibold">PrivyLink</span>
              </div>

              <div className="flex items-center gap-6">
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted transition hover:text-foreground"
                >
                  GitHub
                </a>
                <span className="text-border-subtle">|</span>
                <span className="flex items-center gap-2 text-sm">
                  <span className="status-online" />
                  <span className="text-sol-green">Devnet</span>
                </span>
                <span className="text-border-subtle">|</span>
                <span className="text-sm text-muted">
                  Built for <span className="text-gradient font-medium">Solana Privacy Hack 2026</span>
                </span>
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
