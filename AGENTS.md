# AGENTS.md — Bastion

> **Trust your Agent, but Verify every Transaction.**
>
> Bastion is a multichain AI agent firewall — security middleware that intercepts, simulates, and validates blockchain transactions from autonomous AI agents before they reach the network.
>
> **If you are an AI coding agent reading this:** see [`SKILL.md`](SKILL.md) for self-registration and integration instructions. You can register yourself with a running Bastion instance via `POST /agents` to receive a W3C DID, trackable identity, and delegation capabilities.
>
> **Alpha software.** Bastion is in active development and not yet production hardened. Use with caution.

---

## 1. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Rust Sidecar** | Rust (edition 2024), Axum 0.8, Tokio 1, Sled 0.34 | 1.85+ |
| **Rust Core** | serde, thiserror, uuid, async-trait | 0.1.0 |
| **Rust Web2 Firewall** | bastion-web2-firewall, http, url, reqwest | 0.1.0 |
| **Rust Correlation** | bastion-correlation (SIEM correlation engine) | — |
| **Solana On-Chain** | Anchor 0.30.1, solana-program 1.18, borsh 1 | 0.2.0 |
| **EVM Contracts** | Solidity 0.8.28, Foundry, OpenZeppelin, Solady | — |
| **Dashboard** | React 18, Vite 5, TailwindCSS 3.4, TypeScript 5 | 0.2.0 |
| **SDK** | TypeScript 5, Anchor 0.30.1, @solana/web3.js 1.91 | 0.5.1 |
| **Web2 SDK** | TypeScript 5, BastionWeb2Client | 0.1.0 |
| **EVM Wallet** | wagmi 2.12, viem 2.21, RainbowKit 2.2, TanStack Query 5 | — |
| **Solana Wallet** | wallet-adapter-react, wallet-adapter-solflare/phantom/backpack | — |
| **Midnight ZK** | Compact lang, @midnight-ntwrk/midnight-js | 0.1.0 |
| **Package Manager** | pnpm 9+ (workspaces) | — |
| **CI/CD** | GitHub Actions, Netlify, Vercel | — |

---

## 2. Project Structure

```
bastion/
├── apps/web/                  ← React dashboard (Vite + TailwindCSS)
│   ├── src/
│   │   ├── pages/             ← Landing, Dashboard, Integrate
│   │   ├── hooks/             ← useBastionProgram, useBastionEVM
│   │   ├── components/        ← Navbar, VideoBackground, EvmProviderErrorBoundary
│   │   ├── context/           ← ThemeContext, ChainContext
│   │   ├── abi/               ← EVM contract ABIs (JSON, on main branch)
│   │   └── idl.json           ← Solana Anchor IDL
│   └── dist/                  ← Built output (Netlify/Vercel publish dir)
├── packages/sdk/              ← @bastion-agentique/sdk (TypeScript)
│   └── src/
│       ├── index.ts           ← BastionClient class
│       ├── types.ts           ← AuditState, AuditEntry, Agent, Policy types
│       └── idl.json           ← Anchor IDL
├── crates/                    ← Rust workspace
│   ├── core/                  ← Chain-agnostic policy engine (bastion-core)
│   ├── sidecar/               ← HTTP evaluator server (Axum, bastion-sidecar)
│   ├── web2-firewall/         ← Web2 API proxy firewall (bastion-web2-firewall) NEW
│   ├── correlation/           ← SIEM correlation engine (bastion-correlation)
│   └── solana/programs/       ← Anchor on-chain program (bastion-audit)
├── evm/                       ← Solidity contracts (Foundry)
│   ├── src/                   ← BastionFirewall, BastionPolicy, BastionAudit,
│   │                             BastionRegistry, BastionERC8004Registry, BastionSidecar
│   ├── test/                  ← 4 Foundry test files (~54 tests)
│   ├── script/                ← DeployBastion.s.sol
│   └── lib/                   ← forge-std, openzeppelin-contracts, solady (submodules)
├── midnight/                  ← Midnight ZK contracts + SDK
├── docs/                      ← Architecture, contributing, deployment plans
├── netlify/                   ← Netlify edge functions
├── config.toml                ← Sidecar policy config
├── docker-compose.yml         ← Docker compose for sidecar
├── Dockerfile                 ← Sidecar Docker image
├── netlify.toml               ← Netlify deploy config (root)
├── pnpm-workspace.yaml        ← pnpm workspace definition
├── Cargo.toml                 ← Rust workspace manifest
└── .github/workflows/ci.yml   ← GitHub Actions CI
```

---

## 3. Getting Started

### Prerequisites

- **Node.js** >= 20
- **pnpm** >= 9 (`corepack enable && corepack prepare pnpm@latest --activate`)
- **Rust** >= 1.85 (`rustup`)
- **Foundry** (`foundryup`, for EVM contracts)
- **Solana CLI** 1.18.x (`solana --version`)
- **Anchor CLI** 0.30.1 (`avm install 0.30.1 && avm use 0.30.1`)

### Quick Setup

```bash
git clone --recurse-submodules https://github.com/bastion-agentique/bastion.git
cd bastion

# Install JS dependencies
pnpm install

# Build all JS packages
pnpm build

# Build Rust
cargo build

# Build EVM contracts
cd evm && forge build
```

### Environment Variables

Create `evm/.env`:
```
PRIVATE_KEY=
CELO_RPC_URL=https://forno.celo.org
CELO_TESTNET_RPC_URL=https://alfajores-forno.celo-testnet.org
BASE_RPC_URL=https://mainnet.base.org
ETH_RPC_URL=https://eth.llamarpc.com
POLYGON_RPC_URL=https://polygon-rpc.com
```

For the sidecar, `HELIUS_API_KEY` is required. Set via `config.toml` or environment.

---

## 4. Build Commands

| Scope | Command | Notes |
|-------|---------|-------|
| **All JS** | `pnpm build` | Recursive across workspaces |
| **Dashboard** | `pnpm --filter bastion-dashboard build` | Vite production build → `apps/web/dist/` |
| **Dashboard dev** | `pnpm --filter bastion-dashboard dev` | Vite dev server on port 3000 |
| **SDK** | `pnpm --filter @bastion-agentique/sdk build` | `tsc` → `packages/sdk/dist/` |
| **All Rust** | `cargo build` | From workspace root |
| **Rust release** | `cargo build --release` | Optimized binary in `target/release/` |
| **Rust check** | `cargo check` | Fast type-check only |
| **EVM contracts** | `cd evm && forge build` | Foundry compile → `evm/out/` |
| **Solana Anchor** | `cd crates/solana && anchor build` | Build BPF bytecode |
| **Docker** | `docker build -t bastion-sidecar .` | Sidecar container |

---

## 5. Test Commands

| Scope | Command | Notes |
|-------|---------|-------|
| **All Rust** | `cargo test` | Workspace-level |
| **Core crate** | `cargo test -p bastion-core` | Unit tests |
| **Sidecar** | `cargo test -p bastion-sidecar` | Integration tests |
| **Solana program** | `cargo test -p bastion-audit --features devnet` | On-chain tests |
| **EVM contracts** | `cd evm && forge test -vvv` | ~54 Foundry tests |
| **EVM gas report** | `cd evm && forge test --gas-report` | Gas usage analysis |
| **Solana Anchor** | `cd crates/solana && anchor test` | Needs local validator |

> Dashboard and SDK have no test suites yet.

---

## 6. Lint & Format Commands

| Scope | Command | Notes |
|-------|---------|-------|
| **Rust format** | `cargo fmt --all -- --check` | CI check mode |
| **Rust format fix** | `cargo fmt` | Auto-fix |
| **Rust clippy** | `cargo clippy -- -D warnings` | All crates |
| **Per-crate clippy** | `cargo clippy -p bastion-core -- -D warnings` | Single crate |
| **EVM format** | `cd evm && forge fmt --check` | CI check mode |
| **EVM format fix** | `cd evm && forge fmt` | Auto-fix |

> No TS/JS linting is configured yet. Run `pnpm lint` is defined at root but not per-package.

---

## 7. Architecture

```
Agent Operator (policy config, HITL review)
       │
       ▼
┌──────────────────────────────────────────────────────────────────┐
│                         Bastion Monorepo                         │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐ │
│  │ crates/core  │   │   SDK + CLI  │   │  Dashboard (React)   │ │
│  │ (chain-agn.) │   │  (TypeScript)│   │  (apps/web)           │ │
│  └──────┬───────┘   └──────────────┘   └──────────────────────┘ │
│         │                                                        │
│    ┌────┴─────────────────────────────┐                          │
│    ▼                                  ▼                          │
│  ┌──────────────┐               ┌───────────────────┐           │
│  │crates/sidecar│               │crates/web2-firewall│  ← NEW  │
│  │(Solana/chain)│               │(Web2 proxy engine) │          │
│  └──────┬───────┘               └───────────────────┘           │
│         │                                                        │
│    ┌────┴──────────────────────────┐                             │
│    ▼                               ▼                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                       │
│  │ Solana   │  │   EVM    │  │ Midnight │                       │
│  │ (Anchor) │  │(Solidity)│  │ (Compact)│                       │
│  └──────────┘  └──────────┘  └──────────┘                       │
└──────────────────────────────────────────────────────────────────┘
```

### How components relate

1. **`crates/core`** — Chain-agnostic policy engine. Defines `NormalizedTransaction`, `FirewallDecision` (Pass/Block/PendingHITL), `PolicyEvaluator<O: RiskOracle>`, `PolicyRule`, `PolicySet`, `AuditRecord`, and `RiskOracle` trait.

2. **`crates/sidecar`** — Axum HTTP server (port 3000) that runs the policy evaluator. Exposes REST API for simulation, audit logging, policy management, circuit breaker, and human override. Uses Helius API for Solana simulation, Sled DB for audit logs, GrondOSINT for risk oracle.

3. **`crates/solana/programs/bastion-audit`** — Anchor program deployed on Solana devnet. Program ID: `A29V5MUVs73y7XBHHxPpPcAW7h4gGHupbDdwYSwA2n9D`. Instructions: `initialize`, `logAudit`, `registerAgent`, `updateAgentReputation`, `setPolicy`, `emergencyPause`, `emergencyResume`.

4. **`evm/`** — 6 Solidity contracts implementing ERC-7579 validator module, policy engine, immutable EIP-712 audit trail, agent registry, ERC-8004 identity, and sidecar oracle.

5. **`apps/web/`** — React dashboard with Solana (wallet-adapter) and EVM (RainbowKit) wallet connections. Shows audit logs, policy settings, stats. Supports chain switching between Solana and Celo.

6. **`packages/sdk/`** — TypeScript SDK (`@bastion-agentique/sdk`) wrapping the Solana Anchor program. Exposes `BastionClient` with typed methods for all on-chain operations.

---

## 8. Key Code Paths

### Rust Sidecar

- **Entry:** `crates/sidecar/src/main.rs` — binds `0.0.0.0:3000`
- **Routes:** `crates/sidecar/src/lib.rs` — all HTTP handlers
- **Policy engine:** `crates/core/` — chain-agnostic evaluation logic
- **Simulation:** `crates/sidecar/src/simulation.rs` — Helius API integration
- **Audit DB:** `crates/sidecar/src/audit.rs` — Sled-based log store
- **Risk oracle:** `crates/sidecar/src/grond_oracle.rs` — GrondOSINT integration
- **On-chain client:** `crates/sidecar/src/program_client.rs` — Anchor program RPC

### Solana On-Chain

- **Program:** `crates/solana/programs/bastion-audit/src/lib.rs`
- **IDL:** `crates/solana/programs/bastion-audit/idl/bastion_audit.json`
- **Config:** `crates/solana/Anchor.toml`

### EVM Contracts

- **Firewall:** `evm/src/BastionFirewall.sol` — ERC-7579 validator, gates UserOperations
- **Policy:** `evm/src/BastionPolicy.sol` — Per-agent rules (allowlists, limits, cooldowns)
- **Audit:** `evm/src/BastionAudit.sol` — EIP-712 signed audit entries
- **Registry:** `evm/src/BastionRegistry.sol` — Agent + target directory
- **ERC-8004:** `evm/src/BastionERC8004Registry.sol` — Agent identity (ERC-721 + EIP-712)
- **Sidecar:** `evm/src/BastionSidecar.sol` — Oracle request/fulfill pattern
- **Deploy:** `evm/script/DeployBastion.s.sol`

### Web Dashboard

- **Entry:** `apps/web/src/main.tsx`
- **App shell:** `apps/web/src/App.tsx` — providers, wallet setup, routing
- **Pages:** `apps/web/src/pages/Landing.tsx`, `Dashboard.tsx`, `integrate/Integrate.tsx`
- **Solana hooks:** `apps/web/src/hooks/useBastionProgram.ts`
- **EVM hooks:** `apps/web/src/hooks/useBastionEVM.ts` (currently stubs)
- **Chain context:** `apps/web/src/context/ChainContext.tsx` — Solana/Celo switching
- **Theme:** `apps/web/src/context/ThemeContext.tsx`

### TypeScript SDK

- **Entry:** `packages/sdk/src/index.ts` — `BastionClient` class
- **Types:** `packages/sdk/src/types.ts`
- **IDL:** `packages/sdk/src/idl.json`

---

## 9. Environment Variables

### Sidecar

| Variable | Default | Purpose |
|----------|---------|---------|
| `HELIUS_API_KEY` | *required* | Helius simulation API key |
| `BASTION_ON_CHAIN` | (unset) | Enable on-chain audit logging |
| `SOLANA_RPC_URL` | `https://api.devnet.solana.com` | Solana RPC endpoint |
| `BASTION_KEYPAIR_PATH` | *required if ON_CHAIN* | Path to signer keypair JSON |
| `GROND_API_URL` | (unset) | GrondOSINT base URL |

### EVM / Foundry (in `evm/.env`)

| Variable | Example | Purpose |
|----------|---------|---------|
| `PRIVATE_KEY` | `0x...` | Deployer private key |
| `CELO_RPC_URL` | `https://forno.celo.org` | Celo mainnet RPC |
| `CELO_TESTNET_RPC_URL` | `https://alfajores-forno.celo-testnet.org` | Celo Alfajores RPC |
| `BASE_RPC_URL` | `https://mainnet.base.org` | Base mainnet RPC |
| `ETH_RPC_URL` | `https://eth.llamarpc.com` | Ethereum mainnet RPC |
| `POLYGON_RPC_URL` | `https://polygon-rpc.com` | Polygon mainnet RPC |

### Dashboard

| Variable | Purpose |
|----------|---------|
| `VITE_BASTION_AUDIT_ADDRESS` | EVM audit contract address |
| `VITE_BASTION_POLICY_ADDRESS` | EVM policy contract address |
| `VITE_BASTION_FIREWALL_ADDRESS` | EVM firewall contract address |
| `VITE_BASTION_REGISTRY_ADDRESS` | EVM registry contract address |
| `VITE_BASTION_ERC8004_ADDRESS` | EVM ERC-8004 contract address |

---

## 10. Deploying

### Netlify (primary)

Root `netlify.toml` is configured. Pushes to `main` auto-deploy.
```bash
# Manual: netlify deploy --prod --dir=apps/web/dist
```

### Vercel

Project: `muhammad-zidan-fatonies-projects/bastion-web`. Deploys from `main` branch.
```bash
# Manual (from apps/web/):
vercel --prod
```

### Docker (sidecar)

```bash
docker build -t bastion-sidecar .
docker run -p 3000:3000 -e HELIUS_API_KEY=... bastion-sidecar
# Or: docker compose up
```

### EVM Contracts (Foundry)

`evm/script/DeployBastion.s.sol` deploys all contracts in order.
```bash
# Celo mainnet
cd evm
source .env
forge script script/DeployBastion.s.sol --rpc-url celo --broadcast --verify

# Polygons/Base: adjust --rpc-url
```

### Solana Anchor

```bash
cd crates/solana
anchor build
anchor deploy --provider.cluster devnet
```

---

## 11. CI/CD (GitHub Actions)

**File:** `.github/workflows/ci.yml`

Triggers on push/PR to `main` (ignoring `.md` and `docs/`).

| Job | What it does |
|-----|-------------|
| `core` | cargo check, clippy, test for `bastion-core` |
| `sidecar` | cargo check, clippy, test for `bastion-sidecar` |
| `solana` | Install Solana CLI 1.18.26 + Anchor 0.30.1, cargo check, test |
| `fmt` | `cargo fmt --all -- --check` |
| `evm` | Checkout submodules, `forge build`, `forge test -vvv` |
| `web` | `pnpm install`, `pnpm --filter bastion-dashboard build` |
| `sdk` | `pnpm install`, `pnpm --filter @bastion-agentique/sdk build` |

---

## 12. Known Gotchas

### `tuple()` ABI format breaks abitype

**Problem:** Human-readable ABIs using `tuple(type name, ...)` syntax crash with `InvalidParameterError` from `abitype@1.2.3`.

**Fix:** Use `(type name, ...)` without the `tuple` prefix. Example:
```
// BROKEN:
'function getEntry(uint256 id) returns (tuple(address agent, string reason))'

// FIXED:
'function getEntry(uint256 id) returns ((address agent, string reason))'
```

### Don't use `@solana/wallet-adapter-wallets` — use individual adapters

The monolithic `@solana/wallet-adapter-wallets` package pulls in ~40+ adapters including `@coinbase/wallet-sdk` which breaks the Vite build with buffer polyfill issues. Use individual adapter packages instead:

```typescript
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { BackpackWalletAdapter } from '@solana/wallet-adapter-backpack';
```

### `buffer/` alias is fragile

`vite.config.ts` aliases `buffer` → `buffer/`. This is needed for EVM wallet dependencies. If the build fails with `Could not load buffer/`, ensure `buffer` is in `apps/web/package.json` dependencies and pnpm's node_modules are intact.

### Solana program must be deployed before Dashboard works

The Dashboard fetches from the on-chain program at `A29V5MUVs73y7XBHHxPpPcAW7h4gGHupbDdwYSwA2n9D` (devnet). If not deployed, Anchor will fail to fetch accounts. The try-catch in `useBastionProgram.ts` handles this gracefully but will show empty data.

### EVM dashboard hooks are stubs

`apps/web/src/hooks/useBastionEVM.ts` currently returns null/empty for all functions. EVM contract interaction via the dashboard is not yet implemented. The ABIs are defined but the hooks need to be wired up to `useReadContract` / `useWriteContract`.

### Solana wallet adapters need explicit config

Only wallets listed in `App.tsx`'s `solanaWallets` array are available. Currently: Phantom, Solflare, Backpack. To add more adapters, install the individual adapter package and add it to the array.

### Anchor version must match CLI

Both the Anchor JS client (`@coral-xyz/anchor@^0.30.1`) and Anchor CLI (`anchor 0.30.1`) must match. Mismatched versions cause IDL deserialization and BN (`_bn`) errors.

### Forge submodules required

EVM contracts depend on git submodules (`forge-std`, `openzeppelin-contracts`, `solady`). Always clone with `--recurse-submodules` or run `git submodule update --init --recursive`.

### `pnpm build` may fail on workspace lifecycle

If `pnpm build` fails with `pnpm install` errors, run `pnpm install` separately first, then build individual packages directly:
```bash
pnpm --filter bastion-dashboard build
```

---

## 13. Development Workflow

### Branch Strategy

- **`main`** — production branch, deploys to Netlify/Vercel. All merges must pass CI.
- **`run`** — development/experimental branch.

### Pre-commit Checklist

Before committing, run:

```bash
# Rust
cargo fmt --all -- --check
cargo clippy -- -D warnings
cargo test

# EVM
cd evm && forge build && forge test -vvv && forge fmt --check

# Dashboard
pnpm --filter bastion-dashboard build

# SDK
pnpm --filter @bastion-agentique/sdk build
```

### PR Process

1. Create feature branch from `main` (or `run`)
2. Implement changes
3. Run pre-commit checks above
4. Push and create PR
5. CI must pass all 7 jobs
6. Merge to `main` via squash or rebase

### After merging to main

- Netlify auto-deploys from `main`
- Vercel auto-deploys from `main` (project: `bastion-web`)
- If EVM contracts changed: re-deploy via `forge script`
- If Solana program changed: re-deploy via `anchor deploy`

---

## 14. Browser / Wallet Compatibility

The dashboard supports:

- **Solana:** Phantom, Solflare, Backpack wallets (via `@solana/wallet-adapter`). Connected through devnet by default.
- **EVM (Celo):** MetaMask, WalletConnect (via RainbowKit/wagmi). Custom Celo chain config at `apps/web/src/App.tsx:26-37`.

Chain switching is handled by `ChainContext` — toggles between Solana and Celo providers.

---

## 15. License & Security

- **License:** Apache-2.0
- **Security policy:** `SECURITY.md`
- **Protocols:** ERC-7579 (validator module), ERC-4337 (account abstraction), ERC-8004 (agent identity), EIP-712 (typed structured data)
