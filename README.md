# PrivyLink

**Private SOL transfers via Magic Links on Solana**

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://privylink.vercel.app/)
[![Solana](https://img.shields.io/badge/Solana-Devnet-blueviolet)](https://explorer.solana.com/address/98WwJxc1aAeqGWuaouQntJYmdQEnELntf9BqKXD3o34W?cluster=devnet)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

> Built for **Solana Privacy Hack 2026**

---

## Overview

PrivyLink enables private SOL transfers without creating a direct on-chain link between sender and receiver. Using shareable magic links and secret codes, users can send funds with true privacy.

**Live Demo:** [privylink.vercel.app](https://privylink.vercel.app/)

---

## How It Works

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Sender    │ ───▶ │  Vault PDA  │ ───▶ │  Receiver   │
└─────────────┘      └─────────────┘      └─────────────┘
       │                    │                    │
       │  Deposits SOL      │  Temporary hold    │  Proves secret
       │  + claim_hash      │  No direct link    │  Receives SOL
```

### Step 1: Create Deposit
Sender deposits SOL and receives:
- **Magic Link** (URL with deposit parameters)
- **Secret Code** (required to claim)
- **QR Code** for easy sharing

### Step 2: Share
Send the magic link to the receiver via any channel.
> Pro tip: Send link and secret through different channels for extra security

### Step 3: Claim
Receiver opens the link, enters the secret code, and claims the SOL.

### Step 4: Expiration (Optional)
If unclaimed, sender can refund after expiration (1 hour to 30 days).

---

## Features

- **Private Transfers** - No direct wallet-to-wallet link on-chain
- **Magic Links** - Share via URL or QR Code
- **Secret Codes** - Receiver proves knowledge to claim
- **Configurable Expiration** - 1 hour to 30 days
- **Auto-Refund** - Recover unclaimed funds after expiration
- **0.25% Platform Fee** - Coming soon

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Smart Contract | Solana (Anchor Framework) |
| Frontend | Next.js 16 + TypeScript |
| Styling | Tailwind CSS v4 |
| RPC Provider | [Helius](https://www.helius.dev/) |
| Deployment | Vercel |
| Network | Devnet |

---

## Smart Contract

**Program ID:** [`98WwJxc1aAeqGWuaouQntJYmdQEnELntf9BqKXD3o34W`](https://explorer.solana.com/address/98WwJxc1aAeqGWuaouQntJYmdQEnELntf9BqKXD3o34W?cluster=devnet)

### Instructions

| Function | Parameters | Description |
|----------|------------|-------------|
| `create_private_deposit` | amount, claim_hash, expiration_hours | Creates deposit with expiration |
| `claim_deposit` | deposit_id, secret | Claims with secret code |
| `refund_expired` | deposit_id | Refunds after expiration |

### Account Structure

```rust
pub struct PrivateDeposit {
    pub depositor: Pubkey,      // 32 bytes
    pub claim_hash: [u8; 32],   // SHA256 of secret
    pub amount: u64,            // Lamports
    pub claimed: bool,          // Claim status
    pub bump: u8,               // PDA bump
    pub created_at: i64,        // Unix timestamp
    pub expires_at: i64,        // Expiration timestamp
}
```

---

## Privacy Model

PrivyLink provides **transactional privacy** through intermediary vaults:

1. **Sender → Vault**: Sender deposits to a PDA (not receiver's wallet)
2. **Vault → Receiver**: Receiver claims by proving secret knowledge
3. **No Direct Link**: On-chain, there's no transaction between sender and receiver

**What's Private:**
- Receiver's identity (from sender's perspective on-chain)
- Direct sender-receiver relationship

**What's Public:**
- Deposit amounts
- Vault addresses
- Claim transactions

---

## Why PrivyLink?

| Feature | PrivyLink | ZK-based Solutions |
|---------|-----------|-------------------|
| Setup complexity | Simple | Complex ZK circuits |
| User experience | Magic links + QR | Wallet-to-wallet |
| Gas costs | Low (single tx) | High (ZK verification) |
| Privacy level | Transactional | Full anonymity |
| Time to integrate | Minutes | Days/weeks |

**Our approach:** Hash-based verification with SHA-256. No complex ZK proofs, no trusted setup, no heavy cryptography. Simple, auditable, and effective for everyday private transfers.

> "Privacy doesn't have to be complicated."

---

## Roadmap

### Phase 1 - MVP (Current)
- [x] Private deposits with secret codes
- [x] Magic links with QR codes
- [x] Configurable expiration
- [x] Auto-refund for expired deposits
- [x] My Deposits dashboard
- [x] Devnet deployment

### Phase 2 - Enhanced Privacy
- [ ] Arcium MPC integration
- [ ] Encrypted metadata
- [ ] Stealth addresses

### Phase 3 - Production
- [ ] Mainnet deployment
- [ ] Multi-token support (SPL tokens)
- [ ] Batch transfers
- [ ] Mobile app

---

## Local Development

### Prerequisites
- Node.js 18+
- Solana CLI
- Anchor Framework

### Setup

```bash
# Clone repository
git clone https://github.com/renner16/privylink.git
cd privylink

# Install dependencies
npm install

# Run development server
npm run dev

# Open browser
open http://localhost:3000
```

### Build

```bash
npm run build
```

### Deploy Contract (Devnet)

```bash
cd anchor
anchor build
anchor deploy --provider.cluster devnet
```

---

## Testing

Configure your wallet for **Devnet**:
- Phantom: Settings → Developer Settings → Testnet Mode
- Solflare: Settings → Network → Devnet

Get devnet SOL: [faucet.solana.com](https://faucet.solana.com/)

---

## Project Structure

```
privylink/
├── app/                    # Next.js frontend
│   ├── components/         # React components
│   ├── deposits/           # My Deposits page
│   ├── generated/          # Codama-generated client
│   └── page.tsx            # Landing page
├── anchor/                 # Solana program
│   └── programs/vault/     # Anchor smart contract
└── README.md
```

---

## Hackathon

**Solana Privacy Hack 2026** — $100,000+ Prize Pool

Competing for:
- **Private Payments Track** - $15,000
- **Helius Bounty** - $5,000 *(using Helius RPC)*

---

## Author

**renner16**

- GitHub: [@renner16](https://github.com/renner16)
- X: [@_renner_araujo](https://x.com/_renner_araujo)

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<p align="center">
  <i>Privacy is not a luxury, it's a fundamental right.</i>
</p>
