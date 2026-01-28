# 🎯 Plano de Ação - Transformação Vault → PrivyLink

## 📋 Visão Geral da Transformação

**ATUAL:** Vault pessoal simples (1 depósito por usuário)  
**NOVO:** Sistema de transferências privadas (múltiplos depósitos com códigos secretos)

---

## 🔍 Análise da Estrutura Atual

### Estado Atual:
- **Account:** `SystemAccount` (apenas armazena SOL, sem dados)
- **PDA:** `["vault", signer.key()]` - um por usuário
- **Funções:** `deposit()`, `withdraw()`
- **Limitação:** Apenas 1 depósito por usuário

### Problemas a Resolver:
1. ❌ Não armazena dados (apenas SOL)
2. ❌ Não suporta múltiplos depósitos
3. ❌ Não tem sistema de códigos secretos
4. ❌ Não tem validação de hash

---

## 🏗️ Estrutura Nova Necessária

### 1. NOVA Account Struct: `PrivateDeposit`

```rust
#[account]
pub struct PrivateDeposit {
    pub depositor: Pubkey,        // Quem depositou
    pub claim_hash: [u8; 32],     // SHA256 do código secreto
    pub amount: u64,              // Quantidade depositada
    pub claimed: bool,            // Se já foi resgatado
    pub bump: u8,                 // Bump seed do PDA
}
```

**Tamanho:** 8 (discriminator) + 32 + 32 + 8 + 1 + 1 = **82 bytes**

### 2. NOVA Struct de Context: `CreatePrivateDeposit`

```rust
#[derive(Accounts)]
pub struct CreatePrivateDeposit<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,
    
    #[account(
        init,
        payer = depositor,
        space = 8 + 32 + 32 + 8 + 1 + 1, // 82 bytes
        seeds = [b"deposit", depositor.key().as_ref(), &deposit_id.to_le_bytes()],
        bump
    )]
    pub deposit: Account<'info, PrivateDeposit>,
    
    pub system_program: Program<'info, System>,
}
```

**Observação:** `deposit_id` pode ser um contador ou hash único

### 3. NOVA Struct de Context: `ClaimDeposit`

```rust
#[derive(Accounts)]
pub struct ClaimDeposit<'info> {
    #[account(mut)]
    pub claimer: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"deposit", deposit.depositor.as_ref(), &deposit_id.to_le_bytes()],
        bump = deposit.bump,
        constraint = !deposit.claimed @ PrivyLinkError::AlreadyClaimed,
        constraint = deposit.claim_hash == sha256_hash @ PrivyLinkError::InvalidSecret
    )]
    pub deposit: Account<'info, PrivateDeposit>,
    
    pub system_program: Program<'info, System>,
}
```

---

## 🔧 Funções que Precisam Mudar

### ❌ REMOVER:
- `deposit()` - substituída por `create_private_deposit()`
- `withdraw()` - substituída por `claim_deposit()`

### ✅ CRIAR:

#### `create_private_deposit(amount, claim_hash) -> Result<u64>`
**Parâmetros:**
- `amount: u64` - Quantidade em lamports
- `claim_hash: [u8; 32]` - SHA256 do código secreto

**Lógica:**
1. Gerar `deposit_id` único (timestamp ou contador)
2. Validar `amount > rent` (para cobrir criação da account)
3. Criar account `PrivateDeposit` via PDA
4. Transferir SOL do depositor para a account
5. Retornar `deposit_id`

**PDA Seeds:** `["deposit", depositor.key(), deposit_id]`

#### `claim_deposit(deposit_id, secret) -> Result<()>`
**Parâmetros:**
- `deposit_id: u64` - ID do depósito
- `secret: String` - Código secreto (será hasheado)

**Lógica:**
1. Calcular `sha256_hash = sha256(secret)`
2. Validar `sha256_hash == deposit.claim_hash`
3. Validar `!deposit.claimed`
4. Transferir SOL para o claimer
5. Marcar `deposit.claimed = true`

**PDA Seeds:** `["deposit", deposit.depositor, deposit_id]`

---

## 📝 Modificações Necessárias no Código

### 1. **lib.rs - Imports Adicionais:**
```rust
use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use solana_program::keccak::hash; // Para hash (ou sha2 se disponível)
```

**NOTA:** Anchor/Solana tem `solana_program::keccak::hash` disponível, mas para SHA256 pode precisar adicionar `sha2` no Cargo.toml

### 2. **lib.rs - Account Struct:**
```rust
#[account]
pub struct PrivateDeposit {
    pub depositor: Pubkey,
    pub claim_hash: [u8; 32],
    pub amount: u64,
    pub claimed: bool,
    pub bump: u8,
}
```

### 3. **lib.rs - Error Codes:**
```rust
#[error_code]
pub enum PrivyLinkError {
    #[msg("Deposit already claimed")]
    AlreadyClaimed,
    #[msg("Invalid secret code")]
    InvalidSecret,
    #[msg("Invalid amount")]
    InvalidAmount,
}
```

### 4. **lib.rs - Função create_private_deposit:**
- Gerar deposit_id (pode usar Clock::get()?.unix_timestamp como seed)
- Criar account com init
- Transferir SOL
- Retornar deposit_id

### 5. **lib.rs - Função claim_deposit:**
- Calcular SHA256 do secret
- Validar hash
- Validar não reivindicado
- Transferir SOL
- Marcar como claimed

---

## 🧪 Adaptação dos Testes

### Testes a REMOVER:
- ❌ `test_deposit_and_withdraw()` - lógica antiga
- ❌ `test_deposit_fails_if_vault_has_funds()` - não aplicável
- ❌ `test_withdraw_fails_if_vault_empty()` - não aplicável

### Testes a CRIAR:

#### 1. `test_create_private_deposit()`
- Criar depósito com hash
- Verificar account criada
- Verificar saldo transferido
- Verificar dados corretos

#### 2. `test_claim_deposit_with_valid_secret()`
- Criar depósito
- Reivindicar com código secreto correto
- Verificar SOL transferido para claimer
- Verificar `claimed = true`

#### 3. `test_claim_deposit_with_invalid_secret()`
- Criar depósito
- Tentar reivindicar com código errado
- Deve falhar

#### 4. `test_claim_deposit_twice_fails()`
- Criar e reivindicar depósito
- Tentar reivindicar novamente
- Deve falhar

#### 5. `test_multiple_deposits_same_user()`
- Criar múltiplos depósitos do mesmo usuário
- Cada um deve ter deposit_id único
- Todos devem funcionar independentemente

---

## 🔑 Decisões de Design Importantes

### 1. **Como gerar deposit_id?**
**Opção A:** Contador global (requer account global)
**Opção B:** Timestamp (pode ter colisões)
**Opção C:** Hash(depositor + amount + claim_hash) (determinístico)
**Opção D:** Usar bump como parte do ID

**RECOMENDAÇÃO:** Opção C - Hash determinístico, único, não requer account extra

### 2. **Onde calcular SHA256?**
**Opção A:** No programa (mais seguro, valida no-chain)
**Opção B:** No frontend (menos seguro, pode ser manipulado)

**RECOMENDAÇÃO:** Opção A - Calcular no programa para segurança

### 3. **Como passar o secret?**
**Opção A:** Como String (mais fácil no frontend)
**Opção B:** Como [u8; 32] (já hasheado)

**RECOMENDAÇÃO:** Opção A - Receber String, hashear no programa

### 4. **Estrutura do deposit_id:**
```rust
// Calcular deposit_id como hash único
let deposit_id_bytes = [
    depositor.key().as_ref(),
    &amount.to_le_bytes(),
    &claim_hash,
].concat();
let deposit_id = u64::from_le_bytes(
    Sha256::digest(&deposit_id_bytes)[0..8].try_into().unwrap()
);
```

---

## 📋 Plano de Implementação Passo a Passo

### FASE 1: Preparação
1. ✅ Fazer backup do código atual
2. ✅ Criar branch `feature/privylink`
3. ✅ Adicionar dependência `sha2` no Cargo.toml:
   ```toml
   [dependencies]
   anchor-lang = "0.32.1"
   sha2 = "0.10"  # Para SHA256
   ```

### FASE 2: Modificar lib.rs
1. Adicionar imports (sha2)
2. Criar struct `PrivateDeposit`
3. Criar enum `PrivyLinkError`
4. Implementar `create_private_deposit()`
5. Implementar `claim_deposit()`
6. Remover funções antigas (`deposit`, `withdraw`)
7. Remover struct antiga (`VaultAction`)

### FASE 3: Atualizar Testes
1. Remover testes antigos
2. Criar helper functions novas
3. Implementar `test_create_private_deposit()`
4. Implementar `test_claim_deposit_with_valid_secret()`
5. Implementar `test_claim_deposit_with_invalid_secret()`
6. Implementar `test_claim_deposit_twice_fails()`
7. Implementar `test_multiple_deposits_same_user()`

### FASE 4: Compilar e Testar
1. `anchor build` - verificar compilação
2. `anchor test --skip-deploy` - rodar testes
3. Corrigir erros se houver

### FASE 5: Atualizar Frontend (depois)
1. Regenerar cliente: `npm run codama:js`
2. Atualizar `vault-card.tsx` para novas funções
3. Adicionar UI para criar depósito com código secreto
4. Adicionar UI para reivindicar com código

---

## ⚠️ Pontos de Atenção

### 1. **Rent Exemption:**
- Account precisa ter SOL suficiente para rent
- Calcular: `rent = Rent::get()?.minimum_balance(82)`
- Validar: `amount > rent`

### 2. **SHA256 no Anchor:**
- Usar crate `sha2` ou `anchor_lang::solana_program::hash`
- Verificar disponibilidade no ambiente Anchor

### 3. **PDA Uniqueness:**
- Garantir que deposit_id seja único
- Usar hash determinístico baseado em dados únicos

### 4. **Account Space:**
- Calcular espaço exato: discriminator (8) + campos
- Usar `space = 8 + 32 + 32 + 8 + 1 + 1 = 82`

### 5. **Constraints:**
- Validar `!claimed` antes de transferir
- Validar hash antes de transferir
- Usar constraints do Anchor quando possível

---

## 🔐 Considerações de Segurança

1. ✅ Hash calculado no programa (não confiar no frontend)
2. ✅ Validação de `claimed` para prevenir double-spend
3. ✅ PDA garante que apenas quem sabe o secret pode reivindicar
4. ✅ Depositor não pode reivindicar (apenas quem tem o secret)

---

## 📊 Comparação: Antes vs Depois

| Aspecto | Antes (Vault) | Depois (PrivyLink) |
|---------|---------------|-------------------|
| **Accounts** | SystemAccount (sem dados) | PrivateDeposit (com dados) |
| **Depósitos** | 1 por usuário | Múltiplos por usuário |
| **Segurança** | Apenas dono retira | Código secreto necessário |
| **PDA Seeds** | `["vault", user]` | `["deposit", user, id]` |
| **Funções** | deposit, withdraw | create_private_deposit, claim_deposit |
| **Dados Armazenados** | Nenhum | depositor, hash, amount, claimed |

---

## ✅ Checklist de Implementação

### Backend (Anchor):
- [ ] Adicionar dependência sha2
- [ ] Criar struct PrivateDeposit
- [ ] Criar enum PrivyLinkError
- [ ] Implementar create_private_deposit()
- [ ] Implementar claim_deposit()
- [ ] Remover código antigo
- [ ] Atualizar testes
- [ ] Compilar e testar

### Frontend (depois):
- [ ] Regenerar cliente TypeScript
- [ ] Atualizar vault-card.tsx
- [ ] Adicionar UI para criar depósito
- [ ] Adicionar UI para reivindicar
- [ ] Testar fluxo completo

---

## 🚀 Próximos Passos

1. **Revisar este plano** - garantir que está completo
2. **Decidir sobre deposit_id** - qual método usar
3. **Verificar dependências** - sha2 disponível no Anchor?
4. **Começar FASE 1** - preparação e backup

---

**Pronto para começar a implementação?** 🎯

