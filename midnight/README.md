# Midnight Bastion

**ZK-privacy security middleware for autonomous AI agents on Midnight Network.**

Midnight Bastion enforces transaction policies and maintains a verifiable audit trail for AI agents — without leaking agent identity, strategy, or transaction details on-chain.

Built with [Compact](https://docs.midnight.network/compact), Midnight's zero-knowledge smart contract language.

---

## The Problem

AI agents execute high-value on-chain transactions autonomously. Operators need:

1. **Security** — every agent action must be auditable and policy-gated
2. **Privacy** — agent strategies, transaction volumes, and identities must stay confidential

Public blockchains solve (1) but destroy (2). Midnight solves both simultaneously.

---

## How It Works

```
Agent ──request──> Bastion Middleware
                         │
                   Policy Check + ZK Proof
                         │
                  Midnight Network
                ┌────────┼────────┐
                │        │        │
           Registry  Policy   Audit
```

The Rust middleware intercepts agent transactions, checks them against committed policies, generates ZK proofs of compliance, and submits tamper-proof audit commitments to Midnight — all without exposing the underlying data.

---

## Privacy Model

| Data | Visibility |
|------|-----------|
| Agent registration | Commitment only (ZK-private) |
| Policy rules | Never on-chain (committed hash only) |
| Transaction target | ZK-private |
| Transaction value | ZK-private |
| Audit entry | Commitment only (selectively disclosable) |
| Allow/block decision | Public |

---

## Repository Structure

```
midnight-bastion/
├── contract/              # Compact smart contracts
│   ├── registry.compact   # Agent/target directory
│   ├── policy.compact     # Policy engine
│   └── audit.compact      # ZK-private audit trail
├── sdk/                   # TypeScript SDK (@midnight-bastion/sdk)
├── middleware/             # Rust Axum enforcement server
├── dashboard/              # React + Vite dashboard
└── tests/                 # Integration tests
```

---

## Stack

| Layer | Technology |
|-------|-----------|
| ZK contracts | Compact (Midnight) |
| SDK | TypeScript, `@midnight-ntwrk/midnight-js` |
| Middleware | Rust, Axum |
| Dashboard | React, Vite, Tailwind CSS |
| Wallet | Lace |

---

## Getting Started

### Prerequisites

- Node.js v22+
- Rust (stable)
- Docker (for local Midnight devnet)
- Midnight toolchain — see [docs.midnight.network/getting-started/installation](https://docs.midnight.network/getting-started/installation)

### Install Midnight Toolchain

```bash
# Install Lace wallet and compact compiler per Midnight docs
# https://docs.midnight.network/getting-started/installation
```

### Clone and Install

```bash
git clone https://github.com/bastion-defend/midnight-bastion.git
cd midnight-bastion
```

### Compile Contracts

```bash
cd contract
compact compile registry.compact managed/registry
compact compile policy.compact managed/policy
compact compile audit.compact managed/audit
```

### Run Local Devnet

```bash
yarn env:up
```

### Run Middleware

```bash
cd middleware
cargo run
```

### Run Dashboard

```bash
cd dashboard
npm install
npm run dev
```

---

## Related

- [Bastion (Solana)](https://github.com/bastion-defend/bastion)
- [Bastion EVM](https://github.com/bastion-defend/bastion-evm)
- [Midnight Docs](https://docs.midnight.network)
- [Midnight Build Club](https://midnight.network/build-club)

---

## License

MIT
