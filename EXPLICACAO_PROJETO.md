# 📚 Explicação do Template NextJS-Anchor

## 1. Programa Anchor (`anchor/programs/vault/src/lib.rs`)

### O que faz?
Um **cofre pessoal de SOL** (vault) onde cada usuário pode:
- **Depositar** SOL em um PDA (Program Derived Address) único
- **Retirar** todo o SOL depositado

### Funções principais:

#### `deposit(amount: u64)`
- **O que faz:** Transfere SOL da carteira do usuário para o vault PDA
- **Validações:**
  - Vault deve estar vazio (não pode depositar se já tiver fundos)
  - Valor deve ser maior que o rent mínimo
- **Como funciona:**
  - Cria um PDA usando seeds: `["vault", signer.key()]`
  - Transfere SOL via CPI (Cross-Program Invocation) do System Program

#### `withdraw()`
- **O que faz:** Retira TODO o SOL do vault de volta para a carteira
- **Validações:**
  - Vault deve ter fundos (lamports > 0)
- **Como funciona:**
  - Usa `CpiContext::new_with_signer` com seeds do PDA
  - Transfere todos os lamports do vault para o signer

### Estrutura de Contas (`VaultAction`):
```rust
- signer: Signer<'info>          // Usuário que assina a transação
- vault: SystemAccount<'info>    // PDA do vault (único por usuário)
- system_program: Program        // Programa do sistema Solana
```

### Características importantes:
- **PDA (Program Derived Address):** Cada usuário tem seu próprio vault
- **Seeds:** `[b"vault", signer.key().as_ref()]` - garante unicidade
- **Segurança:** Apenas o dono pode retirar (via seeds do PDA)

---

## 2. Frontend (`app/components/vault-card.tsx`)

### Como se conecta com o programa?

#### 1. **Conexão via Cliente Solana:**
```typescript
// providers.tsx cria o cliente
const client = createClient({
  endpoint: "https://api.devnet.solana.com",
  walletConnectors: autoDiscover(), // Detecta carteiras automaticamente
});
```

#### 2. **Hooks do React:**
- `useWalletConnection()` - Gerencia conexão da carteira
- `useSendTransaction()` - Envia transações
- `useBalance()` - Monitora saldo do vault

#### 3. **Derivação do PDA:**
```typescript
const [pda] = await getProgramDerivedAddress({
  programAddress: VAULT_PROGRAM_ADDRESS,
  seeds: [
    getBytesEncoder().encode(new Uint8Array([118, 97, 117, 108, 116])), // "vault"
    getAddressEncoder().encode(walletAddress),
  ],
});
```

#### 4. **Construção de Instruções:**
- Usa encoders gerados automaticamente pelo Codama
- `getDepositInstructionDataEncoder()` - Codifica dados do deposit
- `getWithdrawInstructionDataEncoder()` - Codifica dados do withdraw

### Interações disponíveis:

#### **Deposit (Depositar):**
1. Usuário digita quantidade em SOL
2. Frontend converte para lamports
3. Constrói instrução com:
   - Program address
   - Accounts (signer, vault PDA, system program)
   - Data (amount codificado)
4. Envia transação via `send()`
5. Aguarda confirmação

#### **Withdraw (Retirar):**
1. Usuário clica "Withdraw All"
2. Frontend constrói instrução (sem amount - retira tudo)
3. Envia transação
4. Aguarda confirmação

### Estados e Validações:
- ✅ Só permite depositar se vault estiver vazio
- ✅ Só permite retirar se vault tiver fundos
- ✅ Mostra saldo do vault em tempo real
- ✅ Exibe status da transação

---

## 3. Estrutura Geral do Projeto

### Fluxo de Conexão:

```
1. layout.tsx
   └── Providers (SolanaProvider)
       └── page.tsx
           ├── useWalletConnection() → Conecta carteira
           └── VaultCard
               ├── Deriva PDA do vault
               ├── useBalance() → Monitora saldo
               └── useSendTransaction() → Envia transações
```

### Arquivos Importantes:

#### **Backend (Programa):**
- `anchor/programs/vault/src/lib.rs` - Lógica do programa
- `anchor/Anchor.toml` - Configuração (cluster, program ID)
- `anchor/target/idl/vault.json` - IDL gerado (interface)

#### **Frontend:**
- `app/layout.tsx` - Layout raiz, envolve com Providers
- `app/components/providers.tsx` - Configura cliente Solana
- `app/components/vault-card.tsx` - UI e lógica do vault
- `app/page.tsx` - Página principal
- `app/generated/vault/` - Cliente TypeScript gerado pelo Codama

### Configurações Importantes:

#### **Anchor.toml:**
```toml
[provider]
cluster = "devnet"  # Rede Solana
wallet = "~/.config/solana/id.json"

[programs.devnet]
vault = "9M7Sh6WUWwgfppwvCtbgAf8kPimY2xMjiNmZwEnyMGL8"  # Program ID
```

#### **providers.tsx:**
```typescript
endpoint: "https://api.devnet.solana.com"  // RPC endpoint
walletConnectors: autoDiscover()  // Detecta Phantom, Solflare, etc.
```

### Como os Componentes se Conectam:

1. **Providers** → Cria cliente Solana e disponibiliza via Context
2. **Page** → Usa hooks para conectar carteira
3. **VaultCard** → 
   - Deriva PDA baseado no endereço da carteira
   - Usa cliente gerado (`app/generated/vault/`) para construir instruções
   - Envia transações via `useSendTransaction()`
   - Monitora saldo via `useBalance()`

### Cliente Gerado (`app/generated/vault/`):

O **Codama** gera automaticamente:
- Encoders para instruções (`getDepositInstructionDataEncoder`)
- Endereço do programa (`VAULT_PROGRAM_ADDRESS`)
- Tipos TypeScript baseados no IDL

Isso garante **type-safety** entre frontend e programa!

---

## 🔑 Conceitos Chave

### PDA (Program Derived Address)
- Endereço derivado determinísticamente
- Cada usuário tem seu próprio vault
- Seeds: `["vault", user_public_key]`

### CPI (Cross-Program Invocation)
- Programa chama outro programa (System Program)
- Usado para transferir SOL

### IDL (Interface Definition Language)
- Descreve a interface do programa
- Usado para gerar cliente TypeScript
- Garante type-safety

### Hooks React
- Abstraem complexidade de RPC calls
- Gerenciam estado de conexão/transações
- Simplificam integração frontend ↔ blockchain

---

## 🎯 Resumo

**Backend:** Programa Anchor em Rust que gerencia vaults pessoais de SOL  
**Frontend:** React/Next.js que se conecta via hooks e cliente gerado  
**Conexão:** Cliente Solana → Hooks React → Cliente gerado → Instruções → Blockchain

**Fluxo:** Conectar carteira → Derivar PDA → Depositar/Retirar SOL → Monitorar saldo




