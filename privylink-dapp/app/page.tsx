"use client";
import { useWalletConnection } from "@solana/react-hooks";
import Link from "next/link";

export default function Home() {
  const { connectors, connect, disconnect, wallet, status } =
    useWalletConnection();

  const address = wallet?.account.address.toString();

  return (
    <div className="relative min-h-screen overflow-x-clip bg-bg1 text-foreground">
      <main className="relative z-10 mx-auto flex min-h-screen max-w-4xl flex-col gap-10 border-x border-border-low px-6 py-16">
        {/* Header */}
        <header className="space-y-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            PrivyLink
          </h1>
          <p className="text-lg text-muted max-w-2xl mx-auto">
            Transferencias privadas de SOL com codigos secretos.
            Envie SOL para qualquer pessoa - so quem tem o codigo pode resgatar.
          </p>
        </header>

        {/* Main Actions */}
        <section className="grid gap-6 md:grid-cols-3">
          {/* Send */}
          <Link
            href="/send"
            className="group rounded-2xl border-2 border-border-low bg-card p-6 shadow-lg transition hover:border-foreground/30 hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="text-4xl mb-4">📤</div>
            <h2 className="text-xl font-bold mb-2">Enviar</h2>
            <p className="text-sm text-muted">
              Crie um deposito privado com codigo secreto. Gere QR code e link magico.
            </p>
          </Link>

          {/* Claim */}
          <Link
            href="/claim/demo"
            className="group rounded-2xl border-2 border-border-low bg-card p-6 shadow-lg transition hover:border-foreground/30 hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="text-4xl mb-4">📥</div>
            <h2 className="text-xl font-bold mb-2">Resgatar</h2>
            <p className="text-sm text-muted">
              Recebeu um link? Use-o diretamente ou acesse aqui para resgatar SOL.
            </p>
          </Link>

          {/* Refund */}
          <Link
            href="/refund"
            className="group rounded-2xl border-2 border-border-low bg-card p-6 shadow-lg transition hover:border-foreground/30 hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="text-4xl mb-4">🔄</div>
            <h2 className="text-xl font-bold mb-2">Recuperar</h2>
            <p className="text-sm text-muted">
              Deposito expirou sem ser resgatado? Recupere seus fundos aqui.
            </p>
          </Link>
        </section>

        {/* Wallet Connection */}
        <section className="w-full max-w-2xl mx-auto space-y-4 rounded-2xl border border-border-low bg-card p-6 shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-lg font-semibold">Wallet</p>
              <p className="text-sm text-muted">
                Conecte sua wallet Solana para usar o PrivyLink.
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
              status === "connected"
                ? "bg-green-100 text-green-800"
                : "bg-cream text-foreground/80"
            }`}>
              {status === "connected" ? "Conectado" : "Desconectado"}
            </span>
          </div>

          {status !== "connected" ? (
            <div className="space-y-3">
              {/* Solflare destacado */}
              {(() => {
                const solflareConnector = connectors.find(
                  (c) => c.name.toLowerCase().includes("solflare")
                );
                if (solflareConnector) {
                  return (
                    <button
                      onClick={() => connect(solflareConnector.id)}
                      disabled={status === "connecting"}
                      className="w-full flex items-center justify-center gap-3 rounded-xl border-2 border-blue-500 bg-blue-50/30 px-5 py-4 font-medium transition hover:bg-blue-50/50 disabled:opacity-60"
                    >
                      <span className="text-xl">🔥</span>
                      <span>Conectar com Solflare</span>
                    </button>
                  );
                }
                return null;
              })()}

              {/* Outras wallets */}
              <div className="grid gap-2 sm:grid-cols-2">
                {connectors
                  .filter(
                    (c) =>
                      !c.name.toLowerCase().includes("solflare") &&
                      !c.name.toLowerCase().includes("metamask")
                  )
                  .slice(0, 4)
                  .map((connector) => (
                    <button
                      key={connector.id}
                      onClick={() => connect(connector.id)}
                      disabled={status === "connecting"}
                      className="rounded-lg border border-border-low bg-card px-4 py-3 text-sm font-medium transition hover:bg-cream/50 disabled:opacity-60"
                    >
                      {connector.name}
                    </button>
                  ))}
              </div>

              <div className="rounded-lg bg-yellow-100/50 border border-yellow-300/50 p-3 text-xs text-yellow-800">
                <strong>Devnet:</strong> Configure sua wallet para Solana Devnet antes de conectar.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
                <span className="text-green-600">✓</span>
                <span className="font-mono text-sm text-green-800 truncate">{address}</span>
              </div>
              <button
                onClick={() => disconnect()}
                className="w-full rounded-lg border border-border-low px-4 py-2 text-sm font-medium transition hover:bg-cream/50"
              >
                Desconectar
              </button>
            </div>
          )}
        </section>

        {/* How it works */}
        <section className="w-full max-w-2xl mx-auto rounded-2xl border border-border-low bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Como funciona</h3>
          <div className="grid gap-4 sm:grid-cols-3 text-sm">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center font-bold">1</div>
              <p className="font-medium">Crie um deposito</p>
              <p className="text-muted">Defina o valor e um codigo secreto. Um link magico e QR code serao gerados.</p>
            </div>
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center font-bold">2</div>
              <p className="font-medium">Compartilhe o link</p>
              <p className="text-muted">Envie o link ou QR code para o destinatario. So ele podera resgatar.</p>
            </div>
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center font-bold">3</div>
              <p className="font-medium">Resgate instantaneo</p>
              <p className="text-muted">O destinatario abre o link e resgata os SOL direto na wallet dele.</p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-sm text-muted space-y-2">
          <p>
            Construido com{" "}
            <a href="https://www.anchor-lang.com" target="_blank" rel="noreferrer" className="underline">Anchor</a>
            {" "}e{" "}
            <a href="https://nextjs.org" target="_blank" rel="noreferrer" className="underline">Next.js</a>
          </p>
          <p className="text-xs">
            Solana Devnet | Hackathon 2026
          </p>
        </footer>
      </main>
    </div>
  );
}
