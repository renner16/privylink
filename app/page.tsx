"use client";
import { useWalletConnection } from "@solana/react-hooks";
import { VaultCard } from "./components/vault-card";

export default function Home() {
  const { connectors, connect, disconnect, wallet, status } =
    useWalletConnection();

  const address = wallet?.account.address.toString();

  return (
    <div className="relative min-h-screen overflow-x-clip bg-bg1 text-foreground">
      <main className="relative z-10 mx-auto flex min-h-screen max-w-4xl flex-col gap-10 border-x border-border-low px-6 py-16">
        <header className="space-y-3">
          <p className="text-sm uppercase tracking-[0.18em] text-muted">
            Solana starter kit
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Ship a Solana dapp fast
          </h1>
          <p className="max-w-3xl text-base leading-relaxed text-muted">
            Drop in <code className="font-mono">@solana/react-hooks</code>, wrap
            your tree once, and you get wallet connect/disconnect plus
            ready-to-use hooks for balances and transactions—no manual RPC
            wiring.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-foreground">
            <li className="flex gap-2">
              <span
                className="mt-1.5 h-2 w-2 rounded-full bg-foreground/60"
                aria-hidden
              />
              <div>
                <a
                  className="font-medium underline underline-offset-2"
                  href="https://solana.com/docs"
                  target="_blank"
                  rel="noreferrer"
                >
                  Solana docs
                </a>{" "}
                — core concepts, RPC, programs, and client patterns.
              </div>
            </li>
            <li className="flex gap-2">
              <span
                className="mt-1.5 h-2 w-2 rounded-full bg-foreground/60"
                aria-hidden
              />
              <div>
                <a
                  className="font-medium underline underline-offset-2"
                  href="https://www.anchor-lang.com/docs/introduction"
                  target="_blank"
                  rel="noreferrer"
                >
                  Anchor docs
                </a>{" "}
                — build and test programs with IDL, macros, and type-safe
                clients.
              </div>
            </li>
            <li className="flex gap-2">
              <span
                className="mt-1.5 h-2 w-2 rounded-full bg-foreground/60"
                aria-hidden
              />
              <div>
                <a
                  className="font-medium underline underline-offset-2"
                  href="https://faucet.solana.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Solana faucet (devnet)
                </a>{" "}
                — grab free devnet SOL to try transfers and transactions.
              </div>
            </li>
            <li className="flex gap-2">
              <span
                className="mt-1.5 h-2 w-2 rounded-full bg-foreground/60"
                aria-hidden
              />
              <div>
                <a
                  className="font-medium underline underline-offset-2"
                  href="https://github.com/solana-foundation/framework-kit/tree/main/packages/react-hooks"
                  target="_blank"
                  rel="noreferrer"
                >
                  @solana/react-hooks README
                </a>{" "}
                — how this starter wires the client, connectors, and hooks.
              </div>
            </li>
          </ul>
        </header>

        <section className="w-full max-w-3xl space-y-4 rounded-2xl border border-border-low bg-card p-6 shadow-[0_20px_80px_-50px_rgba(0,0,0,0.35)]">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-lg font-semibold">Wallet connection</p>
              <p className="text-sm text-muted">
                Pick any discovered connector and manage connect / disconnect in
                one spot.
              </p>
            </div>
            <span className="rounded-full bg-cream px-3 py-1 text-xs font-semibold uppercase tracking-wide text-foreground/80">
              {status === "connected" ? "Connected" : "Not connected"}
            </span>
          </div>

          {/* Solflare Button - Destacado */}
          {(() => {
            const solflareConnector = connectors.find(
              (c) => c.name.toLowerCase().includes("solflare") || c.id.toLowerCase().includes("solflare")
            );
            
            if (solflareConnector) {
              const isActive = wallet?.connector.id === solflareConnector.id;
              
              return (
                <div className="space-y-2">
                  <button
                    onClick={() => connect(solflareConnector.id)}
                    disabled={status === "connecting" || (status === "connected" && isActive)}
                    className={`w-full group flex items-center justify-between rounded-xl border-2 px-5 py-4 text-left font-medium transition hover:-translate-y-0.5 hover:shadow-lg cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                      isActive
                        ? "border-green-500 bg-green-50/50"
                        : "border-blue-500 bg-blue-50/30 hover:bg-blue-50/50"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span className="text-2xl">🔥</span>
                      <span className="flex flex-col">
                        <span className="text-lg font-bold">Solflare</span>
                        <span className="text-xs text-muted">
                          {status === "connecting"
                            ? "Conectando…"
                            : isActive
                            ? "✅ Conectado"
                            : "Clique para conectar"}
                        </span>
                      </span>
                    </span>
                    {isActive && (
                      <span className="text-green-600 text-sm font-semibold">✓</span>
                    )}
                  </button>
                  <p className="text-xs text-muted px-1">
                    💡 Recomendado: Solflare funciona bem com Devnet
                  </p>
                </div>
              );
            }
            return null;
          })()}

          {/* Outras Wallets */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide px-1">
              Outras carteiras disponíveis
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
                    className="group flex items-center justify-between rounded-xl border border-border-low bg-card px-4 py-3 text-left text-sm font-medium transition hover:-translate-y-0.5 hover:shadow-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="flex flex-col">
                      <span className="text-base">{connector.name}</span>
                      <span className="text-xs text-muted">
                        {status === "connecting"
                          ? "Connecting…"
                          : status === "connected" &&
                            wallet?.connector.id === connector.id
                          ? "Active"
                          : "Tap to connect"}
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 rounded-full bg-border-low transition group-hover:bg-primary/80"
                    />
                  </button>
                ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-border-low pt-4 text-sm">
            <span className="rounded-lg border border-border-low bg-cream px-3 py-2 font-mono text-xs">
              {address ?? "No wallet connected"}
            </span>
            <button
              onClick={() => disconnect()}
              disabled={status !== "connected"}
              className="inline-flex items-center gap-2 rounded-lg border border-border-low bg-card px-3 py-2 font-medium transition hover:-translate-y-0.5 hover:shadow-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
            >
              Disconnect
            </button>
          </div>
        </section>

        {/* Vault Program Section */}
        <VaultCard />
      </main>
    </div>
  );
}
