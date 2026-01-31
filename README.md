# PrivyLink

**Private SOL transfers via Magic Links on Solana**

🌐 Live Demo: https://privylink.vercel.app
📜 Program ID (Devnet): https://explorer.solana.com/address/98WwJxc1aAeqGWuaouQntJYmdQEnELntf9BqKXD3o34W?cluster=devnet

Built for **Solana Privacy Hack 2026**

---

## Overview

PrivyLink enables **private SOL transfers** without creating a direct on-chain link between sender and receiver.

Instead of sending funds wallet-to-wallet, users deposit SOL into a **temporary vault (PDA)** and share a **magic link + secret code**.
The receiver claims funds by proving knowledge of the secret — preserving **relationship privacy** on-chain.

> Not ZK. Not fully anonymous — intentionally.
> PrivyLink prioritizes **simplicity, UX, and practical privacy** over complex cryptography.

---

## TL;DR (60 seconds)

- Send SOL → get a magic link + secret code
- Share link + secret with receiver
- Receiver claims by proving knowledge of secret
- No sender ↔ receiver link on-chain
- Manual refund available if deposit expires unclaimed

---

## How It Works

Sender ──▶ Vault PDA ──▶ Receiver


1. **Create Deposit**
   Sender deposits SOL and receives:
   - Magic Link (URL)
   - Secret Code
   - QR Code (expandable & downloadable)

2. **Share**
   Send link and secret to the receiver
   *(Tip: use different channels for extra security)*

3. **Claim**
   Receiver opens the link, enters the secret, and claims the SOL

4. **Expiration (Optional)**
   If unclaimed, sender can manually refund after expiration (1h–30d)

---

## Screenshots

### Landing Page (Desktop)
![Landing Hero](public/screenshots/hero-desktop.png)

### Create Deposit (Desktop)
![Send Form](public/screenshots/send-form-desktop.png)

### Deposit Success (Desktop)
![Send Success](public/screenshots/send-success-desktop.png)

### Claim Transfer (Desktop)
![Claim Desktop](public/screenshots/claim-desktop.png)

### Dashboard — My Transfers
![Dashboard](public/screenshots/dashboard-desktop.png)

### Mobile Screenshots

<table>
  <tr>
    <td align="center">
      <strong>Claim Transfer</strong><br/>
      <img src="public/screenshots/claim-mobile.png" width="250" alt="Claim Mobile"/>
    </td>
    <td align="center">
      <strong>Create Deposit</strong><br/>
      <img src="public/screenshots/send-mobile.png" width="250" alt="Send Mobile"/>
    </td>
  </tr>
</table>

---

## Features

### Core
- Private transfers (no wallet-to-wallet link)
- Magic links (URL + QR code)
- Secret-based claims (SHA-256 hash verification)
- Configurable expiration (1h to 30 days)
- Manual refund for expired deposits

### UX & Mobile
- Wallet balance display and validation
- Secret strength indicator
- QR code enlarge & download
- Local transfer history (browser only)
- Explorer links for every transaction
- Loading overlay during transactions
- Mobile deep links (Phantom & Solflare in-app browser)
- Web Share API for QR codes on mobile
- Clear error messages (wrong network, low balance, expired deposit)

### Dashboard (My Transfers)
- Deposits & Claims tabs
- Status tracking (Active / Expired / Claimed)
- SOL totals (locked & received)
- One-click refund for expired deposits

---

## Privacy Model

PrivyLink provides **relationship privacy** using intermediary vaults:

- Sender deposits into a PDA (not receiver wallet)
- Receiver claims by proving secret knowledge
- No direct sender ↔ receiver transaction on-chain

**Private**
- Sender–receiver relationship
- Receiver identity (from sender's on-chain view)

**Public**
- Deposit amount
- Vault address
- Claim transaction

Vault PDAs are derived from depositor + unique ID.
Receiver data is **never stored on-chain**.

---

## Why PrivyLink?

| Feature | PrivyLink | ZK-based Solutions |
|------|---------|------------------|
| Setup | Simple | Complex |
| UX | Magic links + QR | Wallet-to-wallet |
| Gas | Low (single tx) | High |
| Privacy | Relationship privacy | Full anonymity |
| Time to build | Minutes | Days/weeks |

**Our approach:** hash-based verification with SHA-256.
No ZK circuits, no trusted setup, no heavy cryptography.

> *Privacy doesn't have to be complicated.*

---

## Tech Stack

- **Smart Contract:** Solana (Anchor)
- **Frontend:** Next.js + TypeScript
- **Styling:** Tailwind CSS
- **RPC:** Helius
- **Deployment:** Vercel
- **Network:** Devnet

---

## Roadmap

### Phase 1 — MVP (Complete)
- Private deposits & secret claims
- Magic links + QR codes
- Manual refunds
- Dashboard (Deposits & Claims)
- Mobile deep links & QR sharing
- Balance checks & clear errors
- Devnet deployment

### Phase 2 — Enhanced Privacy
- Arcium MPC
- Encrypted metadata
- Stealth addresses

### Phase 3 — Production
- Mainnet
- Platform fee (0.25%)
- SPL token support
- Batch transfers
- Mobile app

---

## Hackathon

**Solana Privacy Hack 2026**
https://solana.com/pt/privacyhack

Competing for:
- Private Payments Track — $15,000
- Helius Bounty — $5,000

---

## Authors

- **Renner Oliveira**
  GitHub: https://github.com/renner16
  X: https://x.com/_renner_araujo

- **Giovana Marques**

---

## License

MIT License — see `LICENSE` file for details.

> Privacy is not a luxury. It's a fundamental right.
