# PrivyLink

**Private transfers on Solana using secret-based vaults.**

PrivyLink enables unlinkable transfers through isolated vault PDAs. Send SOL to anyone without creating a direct on-chain link between sender and receiver.

## Features

- **Secret-based claims** - Recipients prove knowledge of a secret code to claim funds
- **Isolated vaults** - Each deposit creates a unique PDA, breaking transaction graphs
- **No recipient address** - Sender doesn't specify who receives the funds on-chain
- **SHA-256 verification** - Cryptographic proof without revealing the secret
- **Devnet ready** - Test the full flow without real funds

## Stack

| Layer          | Technology                              |
| -------------- | --------------------------------------- |
| Frontend       | Next.js 16, React 19, TypeScript        |
| Styling        | Tailwind CSS v4                         |
| Solana Client  | `@solana/client`, `@solana/react-hooks` |
| Program Client | Codama-generated, `@solana/kit`         |
| Program        | Anchor (Rust)                           |

---

## 🗺️ Roadmap, Privacidade e Modelo de Negócio

### 🔐 Como o PrivyLink Aumenta a Privacidade (Estado Atual)

O PrivyLink implementa **unlinkability on-chain** através de um design baseado em vaults isolados:

**Arquitetura de Privacidade:**

1. **Sem Transferência Direta**: As transferências não ocorrem diretamente de wallet para wallet
2. **Vault Neutro (PDA)**: Os fundos são primeiro comprometidos em um vault controlado por Program Derived Address
3. **Sem Destinatário Explícito**: O remetente não define quem receberá os fundos on-chain
4. **Prova de Conhecimento**: O destinatário apenas prova conhecimento de um secret para resgatar
5. **Link Quebrado**: Isso remove o link direto sender → receiver visível na blockchain

**O que oferecemos:**
- ✅ **Unlinkability**: Não há conexão on-chain explícita entre remetente e destinatário
- ✅ **Privacy-by-design**: O protocolo não armazena identidades vinculadas
- ✅ **Auditável**: Design compatível com análise de segurança e compliance

**O que NÃO oferecemos (ainda):**
- ❌ **Anonimato absoluto**: Análise avançada de blockchain pode correlacionar padrões
- ❌ **Ocultação de valores**: Amounts são visíveis on-chain (futuro: confidential transfers)
- ❌ **Mixing/Tumbling**: Não há pool compartilhado (futuro: vault global)

**Honestidade técnica**: O PrivyLink oferece uma camada significativa de privacidade através de unlinkability, mas não é uma solução de anonimato absoluto. É um ponto de partida sólido, compatível com evolução para privacidade criptográfica avançada (MPC, ZK).

---

### 💰 Modelo de Monetização (Planejado)

O PrivyLink planeja operar com um modelo de negócio simples e sustentável:

**Taxa de Transação: 0.25%** *(a ser implementado)*

| Aspecto | Detalhes |
|---------|----------|
| **Quando será cobrado** | No momento do depósito (create_private_deposit) |
| **Como funcionará** | Valor líquido enviado ao vault, taxa vai para Treasury PDA |
| **Exemplo** | Depósito de 1 SOL → 0.0025 SOL de taxa, 0.9975 SOL no vault |
| **Quem paga** | Remetente (depositante) |
| **Quem recebe** | Destinatário recebe o valor integral esperado |

**Comparação com o mercado:**

| Serviço | Taxa |
|---------|------|
| Tornado Cash | 0.3% |
| Railgun | 0.25% |
| **PrivyLink** | **0.25%** |
| PayPal/Stripe | 2.9% + $0.30 |
| Wire Transfers | $15-45 fixo |
| Western Union | 3-5% |

**Por que 0.25%?**

- ✅ **Benchmark de privacidade**: Alinhado com protocolos líderes (Tornado, Railgun)
- ✅ **Sustentável**: Permite crescimento sem depender de VCs ou subsidios
- ✅ **Transparente**: Taxa uniforme para todos os usuários, sem surpresas
- ✅ **Competitivo**: Ainda 10x mais barato que serviços tradicionais

**Para onde vai a taxa:**
- 100% direcionada para Treasury PDA do protocolo
- Usada para:
  - Auditorias de segurança contínuas
  - Desenvolvimento de features avançadas (MPC, ZK)
  - Grants para desenvolvedores do ecossistema
  - Crescimento e sustentabilidade do protocolo

**Nota importante**: A taxa não compromete a privacidade, pois é uniforme para todos os usuários e não cria metadados diferenciados.

---

### 🛣️ Roadmap de Evolução Técnica

#### **Phase 1 — MVP / Hackathon** (Estado Atual)

**Foco**: Fundação sólida com privacidade básica via unlinkability

- ✅ Vaults isolados por depósito (PDAs únicos)
- ✅ Sistema de claim baseado em secret + hash (SHA-256)
- ✅ Unlinkability on-chain
- ✅ Código open-source e auditável
- 🟡 Deploy em devnet (em progresso)
- 🟡 UX simplificada: magic links + QR codes (em progresso)
- 📋 Expiração configurável + refund automático (planejado)

**Objetivos do hackathon:**
- Protocolo funcional e seguro
- Modelo de negócio claro
- Base para evolução futura

---

#### **Phase 2 — Privacidade Avançada** 🟡 (Q2 2026)

**Foco**: Integração com computação confidencial

**Arcium MPC Integration:**
- Computação multi-party para validação de claims
- Redução de metadados visíveis on-chain
- Proteção contra análise de correlação temporal
- Privacidade aprimorada sem comprometer auditabilidade

**Benefícios:**
- Melhor resistência a análise avançada de blockchain
- Preparação para compliance regulatória
- Fundação para features enterprise

**Investimento necessário:**
- Pesquisa e desenvolvimento (3-6 meses)
- Auditoria de segurança especializada
- Testes extensivos em testnet

---

#### **Phase 3 — Vault Global + ZK Proofs** 🔴 (Q3-Q4 2026)

**Foco**: Privacidade criptográfica de próxima geração

**Vault Global / Privacy Pool:**
- Vault compartilhado entre múltiplos usuários
- Ledger lógico interno para commitments
- Maior entropia e fungibilidade
- Redução drástica de correlação temporal

**Zero-Knowledge Proofs (Noir + Sunspot):**
- Claims validados via ZK proofs
- Valores potencialmente ocultos (confidential transfers)
- Anonimato melhorado sem comprometer segurança

**Considerações de segurança:**
- Auditorias formais antes de launch
- Programa de bug bounty
- Implementação gradual com limites de risco
- Monitoramento contínuo

**Desafios técnicos:**
- Complexidade de implementação ZK na Solana
- Trade-offs entre privacidade e performance
- Custos computacionais de provas ZK
- Necessidade de educação de usuários

---

### 🚀 Visão de Negócio e Crescimento

#### **Passo 1 — Ganhar o Hackathon** (Janeiro 2026)

**Objetivos:**
- ✅ Validar a tese de produto com juízes técnicos
- ✅ Ganhar visibilidade no ecossistema Solana
- ✅ Atrair usuários iniciais e early adopters
- ✅ Receber feedback técnico de especialistas em privacidade
- ✅ Estabelecer credibilidade na comunidade

**Resultado esperado:**
- Prêmio financeiro para bootstrap inicial
- Network com mentores e investidores
- Usuários de teste na devnet/mainnet
- Validação técnica do approach

---

#### **Passo 2 — Captação de Investimento** (Q1-Q2 2026)

**Estratégia:**
- Usar vitória no hackathon como prova social
- Buscar **Solana Foundation grants** para desenvolvimento
- Pitch para **angels especializados em Web3**
- Explorar **seed funding** de VCs focados em privacidade

**Funding targets:**
- Grant inicial: $50k-100k
- Seed round: $500k-1M

**Uso de capital:**
- 40% - Desenvolvimento (MPC, ZK)
- 30% - Auditorias de segurança
- 20% - Marketing e crescimento
- 10% - Operações e legal

---

#### **Passo 3 — Escalar Equipe e Segurança** (Q2-Q4 2026)

**Expansão de equipe:**
- Contratar engenheiros especialistas em:
  - Cryptography (MPC, ZK)
  - Smart contracts Solana/Anchor
  - Frontend/UX para Web3
- Security researcher full-time
- Community manager / DevRel

**Investimento em segurança:**
- **Auditoria formal** com empresas especializadas (OtterSec, Kudelski)
- **Bug bounty program** (Immunefi, Code4rena)
- **Testes de penetração** contínuos
- **Incident response plan** antes de mainnet

**Milestones técnicos:**
- Q2: Arcium MPC integration (Phase 2)
- Q3: Vault global em testnet
- Q4: ZK proofs em produção (Phase 3)
- Q4: Mainnet launch com segurança hardened

---

### 🌟 Visão de Longo Prazo

**PrivyLink será um protocolo onde:**

1. **Privacidade é o padrão**, não uma opção cara ou complexa
2. **UX é simples como magic links**, mas com privacidade criptográfica robusta
3. **Sustentabilidade econômica** permite evolução contínua sem comprometer a missão
4. **Protocolo neutro e open-source**, auditável e extensível pela comunidade
5. **Compliance-ready**, balanceando privacidade com responsabilidade

**Tese central:**
> Privacidade não é um luxo, é um direito fundamental.
> O PrivyLink torna privacidade acessível, sustentável e escalável na Solana.

---

**Construído para o Solana Privacy Hack 2026**
**Roadmap sujeito a ajustes baseados em feedback da comunidade e avanços técnicos**

---

## Project Structure

```
├── app/
│   ├── components/
│   │   ├── providers.tsx      # Solana client setup
│   │   └── vault-card.tsx     # Vault deposit/withdraw UI
│   ├── generated/vault/       # Codama-generated program client
│   └── page.tsx               # Main page
├── anchor/                    # Anchor workspace
│   └── programs/vault/        # Vault program (Rust)
└── codama.json                # Codama client generation config
```

## Getting Started

```shell
npm install   # Builds program and generates client automatically
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), connect your wallet, and interact with the vault on devnet.

## Deploy Your Own Vault

The included vault program is already deployed to devnet. To deploy your own:

### Prerequisites

- [Rust](https://rustup.rs/)
- [Solana CLI](https://solana.com/docs/intro/installation)
- [Anchor](https://www.anchor-lang.com/docs/installation)

### Steps

1. **Configure Solana CLI for devnet**

   ```bash
   solana config set --url devnet
   ```

2. **Create a wallet (if needed) and fund it**

   ```bash
   solana-keygen new
   solana airdrop 2
   ```

3. **Build and deploy the program**

   ```bash
   cd anchor
   anchor build
   anchor keys sync    # Updates program ID in source
   anchor build        # Rebuild with new ID
   anchor deploy
   cd ..
   ```

4. **Regenerate the client and restart**
   ```bash
   npm run setup   # Rebuilds program and regenerates client
   npm run dev
   ```

## Testing

Tests use [LiteSVM](https://github.com/LiteSVM/litesvm), a fast lightweight Solana VM for testing.

```bash
npm run anchor-build   # Build the program first
npm run anchor-test    # Run tests
```

The tests are in `anchor/programs/vault/src/tests.rs` and automatically use the program ID from `declare_id!`.

## Regenerating the Client

If you modify the program, regenerate the TypeScript client:

```bash
npm run setup   # Or: npm run anchor-build && npm run codama:js
```

This uses [Codama](https://github.com/codama-idl/codama) to generate a type-safe client from the Anchor IDL.

## Learn More

- [Solana Docs](https://solana.com/docs) - core concepts and guides
- [Anchor Docs](https://www.anchor-lang.com/docs) - program development framework
- [Deploying Programs](https://solana.com/docs/programs/deploying) - deployment guide
- [framework-kit](https://github.com/solana-foundation/framework-kit) - the React hooks used here
- [Codama](https://github.com/codama-idl/codama) - client generation from IDL
