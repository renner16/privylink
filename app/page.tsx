"use client";
import { useWalletConnection } from "@solana/react-hooks";
import { VaultCard } from "./components/vault-card";
import Link from "next/link";

export default function Home() {
  const { connectors, connect, disconnect, wallet, status } =
    useWalletConnection();

  const address = wallet?.account.address.toString();

  return (
    <div className="relative min-h-screen overflow-x-clip bg-bg1 text-foreground">
      {/* Hero Glow Background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-0 h-[600px] w-[1000px] -translate-x-1/2 -translate-y-1/2"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(153, 69, 255, 0.15) 0%, transparent 60%)",
          }}
        />
        <div
          className="absolute right-0 top-1/3 h-[400px] w-[400px]"
          style={{
            background:
              "radial-gradient(circle at center, rgba(20, 241, 149, 0.1) 0%, transparent 60%)",
          }}
        />
      </div>

      <main className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col gap-16 px-6 py-20 lg:py-28">
        {/* Hero Section */}
        <header className="flex flex-col items-center text-center">
          <span className="badge-purple mb-6">Solana Privacy Hack 2026</span>

          <h1 className="section-title mb-4 text-5xl md:text-6xl lg:text-7xl">
            <span className="gradient-text">Private Transfers</span>
            <br />
            <span className="text-foreground">on Solana</span>
          </h1>

          <p className="section-subtitle mx-auto mb-10 max-w-2xl text-center text-lg md:text-xl">
            Send SOL without linking wallets. No direct on-chain connection
            between sender and receiver.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <a href="#send" className="btn-primary px-8 py-3 text-lg">
              Send Privately
            </a>
            <a href="#claim" className="btn-secondary px-8 py-3 text-lg">
              Claim Transfer
            </a>
          </div>
        </header>

        {/* How It Works */}
        <section className="space-y-10">
          <div className="text-center">
            <h2 className="section-title mb-3 text-3xl md:text-4xl">
              How It Works
            </h2>
            <p className="section-subtitle mx-auto">
              Three simple steps to private transfers
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="step-card">
              <div className="step-number">1</div>
              <h3 className="mb-2 text-lg font-semibold">Commit Funds</h3>
              <p className="text-sm text-muted">
                Deposit SOL into a neutral vault PDA with a secret hash
              </p>
            </div>
            <div className="step-card">
              <div className="step-number">2</div>
              <h3 className="mb-2 text-lg font-semibold">Share Magic Link</h3>
              <p className="text-sm text-muted">
                Send the private link and secret code to your recipient
              </p>
            </div>
            <div className="step-card">
              <div className="step-number">3</div>
              <h3 className="mb-2 text-lg font-semibold">Claim with Secret</h3>
              <p className="text-sm text-muted">
                Recipient proves knowledge of the secret and receives the SOL
              </p>
            </div>
          </div>
        </section>

        {/* Privacy Features */}
        <section className="space-y-10">
          <div className="text-center">
            <h2 className="section-title mb-3 text-3xl md:text-4xl">
              Privacy by Design
            </h2>
            <p className="section-subtitle mx-auto">
              Built from the ground up for unlinkability
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="feature-card">
              <div className="feature-icon">
                <svg
                  className="h-5 w-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="mb-1 font-semibold">No Direct Link</h3>
                <p className="text-sm text-muted">
                  Sender and receiver never interact directly on-chain
                </p>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg
                  className="h-5 w-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Neutral Vault</h3>
                <p className="text-sm text-muted">
                  Funds are held in a program-derived address (PDA)
                </p>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg
                  className="h-5 w-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Secret Verification</h3>
                <p className="text-sm text-muted">
                  SHA-256 hash verification ensures only the recipient can claim
                </p>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg
                  className="h-5 w-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Auto Expiration</h3>
                <p className="text-sm text-muted">
                  Unclaimed deposits automatically become refundable
                </p>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg
                  className="h-5 w-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                  />
                </svg>
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Open Source</h3>
                <p className="text-sm text-muted">
                  Fully auditable code on GitHub
                </p>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg
                  className="h-5 w-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Fast & Cheap</h3>
                <p className="text-sm text-muted">
                  Native Solana speed with minimal transaction fees
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Wallet Connection */}
        <section id="send" className="scroll-mt-20">
          <div className="animated-border">
            <div className="glass-card space-y-6 p-6 md:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold md:text-2xl">
                    Connect Wallet
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    Connect your Solana wallet to start
                  </p>
                </div>
                <span
                  className={`badge ${status === "connected" ? "badge-green" : ""}`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${status === "connected" ? "bg-sol-green" : "bg-muted"}`}
                  />
                  {status === "connected" ? "Connected" : "Disconnected"}
                </span>
              </div>

              {/* Solflare Button - Primary */}
              {(() => {
                const solflareConnector = connectors.find(
                  (c) =>
                    c.name.toLowerCase().includes("solflare") ||
                    c.id.toLowerCase().includes("solflare")
                );

                if (solflareConnector) {
                  const isActive =
                    wallet?.connector.id === solflareConnector.id;

                  return (
                    <div>
                      <button
                        onClick={() => connect(solflareConnector.id)}
                        disabled={
                          status === "connecting" ||
                          (status === "connected" && isActive)
                        }
                        className={`btn-primary w-full justify-between py-4 text-left ${
                          isActive ? "glow-green" : ""
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
                            <svg
                              className="h-6 w-6"
                              viewBox="0 0 32 32"
                              fill="currentColor"
                            >
                              <path d="M16 0L3 8v16l13 8 13-8V8L16 0zm0 4l9 5.5v11L16 26l-9-5.5v-11L16 4z" />
                            </svg>
                          </span>
                          <span>
                            <span className="block text-lg font-bold">
                              Solflare
                            </span>
                            <span className="block text-sm opacity-80">
                              {status === "connecting"
                                ? "Connecting..."
                                : isActive
                                  ? "Connected"
                                  : "Recommended for Devnet"}
                            </span>
                          </span>
                        </span>
                        {isActive && (
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </span>
                        )}
                      </button>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Other Wallets */}
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted">
                  Other Wallets
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {connectors
                    .filter(
                      (c) =>
                        !c.name.toLowerCase().includes("solflare") &&
                        !c.id.toLowerCase().includes("solflare")
                    )
                    .map((connector) => (
                      <button
                        key={connector.id}
                        onClick={() => connect(connector.id)}
                        disabled={status === "connecting"}
                        className="glass-card-hover flex items-center justify-between px-4 py-3 text-left disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span>
                          <span className="block font-medium">
                            {connector.name}
                          </span>
                          <span className="block text-xs text-muted">
                            {status === "connecting"
                              ? "Connecting..."
                              : status === "connected" &&
                                  wallet?.connector.id === connector.id
                                ? "Active"
                                : "Click to connect"}
                          </span>
                        </span>
                        <span
                          className={`h-2.5 w-2.5 rounded-full transition ${
                            status === "connected" &&
                            wallet?.connector.id === connector.id
                              ? "bg-sol-green"
                              : "bg-border"
                          }`}
                        />
                      </button>
                    ))}
                </div>
              </div>

              {/* Connected Wallet Info */}
              <div className="flex flex-wrap items-center gap-3 border-t border-border-low pt-4">
                <code className="wallet-address flex-1 truncate">
                  {address ?? "No wallet connected"}
                </code>
                <button
                  onClick={() => disconnect()}
                  disabled={status !== "connected"}
                  className="btn-ghost disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Disconnect
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Vault / Send Section */}
        <section id="claim">
          <VaultCard />
        </section>

        {/* Roadmap */}
        <section className="space-y-10">
          <div className="text-center">
            <h2 className="section-title mb-3 text-3xl md:text-4xl">Roadmap</h2>
            <p className="section-subtitle mx-auto">
              From basic privacy to full anonymity
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="glass-card p-6">
              <div className="mb-4 flex items-center gap-2">
                <span className="badge-green">Complete</span>
              </div>
              <h3 className="mb-2 text-lg font-semibold">Phase 1: PDA Vaults</h3>
              <ul className="space-y-2 text-sm text-muted">
                <li className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 text-sol-green"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Private deposits with hash
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 text-sol-green"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Secret-based claims
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 text-sol-green"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Expiration & refunds
                </li>
              </ul>
            </div>

            <div className="glass-card p-6">
              <div className="mb-4 flex items-center gap-2">
                <span className="badge-purple">In Progress</span>
              </div>
              <h3 className="mb-2 text-lg font-semibold">Phase 2: Arcium MPC</h3>
              <ul className="space-y-2 text-sm text-muted">
                <li className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border border-current" />
                  Multi-party computation
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border border-current" />
                  Enhanced unlinkability
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border border-current" />
                  Threshold signatures
                </li>
              </ul>
            </div>

            <div className="glass-card p-6">
              <div className="mb-4 flex items-center gap-2">
                <span className="badge">Future</span>
              </div>
              <h3 className="mb-2 text-lg font-semibold">
                Phase 3: Global Vault + ZK
              </h3>
              <ul className="space-y-2 text-sm text-muted">
                <li className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border border-current" />
                  Zero-knowledge proofs
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border border-current" />
                  Shared anonymity pool
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border border-current" />
                  Full privacy guarantees
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Refund Link */}
        <div className="text-center">
          <Link
            href="/refund"
            className="btn-ghost inline-flex items-center gap-2"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Recover expired deposits
          </Link>
        </div>

        {/* Footer */}
        <footer className="border-t border-border-low pt-8 text-center">
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-foreground"
            >
              GitHub
            </a>
            <span className="text-border">|</span>
            <span>Devnet</span>
            <span className="text-border">|</span>
            <span className="gradient-text font-medium">
              Solana Privacy Hack 2026
            </span>
          </div>
          <p className="mt-4 text-xs text-subtle">
            Privacy is not a luxury, it&apos;s a fundamental right.
          </p>
        </footer>
      </main>
    </div>
  );
}
