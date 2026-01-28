# 🚀 Guia de Deploy do Programa PrivyLink

## ❌ Erro: "Transaction simulation failed"

Se você está recebendo este erro, o programa **não está deployado** na devnet.

## 📋 Pré-requisitos

Antes de fazer o deploy, você precisa ter instalado:

1. **Rust** - [https://rustup.rs/](https://rustup.rs/)
2. **Solana CLI** - [https://docs.solana.com/cli/install-solana-cli-tools](https://docs.solana.com/cli/install-solana-cli-tools)
3. **Anchor** - [https://www.anchor-lang.com/docs/installation](https://www.anchor-lang.com/docs/installation)

### Verificar instalações:

```bash
rustc --version
solana --version
anchor --version
```

## 🔧 Passo a Passo para Deploy

### 1. Navegue até a pasta do Anchor

```bash
cd privylink-dapp/anchor
```

### 2. Configure o Solana CLI para Devnet

```bash
solana config set --url devnet
```

### 3. Verifique sua wallet

```bash
solana address
```

Se não tiver uma wallet, crie uma:

```bash
solana-keygen new
```

### 4. Obtenha SOL na Devnet (para deploy)

Você precisa de aproximadamente **2 SOL** na devnet para fazer o deploy:

```bash
solana airdrop 2
```

Se o airdrop falhar (limite diário), tente novamente mais tarde ou use uma faucet:
- [Solana Faucet](https://faucet.solana.com/)

### 5. Verifique o saldo

```bash
solana balance
```

### 6. Faça o build do programa

```bash
anchor build
```

Isso vai:
- Compilar o programa Rust
- Gerar o IDL (Interface Definition Language)
- Criar o arquivo `target/deploy/vault.so`

### 7. Faça o deploy

```bash
anchor deploy --provider.cluster devnet
```

**Importante:** O programa ID já está configurado como `9M7Sh6WUWwgfppwvCtbgAf8kPimY2xMjiNmZwEnyMGL8` no código.

Se você quiser usar um programa ID diferente:

1. Gere um novo keypair:
   ```bash
   solana-keygen new -o target/deploy/vault-keypair.json
   ```

2. Obtenha o novo programa ID:
   ```bash
   solana address -k target/deploy/vault-keypair.json
   ```

3. Atualize o programa ID em:
   - `anchor/Anchor.toml` - linha `vault = "..."`
   - `anchor/programs/vault/src/lib.rs` - linha `declare_id!("...")`

4. Regenere o cliente TypeScript:
   ```bash
   cd ..
   npm run codama:js
   ```

### 8. Verifique o deploy

```bash
solana program show 9M7Sh6WUWwgfppwvCtbgAf8kPimY2xMjiNmZwEnyMGL8 --url devnet
```

Você deve ver informações sobre o programa, incluindo o tamanho e a data de deploy.

## ✅ Após o Deploy

1. Recarregue a página do app (`http://localhost:3000`)
2. O app vai verificar automaticamente se o programa está deployado
3. Tente criar um depósito novamente

## 🐛 Problemas Comuns

### "Program account does not exist"
- O programa não está deployado
- Execute `anchor deploy --provider.cluster devnet`

### "Insufficient funds"
- Você não tem SOL suficiente na devnet
- Execute `solana airdrop 2`

### "Wallet not found"
- Configure sua wallet: `solana config set --keypair ~/.config/solana/id.json`
- Ou especifique o caminho: `anchor deploy --provider.wallet /caminho/para/sua/wallet.json`

### "Anchor not found"
- Instale o Anchor: `cargo install --git https://github.com/coral-xyz/anchor avm --locked --force`
- Depois: `avm install latest && avm use latest`

## 📝 Notas

- O deploy na devnet é **gratuito** (usa SOL de teste)
- O programa ID é fixo: `9M7Sh6WUWwgfppwvCtbgAf8kPimY2xMjiNmZwEnyMGL8`
- Após o deploy, o programa fica disponível para todos usarem
- Você pode fazer redeploy quantas vezes quiser na devnet


