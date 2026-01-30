# PrivyLink — Progresso

## Última atualização
29/01/2026 23:30

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
- **[29/01]** Página de Refund (`app/refund/page.tsx`):
  - Lista depósitos expirados do usuário
  - Botão de refund para cada depósito
  - Feedback visual de sucesso/erro
- **[29/01]** BUG CRÍTICO CORRIGIDO - CLAIM FUNCIONANDO!
  - Bug: System Program não permite `transfer` de contas com dados
  - Solução: Manipulação direta de lamports (`try_borrow_mut_lamports()`)
- **[29/01]** Deploy na Devnet realizado com sucesso:
  - Program ID: `98WwJxc1aAeqGWuaouQntJYmdQEnELntf9BqKXD3o34W`
- **[29/01 23:30] REDESIGN VISUAL ESTILO SOLANA**:
  - Design system completo em `globals.css` com tokens Solana
  - Cores: Purple (#9945FF), Green (#14F195), Blue (#00D4AA)
  - Componentes: glass-card, btn-primary, btn-secondary, badges, inputs
  - Gradientes e efeitos de glow
  - Landing page redesenhada com visual product-first
  - VaultCard redesenhado com novo visual
  - Refund page redesenhada

## 🚧 Em progresso
- (nenhum)

## ⚠️ Problemas encontrados
- (nenhum)

## 📋 Próximos passos
1. ~~Resolver funcionalidade de claim~~ ✅ FEITO
2. ~~Fazer deploy do programa na devnet~~ ✅ FEITO
3. ~~Corrigir bug do System Program transfer~~ ✅ FEITO
4. ~~Adicionar QR code para Magic Link~~ ✅ FEITO
5. ~~Adicionar expiração + refund~~ ✅ FEITO
6. ~~Redesign visual estilo Solana~~ ✅ FEITO
7. (Opcional) Fazer commit e push das mudanças
8. (Futuro) Taxa de 0.25%
9. (Futuro) Integração Arcium MPC (Fase 2)

## 📊 Informações do Deploy

| Item | Valor |
|------|-------|
| Program ID | `98WwJxc1aAeqGWuaouQntJYmdQEnELntf9BqKXD3o34W` |
| Network | Devnet |
| Upgrade Authority | `88rk9ofbfoh8iBLYX9NNS9NKCNZbbAJgfYppzNUd8LYU` |
