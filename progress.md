# PrivyLink — Progresso

## Última atualização
31/01/2026 22:30

## ✅ Concluído
- Estrutura base do projeto (Next.js 16 + Anchor)
- Smart contract completo (`anchor/programs/vault/src/lib.rs`):
  - `create_private_deposit()` - cria depósito com hash SHA256 + expiração
  - `claim_deposit()` - resgata com código secreto (verifica expiração)
  - `refund_expired()` - devolve fundos após expiração
  - Struct `PrivateDeposit` (depositor, claim_hash, amount, claimed, bump, created_at, expires_at)
  - Erros: `AlreadyClaimed`, `InvalidSecret`, `InvalidAmount`, `DepositExpired`, `NotExpiredYet`, `Unauthorized`
- Cliente TypeScript gerado via Codama (`app/generated/vault/`)
- **[29/01]** Frontend completo (`app/components/vault-card.tsx`):
  - UI para criar depósito com expiração configurável
  - **Sistema de Magic Link com QR Code**
  - **Claim funcional** (deriva PDA corretamente)
  - Botões para copiar Magic Link e código secreto
  - Tabs para alternar entre criar/resgatar
  - Leitura automática de parâmetros da URL
  - Verificação de deploy do programa
- **[29/01]** BUG CRÍTICO CORRIGIDO - CLAIM FUNCIONANDO!
  - Bug: System Program não permite `transfer` de contas com dados
  - Solução: Manipulação direta de lamports (`try_borrow_mut_lamports()`)
- **[29/01]** Deploy na Devnet realizado com sucesso:
  - Program ID: `98WwJxc1aAeqGWuaouQntJYmdQEnELntf9BqKXD3o34W`
- **[30/01] REDESIGN FINAL** - Estilo Solana Privacy Hack
- **[31/01] POLISH FINAL** - Melhorias UX/UI:
  - **Nova logo** PrivyLink (substituiu cadeado genérico)
  - **Logo Solflare** oficial adicionada
  - **Efeito Typewriter** no badge hero (alterna PRIVACY_HACKATHON_2026 / PRIVY_LINK)
  - **Header inteligente**: some ao scrollar para baixo, aparece ao scrollar para cima
  - **Dropdown de wallets** no header (botão Connect abre opções)
  - **Navegação por tabs via URL**: ?tab=send e ?tab=claim funcionando
  - **Cards com borda branca** (#fff, 2px)
  - **Animações scroll reveal** nos cards (fade-in de baixo para cima com delays)
  - **Brave Wallet removido** da lista de wallets
  - **Link GitHub** atualizado: github.com/renner16/privylink com ícone
  - **Layout reformulado**: card de wallet em cima, card Send/Claim em largura total
- **[01/02] MELHORIAS UX FINAIS**:
  - **Página Principal:**
    - Diagrama visual no "How It Works" (Sender → Vault PDA → Receiver)
    - Roadmap: "In Progress" mudou para "Planned" (Phase 2)
    - GitHub link mostra "Open Source"
    - Devnet no footer agora é clicável (abre Solana Explorer)
    - Removido código morto (isSecureContext)
  - **Vault Card (Send/Claim):**
    - **Saldo da wallet** exibido no campo Amount
    - **Validação de saldo** antes de criar depósito (botão desabilitado se insuficiente)
    - **Tooltip** no campo Label explicando que é salvo localmente
    - **Indicador de força** do secret (Weak/Medium/Strong com barras coloridas)
    - **QR Code expandível** (clique para ver maior em modal)
    - **Valor recebido no claim** exibido na mensagem de sucesso
    - **Devnet status verde** e link para Explorer
  - **Página My Transfers:**
    - **SOL Received calculado** baseado nos claims salvos
    - **Valor em SOL** exibido nos cards de claims
    - Claims agora salvam o amount no localStorage
- **[31/01] CORREÇÕES UX/CONEXÃO:**
  - **Removidos botões "Explorer"** da página My Transfers (mais privacidade - usuário vê na wallet)
  - **Detecção automática de wallet** instalada (não mostra "Install" se já tem)
  - **Erro claro para múltiplas páginas**: "Outra página está usando a carteira. Feche-a para continuar."
  - **Tratamento de erros** em Send/Claim (cancelled, busy, locked, insufficient)
  - **Conexão de wallet no primeiro clique** (prioriza connector da biblioteca)
- **[31/01] FINALIZAÇÃO HACKATHON:**
  - **Screenshots mobile** reorganizadas (menores, 2 por linha com títulos)
  - **Screenshots cortadas** para melhor visualização
  - **Revisão final** como judge de hackathon (README, contrato, demo)
  - **Nome co-autora corrigido** (Geovana Marques)
  - **Favicon restaurado** para original do template Solana
  - **Mensagens de erro padronizadas** para inglês
  - **Suporte QuickNode RPC** adicionado (elegível para bounty $3k)
  - **Seção Hackathon no README** atualizada (4 bounties, total $41k)
  - **Footer com provider RPC** dinâmico (Helius/QuickNode/Public Devnet)
- **[31/01] ALINHAMENTO SITE/README:**
  - **Roadmap atualizado** no site (3 fases conforme README)
  - **Seção "Competing For"** no footer (4 bounties com valores)

## 🚧 Em progresso
- (nenhum)

## ✅ Testes Realizados (30/01/2026)
- **Criar depósito:** ✅ Funcionando (0.01 SOL, expiração 1h)
- **Magic Link:** ✅ Gerado corretamente com todos os parâmetros
- **Claim com código errado:** ✅ Falha corretamente (InvalidSecret)
- **Claim com código correto:** ✅ Receiver recebeu 0.009995 SOL
- **Fluxo completo sender→receiver:** ✅ Testado com 2 wallets diferentes

## ⚠️ Problemas encontrados
- (nenhum)

## 📋 Próximos passos
1. ✅ **PROJETO PRONTO PARA SUBMISSÃO**
2. Gravar vídeo demo (máx 3 minutos)
3. Submeter no hackathon (avaliação até 10/02/2026)
4. (Futuro) Taxa de 0.25%
5. (Futuro) Integração Arcium MPC (Fase 2)

## 📊 Informações do Deploy

| Item | Valor |
|------|-------|
| Program ID | `98WwJxc1aAeqGWuaouQntJYmdQEnELntf9BqKXD3o34W` |
| Network | Devnet |
| Upgrade Authority | `88rk9ofbfoh8iBLYX9NNS9NKCNZbbAJgfYppzNUd8LYU` |
| RPC | QuickNode > Helius > Public Devnet |
| GitHub | github.com/renner16/privylink |
