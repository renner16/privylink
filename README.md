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

### TL;DR (60 seconds)

- **Send SOL** → get a magic link + secret code
- **Share** link + secret with receiver
- **Receiver claims** by proving knowledge of secret
- **No sender ↔ receiver link on-chain**
- **Manual refund** available if deposit expires unclaimed

> **Not ZK, not fully anonymous — intentionally.** We prioritize simplicity and UX over complex cryptography. Relationship privacy without the overhead.

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
- **QR Code** (scannable, expandable, downloadable)

### Step 2: Share
Send the magic link to the receiver via any channel.
> Pro tip: Send link and secret through different channels for extra security

### Step 3: Claim
Receiver opens the link, enters the secret code, and claims the SOL.

### Step 4: Expiration (Optional)
If unclaimed, sender can manually refund after expiration (1 hour to 30 days).

---

## Features

### Core Features
- **Private Transfers** - No direct wallet-to-wallet link on-chain
- **Magic Links** - Share via URL or QR Code
- **Secret Codes** - Receiver proves knowledge to claim
- **Configurable Expiration** - 1 hour to 30 days
- **Manual Refund** - Sender can recover expired deposits on demand

### UX Features
- **Wallet Balance Display** - See your balance before sending
- **Balance Validation** - Prevents insufficient balance errors
- **Secret Strength Indicator** - Visual feedback (Weak/Medium/Strong)
- **QR Code Modal** - Enlarge and download as PNG
- **Optional Labels** - Name your transfers (stored locally)
- **Local History** - Track deposits and claims in browser
- **History Settings** - Toggle save history on/off, clear all
- **Explorer Links** - Quick access to Solana Explorer for each transaction

### Dashboard (My Transfers)
- **Deposits Tab** - View all deposits with status (Active/Expired/Claimed)
- **Claims Tab** - View received transfers with SOL amounts
- **Stats Overview** - Total, Active, Expired, Completed counts
- **SOL Tracking** - Total SOL locked and received
- **Refund Button** - One-click refund for expired deposits

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Smart Contract | Solana (Anchor Framework) |
| Frontend | Next.js + TypeScript |
| Styling | Tailwind CSS |
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
| `refund_expired` | deposit_id | Manual refund after expiration |

### Account Structure

```rust
pub struct PrivateDeposit {
    pub depositor: Pubkey,      // 32 bytes - Sender's wallet
    pub claim_hash: [u8; 32],   // SHA256 of secret code
    pub amount: u64,            // Amount in lamports
    pub claimed: bool,          // Claim/refund status
    pub bump: u8,               // PDA bump seed
    pub created_at: i64,        // Creation timestamp
    pub expires_at: i64,        // Expiration timestamp
}
```

### Error Codes

| Code | Name | Description |
|------|------|-------------|
| 6000 | AlreadyClaimed | Deposit was already claimed or refunded |
| 6001 | InvalidSecret | Secret code doesn't match claim_hash |
| 6002 | InvalidAmount | Amount is below minimum (0.001605 SOL) |
| 6003 | DepositExpired | Cannot claim after expiration |
| 6004 | NotExpiredYet | Cannot refund before expiration |
| 6005 | Unauthorized | Only depositor can refund |

---

## Privacy Model

PrivyLink provides **relationship privacy** through intermediary vaults:

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

> **Note:** Vault PDAs are derived from depositor + unique ID. They are not publicly indexable by sender-receiver relationship, as the receiver is never stored on-chain.

---

## Why PrivyLink?

| Feature | PrivyLink | ZK-based Solutions |
|---------|-----------|-------------------|
| Setup complexity | Simple | Complex ZK circuits |
| User experience | Magic links + QR | Wallet-to-wallet |
| Gas costs | Low (single tx) | High (ZK verification) |
| Privacy level | Relationship privacy | Full anonymity |
| Time to integrate | Minutes | Days/weeks |

**Our approach:** Hash-based verification with SHA-256. No complex ZK proofs, no trusted setup, no heavy cryptography. Simple, auditable, and effective for everyday private transfers.

> "Privacy doesn't have to be complicated."

---

## Roadmap

### Phase 1 - MVP (Complete)
- [x] Private deposits with secret codes
- [x] Magic links with QR codes
- [x] QR code download as PNG
- [x] Configurable expiration (1h to 30 days)
- [x] Manual refund for expired deposits
- [x] My Transfers dashboard (Deposits + Claims)
- [x] Wallet balance display and validation
- [x] Secret strength indicator
- [x] Optional labels for transfers
- [x] Local history with settings
- [x] Explorer links for all transactions
- [x] Devnet deployment

### Phase 2 - Enhanced Privacy (Planned)
- [ ] Arcium MPC integration
- [ ] Encrypted metadata
- [ ] Stealth addresses

### Phase 3 - Production
- [ ] Mainnet deployment
- [ ] Platform fee (0.25%)
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

### Test Flow

1. **Connect wallet** (Solflare or Phantom on Devnet)
2. **Create deposit** with 0.01 SOL, set expiration
3. **Copy magic link** or scan QR code
4. **Open in new tab/device**, connect different wallet
5. **Enter secret code** and claim
6. **Check My Transfers** - deposit shows as "Claimed"

---

## Project Structure

```
privylink/
├── app/                    # Next.js frontend
│   ├── components/         # React components
│   │   └── vault-card.tsx  # Main deposit/claim card
│   ├── deposits/           # My Transfers page
│   ├── generated/          # Codama-generated client
│   └── page.tsx            # Landing page
├── anchor/                 # Solana program
│   └── programs/vault/     # Anchor smart contract
│       └── src/lib.rs      # Contract logic
├── public/                 # Static assets
│   ├── logo-privylink.png  # Logo
│   ├── solflare.png        # Wallet icons
│   └── phantom.png
└── README.md
```

---

## Screenshots

### Create Deposit
- Amount input with wallet balance
- Secret code with strength indicator
- Expiration selector
- Optional label

### Success State
- QR Code (click to enlarge, download as PNG)
- Complete magic link
- Deposit details for manual sharing

### My Transfers
- Deposits tab with refund option
- Claims tab with SOL received
- Settings to manage local history

---

## Hackathon

**[Solana Privacy Hack 2026](https://solana.com/pt/privacyhack)** — $100,000+ Prize Pool

Competing for:
- **Private Payments Track** - $15,000
- **Helius Bounty** - $5,000 *(using Helius RPC)*

🔗 [solana.com/pt/privacyhack](https://solana.com/pt/privacyhack)

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
