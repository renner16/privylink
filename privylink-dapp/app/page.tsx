"use client";
import { useWalletConnection } from "@solana/react-hooks";
import Link from "next/link";

export default function Home() {
  const { connectors, connect, disconnect, wallet, status } =
    useWalletConnection();

  const address = wallet?.account.address.toString();

  return (
    <div className="min-h-screen bg-bg-primary relative">
      {/* Background Effects */}
      <div className="hero-glow" />
      <div className="fixed inset-0 grid-pattern opacity-50 pointer-events-none" />

      {/* Floating Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb-purple w-[600px] h-[600px] top-[-20%] left-[-10%]" />
        <div className="floating-orb-green w-[500px] h-[500px] bottom-[-20%] right-[-10%]" style={{ animationDelay: '-3s' }} />
        <div className="floating-orb-blue w-[300px] h-[300px] top-[40%] right-[20%]" style={{ animationDelay: '-5s' }} />
      </div>

      <main className="relative z-10">
        {/* ===== HERO SECTION ===== */}
        <section className="pt-16 pb-20 px-6">
          <div className="max-w-6xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-3 mb-8 animate-fade-in-up">
              <span className="badge-live">
                <span className="status-dot-green" />
                Solana Devnet
              </span>
              <span className="badge-purple">Hackathon 2026</span>
            </div>

            {/* Title */}
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold mb-6 animate-fade-in-up stagger-1">
              <span className="text-gradient">PrivyLink</span>
            </h1>

            {/* Subtitle */}
            <p className="text-xl md:text-2xl text-muted max-w-3xl mx-auto mb-4 animate-fade-in-up stagger-2">
              Transferências <span className="text-sol-purple-light font-semibold">privadas</span> de SOL com códigos secretos
            </p>

            <p className="text-muted-dark max-w-2xl mx-auto mb-10 animate-fade-in-up stagger-3">
              Envie para qualquer pessoa — só quem tem o código pode resgatar.
              Sem registro, sem KYC, 100% on-chain.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up stagger-4">
              <Link href="/send" className="btn-primary text-lg px-8 py-4 inline-flex items-center gap-3">
                <span>🚀</span>
                <span>Enviar Privado</span>
              </Link>
              <Link href="/send?tab=claim" className="btn-secondary text-lg px-8 py-4 inline-flex items-center gap-3">
                <span>🎁</span>
                <span>Resgatar SOL</span>
              </Link>
            </div>

            {/* Connected Wallet Status */}
            {status === "connected" && (
              <div className="mt-10 inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-bg-card border border-border animate-scale-in">
                <span className="status-dot-green" />
                <span className="font-mono text-sm text-sol-green">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </span>
                <button
                  onClick={() => disconnect()}
                  className="text-muted hover:text-foreground text-sm transition-colors"
                >
                  Desconectar
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ===== STATS SECTION ===== */}
        <section className="py-12 px-6 border-y border-border bg-bg-secondary/50">
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <p className="stat-value">100%</p>
              <p className="text-sm text-muted mt-1">On-Chain</p>
            </div>
            <div className="text-center">
              <p className="stat-value">~0.5s</p>
              <p className="text-sm text-muted mt-1">Confirmação</p>
            </div>
            <div className="text-center">
              <p className="stat-value">SHA256</p>
              <p className="text-sm text-muted mt-1">Criptografia</p>
            </div>
            <div className="text-center">
              <p className="stat-value">0%</p>
              <p className="text-sm text-muted mt-1">Taxas Extras</p>
            </div>
          </div>
        </section>

        {/* ===== MAIN ACTIONS ===== */}
        <section className="py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">O que você quer fazer?</h2>
              <p className="text-muted max-w-xl mx-auto">
                Escolha uma opção para começar a usar o PrivyLink
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {/* Send */}
              <Link href="/send" className="glass-card glass-card-purple p-8 group cursor-pointer">
                <div className="w-16 h-16 rounded-2xl bg-sol-purple/15 border border-sol-purple/30 flex items-center justify-center mb-6 group-hover:glow-purple transition-all">
                  <span className="text-3xl">📤</span>
                </div>
                <h3 className="text-2xl font-bold mb-3 text-foreground">Enviar</h3>
                <p className="text-muted mb-4">
                  Crie um depósito privado com código secreto. Gere QR code e Magic Link automaticamente.
                </p>
                <div className="flex items-center gap-2 text-sol-purple font-semibold group-hover:text-sol-green transition-colors">
                  <span>Criar depósito</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </Link>

              {/* Claim */}
              <Link href="/send?tab=claim" className="glass-card glass-card-green p-8 group cursor-pointer">
                <div className="w-16 h-16 rounded-2xl bg-sol-green/15 border border-sol-green/30 flex items-center justify-center mb-6 group-hover:glow-green transition-all">
                  <span className="text-3xl">📥</span>
                </div>
                <h3 className="text-2xl font-bold mb-3 text-foreground">Resgatar</h3>
                <p className="text-muted mb-4">
                  Recebeu um link ou código? Use-o para resgatar os SOL diretamente na sua wallet.
                </p>
                <div className="flex items-center gap-2 text-sol-green font-semibold group-hover:text-sol-purple transition-colors">
                  <span>Resgatar SOL</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </Link>

              {/* Refund */}
              <Link href="/refund" className="glass-card p-8 group cursor-pointer">
                <div className="w-16 h-16 rounded-2xl bg-sol-blue/15 border border-sol-blue/30 flex items-center justify-center mb-6 group-hover:shadow-[0_0_30px_rgba(0,212,170,0.4)] transition-all">
                  <span className="text-3xl">🔄</span>
                </div>
                <h3 className="text-2xl font-bold mb-3 text-foreground">Meus Depósitos</h3>
                <p className="text-muted mb-4">
                  Acompanhe depósitos ativos e recupere fundos de depósitos expirados.
                </p>
                <div className="flex items-center gap-2 text-sol-blue font-semibold group-hover:text-sol-purple transition-colors">
                  <span>Ver depósitos</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </Link>
            </div>
          </div>
        </section>

        {/* ===== HOW IT WORKS ===== */}
        <section className="py-20 px-6 bg-bg-secondary/30">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <span className="badge-purple mb-4">Simples & Seguro</span>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Como funciona</h2>
              <p className="text-muted max-w-xl mx-auto">
                Três passos simples para enviar SOL de forma privada
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              {/* Step 1 */}
              <div className="feature-card text-center">
                <div className="step-number mx-auto mb-6">1</div>
                <h3 className="text-xl font-bold mb-3">Crie um depósito</h3>
                <p className="text-muted">
                  Defina o valor em SOL e um código secreto. Um Magic Link e QR code serão gerados automaticamente.
                </p>
              </div>

              {/* Step 2 */}
              <div className="feature-card text-center">
                <div className="step-number mx-auto mb-6">2</div>
                <h3 className="text-xl font-bold mb-3">Compartilhe o link</h3>
                <p className="text-muted">
                  Envie o Magic Link ou QR code para o destinatário por qualquer canal de sua preferência.
                </p>
              </div>

              {/* Step 3 */}
              <div className="feature-card text-center">
                <div className="step-number mx-auto mb-6">3</div>
                <h3 className="text-xl font-bold mb-3">Resgate instantâneo</h3>
                <p className="text-muted">
                  O destinatário abre o link e resgata os SOL direto na wallet dele. Simples assim!
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ===== FEATURES ===== */}
        <section className="py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <span className="badge-green mb-4">Recursos</span>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Por que usar PrivyLink?</h2>
              <p className="text-muted max-w-xl mx-auto">
                Tecnologia de ponta para transferências privadas
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="glass-card p-6">
                <div className="text-3xl mb-4">🔐</div>
                <h3 className="text-lg font-bold mb-2">Código Secreto</h3>
                <p className="text-sm text-muted">
                  Hash SHA-256 garante que apenas quem conhece o código pode resgatar os fundos.
                </p>
              </div>

              <div className="glass-card p-6">
                <div className="text-3xl mb-4">⏱️</div>
                <h3 className="text-lg font-bold mb-2">Expiração Flexível</h3>
                <p className="text-sm text-muted">
                  Configure tempo de expiração de 1 hora até nunca. Recupere fundos se não forem resgatados.
                </p>
              </div>

              <div className="glass-card p-6">
                <div className="text-3xl mb-4">📱</div>
                <h3 className="text-lg font-bold mb-2">QR Code & Magic Link</h3>
                <p className="text-sm text-muted">
                  Compartilhe facilmente via QR code para presencial ou link para envio digital.
                </p>
              </div>

              <div className="glass-card p-6">
                <div className="text-3xl mb-4">⛓️</div>
                <h3 className="text-lg font-bold mb-2">100% On-Chain</h3>
                <p className="text-sm text-muted">
                  Smart contract Anchor verificado. Seus fundos ficam no programa, não em terceiros.
                </p>
              </div>

              <div className="glass-card p-6">
                <div className="text-3xl mb-4">🚫</div>
                <h3 className="text-lg font-bold mb-2">Sem Registro</h3>
                <p className="text-sm text-muted">
                  Não precisa criar conta nem fornecer dados pessoais. Conecte a wallet e use.
                </p>
              </div>

              <div className="glass-card p-6">
                <div className="text-3xl mb-4">⚡</div>
                <h3 className="text-lg font-bold mb-2">Velocidade Solana</h3>
                <p className="text-sm text-muted">
                  Confirmação em ~500ms com taxas mínimas da rede Solana.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ===== WALLET CONNECTION ===== */}
        {status !== "connected" && (
          <section className="py-20 px-6 bg-bg-secondary/30">
            <div className="max-w-xl mx-auto">
              <div className="glass-card p-8">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold mb-2">Conectar Wallet</h3>
                  <p className="text-muted">
                    Conecte sua wallet Solana para começar a usar o PrivyLink
                  </p>
                </div>

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
                          className="btn-primary w-full flex items-center justify-center gap-3 text-lg py-4"
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
                          className="btn-secondary"
                        >
                          {connector.name}
                        </button>
                      ))}
                  </div>

                  {/* Devnet Warning */}
                  <div className="card-section border-sol-purple/30 bg-sol-purple/5 mt-6">
                    <div className="flex items-start gap-3">
                      <span className="text-xl">⚠️</span>
                      <div>
                        <p className="font-semibold text-sol-purple-light mb-1">Rede de Testes</p>
                        <p className="text-xs text-muted">
                          Configure sua wallet para <strong>Solana Devnet</strong> antes de conectar.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ===== SECURITY ===== */}
        <section className="py-20 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="glass-card p-8 md:p-12">
              <div className="flex flex-col md:flex-row gap-8 items-center">
                <div className="flex-shrink-0">
                  <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-sol-purple to-sol-green flex items-center justify-center text-5xl glow-purple">
                    🛡️
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-3">Segurança em Primeiro Lugar</h3>
                  <p className="text-muted mb-4">
                    O PrivyLink utiliza Program Derived Addresses (PDAs) da Solana para garantir que
                    cada depósito seja único e só possa ser acessado com o código secreto correto.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <span className="badge-muted">Anchor Framework</span>
                    <span className="badge-muted">SHA-256 Hash</span>
                    <span className="badge-muted">PDA Vaults</span>
                    <span className="badge-muted">Open Source</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== FOOTER ===== */}
        <footer className="py-12 px-6 border-t border-border">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-gradient">PrivyLink</span>
                <span className="badge-muted text-xs">v1.0</span>
              </div>

              <div className="flex items-center gap-6 text-sm">
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted hover:text-foreground transition-colors"
                >
                  GitHub
                </a>
                <a
                  href={`https://explorer.solana.com/address/98WwJxc1aAeqGWuaouQntJYmdQEnELntf9BqKXD3o34W?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted hover:text-foreground transition-colors"
                >
                  Explorer
                </a>
                <Link href="/refund" className="text-muted hover:text-foreground transition-colors">
                  Meus Depósitos
                </Link>
              </div>
            </div>

            <div className="divider" />

            <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-dark">
              <p>
                Construído com{" "}
                <a href="https://www.anchor-lang.com" target="_blank" rel="noreferrer" className="link">
                  Anchor
                </a>
                {" "}e{" "}
                <a href="https://nextjs.org" target="_blank" rel="noreferrer" className="link">
                  Next.js
                </a>
              </p>
              <p className="font-mono text-xs">
                Program: 98WwJxc1...o34W
              </p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
