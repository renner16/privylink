"use client";
import { useWalletConnection } from "@solana/react-hooks";
import Link from "next/link";

export default function Home() {
  const { connectors, connect, disconnect, wallet, status } =
    useWalletConnection();

  const address = wallet?.account.address.toString();

  return (
    <div className="min-h-screen bg-background">
      {/* Background glow effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-sol-purple/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-sol-green/15 rounded-full blur-[120px]" />
      </div>

      <main className="relative z-10 mx-auto max-w-5xl px-6 py-12">
        {/* Header */}
        <header className="text-center mb-16">
          <div className="inline-flex items-center gap-2 mb-6">
            <span className="badge-purple">Solana Devnet</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-4">
            <span className="text-gradient">PrivyLink</span>
          </h1>
          <p className="text-xl text-muted max-w-2xl mx-auto">
            Transferencias privadas de SOL com codigos secretos.
            Envie para qualquer pessoa — so quem tem o codigo pode resgatar.
          </p>
        </header>

        {/* Main Actions */}
        <section className="grid gap-6 md:grid-cols-3 mb-12">
          {/* Send */}
          <Link href="/send" className="glass-card p-6 group cursor-pointer transition-all hover:scale-[1.02]">
            <div className="w-12 h-12 rounded-xl bg-sol-purple/20 flex items-center justify-center mb-4 group-hover:glow-purple transition-all">
              <span className="text-2xl">📤</span>
            </div>
            <h2 className="text-xl font-bold mb-2 text-foreground">Enviar</h2>
            <p className="text-sm text-muted">
              Crie um deposito privado com codigo secreto. Gere QR code e Magic Link.
            </p>
            <div className="mt-4 text-sol-purple text-sm font-medium group-hover:text-sol-green transition-colors">
              Criar deposito →
            </div>
          </Link>

          {/* Claim */}
          <Link href="/send?tab=claim" className="glass-card p-6 group cursor-pointer transition-all hover:scale-[1.02]">
            <div className="w-12 h-12 rounded-xl bg-sol-green/20 flex items-center justify-center mb-4 group-hover:glow-green transition-all">
              <span className="text-2xl">📥</span>
            </div>
            <h2 className="text-xl font-bold mb-2 text-foreground">Resgatar</h2>
            <p className="text-sm text-muted">
              Recebeu um link? Use-o diretamente ou digite o codigo para resgatar.
            </p>
            <div className="mt-4 text-sol-green text-sm font-medium group-hover:text-sol-purple transition-colors">
              Resgatar SOL →
            </div>
          </Link>

          {/* Refund */}
          <Link href="/refund" className="glass-card p-6 group cursor-pointer transition-all hover:scale-[1.02]">
            <div className="w-12 h-12 rounded-xl bg-sol-blue/20 flex items-center justify-center mb-4">
              <span className="text-2xl">🔄</span>
            </div>
            <h2 className="text-xl font-bold mb-2 text-foreground">Recuperar</h2>
            <p className="text-sm text-muted">
              Deposito expirou sem ser resgatado? Recupere seus fundos aqui.
            </p>
            <div className="mt-4 text-sol-blue text-sm font-medium group-hover:text-sol-purple transition-colors">
              Ver depositos →
            </div>
          </Link>
        </section>

        {/* Wallet Connection */}
        <section className="glass-card p-6 mb-12">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">Wallet</h3>
              <p className="text-sm text-muted">
                Conecte sua wallet Solana para usar o PrivyLink.
              </p>
            </div>
            <span className={status === "connected" ? "status-connected" : "status-disconnected"}>
              {status === "connected" ? "Conectado" : "Desconectado"}
            </span>
          </div>

          {status !== "connected" ? (
            <div className="space-y-4">
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
                      className="btn-primary w-full flex items-center justify-center gap-3"
                    >
                      <span className="text-xl">🔥</span>
                      <span>Conectar com Solflare</span>
                    </button>
                  );
                }
                return null;
              })()}

              {/* Outras wallets */}
              <div className="grid gap-3 sm:grid-cols-2">
                {connectors
                  .filter(
                    (c) =>
                      !c.name.toLowerCase().includes("solflare") &&
                      !c.name.toLowerCase().includes("metamask") &&
                      !c.name.toLowerCase().includes("brave")
                  )
                  .slice(0, 4)
                  .map((connector) => (
                    <button
                      key={connector.id}
                      onClick={() => connect(connector.id)}
                      disabled={status === "connecting"}
                      className="btn-secondary text-sm"
                    >
                      {connector.name}
                    </button>
                  ))}
              </div>

              {/* Devnet Warning */}
              <div className="card-section border-sol-purple/30 bg-sol-purple/5">
                <p className="text-sm text-sol-purple font-medium mb-1">⚠️ Rede de Testes</p>
                <p className="text-xs text-muted">
                  Configure sua wallet para <strong>Solana Devnet</strong> antes de conectar.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-sol-green/10 border border-sol-green/30">
                <div className="w-3 h-3 rounded-full bg-sol-green animate-pulse" />
                <span className="font-mono text-sm text-sol-green truncate">{address}</span>
              </div>
              <button
                onClick={() => disconnect()}
                className="btn-secondary w-full"
              >
                Desconectar
              </button>
            </div>
          )}
        </section>

        {/* How it works */}
        <section className="glass-card p-8 mb-12">
          <h3 className="text-xl font-bold mb-6 text-center">Como funciona</h3>
          <div className="grid gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sol-purple to-sol-green flex items-center justify-center font-bold text-white mx-auto mb-4">
                1
              </div>
              <p className="font-semibold mb-2">Crie um deposito</p>
              <p className="text-sm text-muted">
                Defina o valor e um codigo secreto. Um Magic Link e QR code serao gerados.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sol-purple to-sol-green flex items-center justify-center font-bold text-white mx-auto mb-4">
                2
              </div>
              <p className="font-semibold mb-2">Compartilhe o link</p>
              <p className="text-sm text-muted">
                Envie o link ou QR code para o destinatario. So ele podera resgatar.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sol-purple to-sol-green flex items-center justify-center font-bold text-white mx-auto mb-4">
                3
              </div>
              <p className="font-semibold mb-2">Resgate instantaneo</p>
              <p className="text-sm text-muted">
                O destinatario abre o link e resgata os SOL direto na wallet dele.
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-sm text-muted space-y-2">
          <p>
            Construido com{" "}
            <a href="https://www.anchor-lang.com" target="_blank" rel="noreferrer" className="link">
              Anchor
            </a>
            {" "}e{" "}
            <a href="https://nextjs.org" target="_blank" rel="noreferrer" className="link">
              Next.js
            </a>
          </p>
          <p className="text-xs text-muted/60">
            Solana Devnet • Program ID: 98WwJxc1aAeqGWuaouQntJYmdQEnELntf9BqKXD3o34W
          </p>
        </footer>
      </main>
    </div>
  );
}
