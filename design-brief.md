# PrivyLink - Design Brief

## Missão

Redesenhar completamente o PrivyLink para ter a mesma identidade visual dos produtos oficiais da Solana. Quando alguém olhar o projeto, deve imediatamente reconhecer como sendo parte do ecossistema Solana.

---

## Referências Principais

1. **Solana Privacy Hack** (referência principal): https://www.solanaprivacyhack.com
2. **Solana.com**: https://solana.com
3. **Solana Developers**: https://solana.com/developers

---

## Princípios de Design

### Cores
- Fundo: **Preto puro** (#000000 ou muito próximo)
- Gradientes: Roxo, verde e azul específicos da Solana
- Accent colors extraídos das referências

### Cards
- Translúcidos com backdrop blur
- Bordas sutis (border com opacidade baixa)
- Glassmorphism sutil

### Tipografia
- Títulos: Muito grandes e bold
- Corpo: Grande e confortável
- Espaçamento: Generoso para dar respiro visual

### Estilo Geral
- **Product-first**, não marketing
- Deve parecer um produto real e funcional
- **Absolutamente sem emojis** ou ilustrações cartunizadas
- Minimalista e profissional

---

## Estrutura das Páginas

### 1. Landing Page (/)

#### Hero Section
```
┌─────────────────────────────────────────────┐
│                                             │
│     Private Transfers on Solana             │  <- Título impactante
│                                             │
│     Send SOL without linking wallets        │  <- Subtítulo curto
│                                             │
│     [Send Privately]  [Claim Transfer]      │  <- CTAs com gradiente
│                                             │
└─────────────────────────────────────────────┘
```

#### How It Works (3 colunas)
```
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│    Step 1     │  │    Step 2     │  │    Step 3     │
│               │  │               │  │               │
│  Commit funds │  │ Share private │  │  Claim with   │
│  to a vault   │  │     link      │  │   a secret    │
└───────────────┘  └───────────────┘  └───────────────┘
```

#### Privacy by Design (cards)
- No direct wallet-to-wallet transfers
- Recipient not defined on-chain
- Unlinkability by default

#### Roadmap (timeline)
```
Phase 1          Phase 2           Phase 3
[✓] PDA Vaults   [~] Arcium MPC    [ ] Global Vault + ZK
    COMPLETE         IN PROGRESS        FUTURE
```

#### Footer
- GitHub link
- Devnet link
- "Built for Solana Privacy Hack 2026"

---

### 2. Send Page (/send ou integrado na home)
- Layout limpo e centrado
- Formulário minimalista
- Estado de sucesso elegante com Magic Link + QR Code

### 3. Claim Page (via URL params)
- Interface focada
- CTAs claros
- Feedback visual premium no sucesso

### 4. Refund Page (/refund)
- Consistência visual
- Depósitos em tabela/grid
- Ações bem destacadas

---

## Detalhes Técnicos

### Stack
- Next.js App Router (já configurado)
- Tailwind CSS apenas (sem bibliotecas extras)
- Framer Motion opcional para animações suaves

### Output Esperado
1. Design system em `globals.css` com variáveis
2. Todas as 4 páginas redesenhadas (funcionalidade 100%)
3. Componentes em `components/ui/`
4. Este documento atualizado com decisões

### Constraints
- **Funcionalidade atual DEVE ser mantida**
- Mobile-first e responsivo
- Sem animações pesadas que afetem performance

---

## Workflow de Execução

1. **Analisar** sites da Solana com web_fetch
2. **Extrair** design tokens (cores, fontes, espaçamentos)
3. **Criar** design system em globals.css
4. **Redesenhar** páginas uma por uma:
   - Landing → Send → Claim → Refund
5. **Testar** após cada página (responsivo, funcional, visual)

---

## Design Tokens a Extrair

### Da Solana
- [ ] Paleta de cores exata
- [ ] Famílias de fontes
- [ ] Tamanhos de fonte
- [ ] Espaçamentos
- [ ] Border radius
- [ ] Shadows/glows
- [ ] Gradientes específicos

---

*Este documento será atualizado conforme o redesign progride.*
