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
1. Gravar vídeo demo (3 minutos)
2. Fazer commit e push das mudanças
3. Submeter no hackathon (deadline: 1 de Fevereiro 2026)
4. (Futuro) Taxa de 0.25%
5. (Futuro) Integração Arcium MPC (Fase 2)

## 📊 Informações do Deploy

| Item | Valor |
|------|-------|
| Program ID | `98WwJxc1aAeqGWuaouQntJYmdQEnELntf9BqKXD3o34W` |
| Network | Devnet |
| Upgrade Authority | `88rk9ofbfoh8iBLYX9NNS9NKCNZbbAJgfYppzNUd8LYU` |
| RPC | Helius (devnet.helius-rpc.com) |
| GitHub | github.com/renner16/privylink |
