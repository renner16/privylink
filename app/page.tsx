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
      <main className="relative z-10 mx-auto flex min-h-screen max-w-4xl flex-col gap-10 border-x border-border-low px-6 py-16">
        <header className="space-y-3">
          <p className="text-sm uppercase tracking-[0.18em] text-muted">
            Solana Privacy Hack 2026
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            PrivyLink
          </h1>
          <p className="max-w-3xl text-base leading-relaxed text-muted">
            Transferências privadas de SOL com <strong>unlinkability on-chain</strong>.
            Envie fundos para qualquer pessoa sem criar um link direto entre remetente e destinatário na blockchain.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border-low bg-card p-4">
              <p className="text-sm font-semibold mb-2">Como funciona?</p>
              <ol className="text-xs text-muted space-y-1 list-decimal list-inside">
                <li>Deposite SOL com um código secreto</li>
                <li>Compartilhe o Magic Link + código com o destinatário</li>
                <li>Destinatário resgata os fundos com o código</li>
              </ol>
            </div>
            <div className="rounded-xl border border-border-low bg-card p-4">
              <p className="text-sm font-semibold mb-2">Privacidade</p>
              <ul className="text-xs text-muted space-y-1">
                <li>✓ Sem link direto sender → receiver</li>
                <li>✓ Vault neutro (PDA) intermedia fundos</li>
                <li>✓ Código auditável e open-source</li>
              </ul>
            </div>
          </div>
        </header>

        <section className="w-full max-w-3xl space-y-4 rounded-2xl border border-border-low bg-card p-6 shadow-[0_20px_80px_-50px_rgba(0,0,0,0.35)]">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-lg font-semibold">Conectar Wallet</p>
              <p className="text-sm text-muted">
                Conecte sua wallet Solana para começar.
              </p>
            </div>
            <span className="rounded-full bg-cream px-3 py-1 text-xs font-semibold uppercase tracking-wide text-foreground/80">
              {status === "connected" ? "Conectado" : "Desconectado"}
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
                    Recomendado: Solflare funciona bem com Devnet
                  </p>
                </div>
              );
            }
            return null;
          })()}

          {/* Outras Wallets */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide px-1">
              Outras wallets
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
                          ? "Conectando…"
                          : status === "connected" &&
                            wallet?.connector.id === connector.id
                          ? "Ativo"
                          : "Clique para conectar"}
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
              {address ?? "Nenhuma wallet conectada"}
            </span>
            <button
              onClick={() => disconnect()}
              disabled={status !== "connected"}
              className="inline-flex items-center gap-2 rounded-lg border border-border-low bg-card px-3 py-2 font-medium transition hover:-translate-y-0.5 hover:shadow-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
            >
              Desconectar
            </button>
          </div>
        </section>

        {/* Vault Program Section */}
        <VaultCard />

        {/* Refund Link */}
        <div className="text-center">
          <Link
            href="/refund"
            className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground transition"
          >
            <span>🔄</span>
            <span>Recuperar depósitos expirados</span>
          </Link>
        </div>

        {/* Footer */}
        <footer className="border-t border-border-low pt-6 text-center text-xs text-muted">
          <p>
            <strong>PrivyLink</strong> — Construído para o Solana Privacy Hack 2026
          </p>
          <p className="mt-1">
            Privacidade não é um luxo, é um direito fundamental.
          </p>
        </footer>
      </main>
    </div>
  );
}
