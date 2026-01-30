# PrivyLink - Top 10 Próximos Passos

**Priorizado para: Solana Privacy Hack 2026**

---

## 🔴 URGENTE (Fazer Agora)

### 1. Testar Fluxo Completo com Expiração
```bash
# No frontend:
1. Criar depósito com expiração de 1 hora
2. Verificar que Magic Link + QR funcionam
3. Claim antes de expirar → deve funcionar
4. Criar outro depósito de 1 hora
5. Esperar expirar (ou simular no código)
6. Tentar claim → deve falhar com "Deposit expired"
```
**Tempo estimado**: 15 min

### 2. Commit e Push das Mudanças
```bash
cd C:\Dev\PrivyLink
git add .
git commit -m "feat: adiciona expiração configurável e QR Code"
git push origin main
```
**Tempo estimado**: 2 min

---

## 🟡 IMPORTANTE (Antes da Submissão)

### 3. UI para Refund de Depósitos Expirados
Adicionar nova tab ou botão em vault-card.tsx:
- Input: deposit_id
- Botão: "Recuperar Fundos Expirados"
- Chamar refund_expired do smart contract
**Tempo estimado**: 30-45 min

### 4. Mostrar Countdown de Expiração
No card de sucesso após criar depósito:
- Calcular expires_at baseado em expiration_hours
- Mostrar "⏰ Expira em: 23h 45m"
- Atualizar a cada minuto
**Tempo estimado**: 20 min

### 5. Melhorar Mensagens de Erro
Traduzir todos os erros para PT-BR:
- DepositExpired → "Este depósito expirou! Use o refund."
- NotExpiredYet → "Depósito ainda não expirou."
**Tempo estimado**: 10 min

---

## 🟢 NICE TO HAVE (Se Sobrar Tempo)

### 6. Confirmação Antes de Criar Depósito
Modal ou dialog:
- "Você está prestes a depositar X SOL"
- "Expira em: Y horas"
- "Código: Z (guarde bem!)"
- Botões: Cancelar | Confirmar
**Tempo estimado**: 25 min

### 7. Histórico Local de Depósitos
Salvar em localStorage:
- Lista de {depositId, amount, expirationHours, createdAt}
- Tab "Meus Depósitos" com status
- Link para refund se expirado
**Tempo estimado**: 45 min

### 8. Toast Notifications
Substituir status text por toasts elegantes:
- Sucesso: verde, auto-dismiss
- Erro: vermelho, persistente
- Loading: spinner
**Tempo estimado**: 30 min

### 9. Dark Mode Completo
Estender dark mode do QR card para toda UI:
- Detectar preferência do sistema
- Toggle manual
**Tempo estimado**: 40 min

### 10. Video/GIF Demo para README
Gravar:
- Conectar wallet
- Criar depósito
- Copiar Magic Link
- Claim em outra aba
**Tempo estimado**: 20 min

---

## Ordem Recomendada de Execução

| Prioridade | Task | Tempo |
|------------|------|-------|
| 1 | Testar fluxo expiração | 15 min |
| 2 | Commit e push | 2 min |
| 3 | UI Refund | 45 min |
| 4 | Countdown expiração | 20 min |
| 5 | Mensagens erro | 10 min |
| **Total Mínimo** | | **~1h30** |

---

## Comando Rápido para Testar

```bash
# Terminal 1 - Dev server
cd C:\Dev\PrivyLink && npm run dev

# Terminal 2 - Criar depósito de teste
# (usar o frontend em localhost:3000)
```

---

*Gerado em 29/01/2026*
