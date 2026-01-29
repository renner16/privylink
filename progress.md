# PrivyLink — Progresso

## Última atualização
29/01/2026 20:10

## ✅ Concluído
- Estrutura base do projeto (Next.js 16 + Anchor)
- Smart contract completo (`anchor/programs/vault/src/lib.rs`):
  - `create_private_deposit()` - cria depósito com hash SHA256
  - `claim_deposit()` - resgata com código secreto
  - Struct `PrivateDeposit` (depositor, claim_hash, amount, claimed, bump)
  - Erros: `AlreadyClaimed`, `InvalidSecret`, `InvalidAmount`
- Cliente TypeScript gerado via Codama (`app/generated/vault/`)
- **[29/01]** Frontend completo (`app/components/vault-card.tsx`):
  - UI para criar depósito (funcional)
  - **Sistema de Magic Link implementado**
  - **Claim funcional** (deriva PDA corretamente)
  - Botões para copiar Magic Link e código secreto
  - Tabs para alternar entre criar/resgatar
  - Leitura automática de parâmetros da URL
  - Verificação de deploy do programa
  - Warnings de rede devnet
- **[29/01]** Landing page personalizada (`app/page.tsx`):
  - Branding PrivyLink
  - Explicação de como funciona
  - Textos em português
  - Footer do hackathon
- **[29/01]** Documentação completa:
  - `README.md` com roadmap, modelo de negócio e privacidade
  - `progress.md` atualizado
- **[29/01]** Deploy na Devnet realizado com sucesso:
  - Program ID: `98WwJxc1aAeqGWuaouQntJYmdQEnELntf9BqKXD3o34W`
  - Wallet usada: Solflare (`88rk9ofbfoh8iBLYX9NNS9NKCNZbbAJgfYppzNUd8LYU`)
  - Cliente TypeScript atualizado com novo Program ID
- **[29/01 20:10] BUG CRÍTICO CORRIGIDO - CLAIM FUNCIONANDO!** 🎉
  - **Bug**: System Program não permite `transfer` de contas com dados
  - **Causa**: `claim_deposit()` usava CPI para System Program em PDA com 82 bytes
  - **Solução**: Manipulação direta de lamports (`try_borrow_mut_lamports()`)
  - **Teste bem-sucedido**: https://solscan.io/tx/2r7NUtRabwssYoje5ELo5ok7x82E8yN8PreKke9BVgUhFYDyKs7XvGjiSsHPGoH6XqFD12bMjb5ivtwbzXp6XwPD?cluster=devnet

## 🚧 Em progresso
- (nenhum)

## ⚠️ Problemas encontrados
- (nenhum - bug do claim foi resolvido!)

## 📋 Próximos passos
1. ~~Resolver funcionalidade de claim~~ ✅ FEITO
2. ~~Fazer deploy do programa na devnet~~ ✅ FEITO
3. ~~Corrigir bug do System Program transfer~~ ✅ FEITO
4. Testar fluxo completo pelo frontend (create → share link → claim)
5. (Opcional) Adicionar QR code para Magic Link
6. (Futuro) Expiração + refund automático
7. (Futuro) Taxa de 0.25%

## 📊 Informações do Deploy

| Item | Valor |
|------|-------|
| Program ID | `98WwJxc1aAeqGWuaouQntJYmdQEnELntf9BqKXD3o34W` |
| Network | Devnet |
| Upgrade Authority | `88rk9ofbfoh8iBLYX9NNS9NKCNZbbAJgfYppzNUd8LYU` |
| Deploy Signature | `3tVMhg4G249ZTrc8guUraQtCh19RRaEatVWW6PyWHb6zsr6FmA4RAKuunm9bq8jfhUmuJWDpUXNk4wSkhDf4cRAo` |
