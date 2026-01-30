# PrivyLink

**Transferências privadas de SOL via Magic Links na Solana**

Construído para o **Solana Privacy Hack 2026**

---

## O que é?

PrivyLink permite enviar SOL para qualquer pessoa sem criar um link direto entre remetente e destinatário na blockchain. Use magic links compartilháveis e códigos secretos para transferências verdadeiramente privadas.

---

## Features

- [x] **Transferências Privadas** - Sem conexão direta entre wallets on-chain
- [x] **Magic Links** - Compartilhe via QR Code ou URL
- [x] **Expiração Configurável** - De 1 hora até 30 dias
- [x] **Auto-Refund** - Recupere fundos não claimados após expiração
- [x] **Claims com Secret** - Destinatário prova conhecimento do código

---

## Arquitetura

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  Remetente  │ ──▶  │  Vault PDA  │ ──▶  │ Destinatário│
└─────────────┘      └─────────────┘      └─────────────┘
       │                    │                    │
       │   Deposita SOL     │   Armazena temp.   │   Prova secret
       │   + claim_hash     │   Sem link direto  │   Recebe SOL
```

**Privacidade:**
- Remetente envia SOL para um vault PDA (não para o destinatário)
- Não há link on-chain entre remetente e destinatário
- Destinatário prova conhecimento do secret para resgatar

---

## Tech Stack

| Camada | Tecnologia |
|--------|------------|
| Blockchain | Solana (Anchor Framework) |
| Frontend | Next.js 16 + TypeScript |
| Styling | Tailwind CSS v4 |
| Network | Devnet |

---

## Smart Contract

**Program ID:** `98WwJxc1aAeqGWuaouQntJYmdQEnELntf9BqKXD3o34W`

### Funções

| Função | Parâmetros | Descrição |
|--------|------------|-----------|
| `create_private_deposit` | amount, claim_hash, expiration_hours | Cria depósito com expiração |
| `claim_deposit` | deposit_id, secret | Resgata com código secreto |
| `refund_expired` | deposit_id | Devolve fundos após expiração |

---

## Como Funciona

### Passo 1: Criar Depósito
Remetente deposita SOL e recebe:
- Magic Link (URL com deposit_id)
- Código Secreto

### Passo 2: Compartilhar
Envie o link e o código para o destinatário.
> Dica: Use canais diferentes para link e código (mais seguro)

### Passo 3: Claim
Destinatário abre o link, insere o código secreto e resgata o SOL.

---

## Status

### Pronto
- [x] Smart Contract (100%)
- [x] Interface de Criar Depósito
- [x] Interface de Claim
- [x] Interface de Refund
- [x] Magic Links + QR Codes
- [x] Expiração Configurável
- [x] Deploy na Devnet
- [x] Design System Solana (dark mode, gradientes, glass cards)
- [x] Testes de fluxo completo (sender → receiver)

### Futuro
- [ ] Taxa de 0.25% por transação
- [ ] Integração Arcium MPC (Fase 2)

---

## Executar Localmente

```bash
# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev

# Abrir no navegador
open http://localhost:3000
```

---

## Hackathon

**Solana Privacy Hack 2026**

Concorrendo aos prêmios:
- Helius
- Categoria Aberta
- Quicknode

---

## Licença

MIT

---

*Privacidade não é um luxo, é um direito fundamental.*
