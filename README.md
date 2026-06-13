# Bastion - AI Agent Firewall for Solana

[![npm](https://img.shields.io/npm/v/@bastion-agentique/sdk?label=sdk)](https://www.npmjs.com/package/@bastion-agentique/sdk)
[![npm](https://img.shields.io/npm/v/@bastion-agentique/web2-sdk?label=web2-sdk)](https://www.npmjs.com/package/@bastion-agentique/web2-sdk)

> Bastion is in alpha testing. Use with caution in production environments.

Bastion is a high-performance security middleware for autonomous AI agents on Solana. It acts as a deterministic barrier between an agent's non-deterministic logic and its wallet, ensuring that every transaction aligns with human-defined safety policies before being signed and broadcast to the network.

A Web2 API proxy firewall is in progress that extends Bastion's policy engine to HTTP API calls made by AI agents to providers like OpenAI, Stripe, Slack, and GitHub. See `@bastion-agentique/web2-sdk` and `docs/WEB2_EXPANSION_PLAN.md`.

## Table of Contents

- [Overview](#overview)
- [Problem](#problem)
- [Solution](#solution)
- [Features](#features)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [On-Chain Program](#on-chain-program)
- [Dashboard](#dashboard)
- [SDK](#sdk)
- [Tech Stack](#tech-stack)
- [Contributing](#contributing)
- [License](#license)

## Overview

Bastion is an upgraded fork of Sentinel (by ClawdieLabs), built for the Solana Frontier Hackathon Infrastructure track. Sentinel v1 was a proof-of-concept Rust proxy with basic policy parsing. Bastion upgrades it with **on-chain audit, agent identity registry, multi-agent support, and an enhanced policy engine**, transforming a local proxy into a verifiable, on-chain security layer for autonomous agents. It provides:

- Transaction validation and simulation
- Policy-based access control
- On-chain audit trail
- Agent identity registry
- Real-time dashboard

## Competitive Differentiation

**The Problem:** AI agents hold real money. One prompt injection = drained wallet. No audit trail = no accountability.

**Bastion's Unfair Advantage:** Only security tool with on-chain verifiable reputation + audit:

| Feature | Bastion | Sentinel v1 | AgentGuard | Agent Guardrails | Sigil |
|---------|---------|-------------|-----------|-------------------|------|
| On-chain audit | Yes (Anchor) | No | No | No | No |
| Agent reputation | Yes (on-chain) | No | No | No | No |
| Circuit breaker | Yes | No | No | No | Yes |
| Human override | Yes | No | Yes | Yes | No |
| Helius simulation | Yes | No | No | No | No |
| TypeScript SDK | Yes | No | Yes | No | No |
| Web2 API firewall | Yes (in progress) | No | No | No | No |
| Dashboard | Yes | No | No | No | No |

**Why this wins:**

1. **On-chain audit** = Judges can verify agent behavior on Solana Explorer
2. **Reputation** = First-of-its-kind on-chain agent identity
3. **Circuit breaker** = Pauses entire protocol in emergencies
4. **Demo-able** = Show it block a real drain attack, show on-chain record

Other solutions are TypeScript-only or off-chain. Bastion is the only one with **verifiable on-chain accountability** - which is what Solana judges care about.

## Problem

AI agents are powerful but unpredictable. They are susceptible to:

- **Prompt Injection**: Attackers trick agents into malicious transactions
- **Balance Drain**: Unchecked transfers drain wallets
- **Unauthorized Programs**: Malicious program calls
- **No Audit Trail**: No way to verify agent behavior

## Solution

Bastion intercepts transaction requests, simulates them via Helius Simulation API, and evaluates against a multi-stage policy engine.

## Features

| Feature | Description |
|---------|-------------|
| Policy Engine | Program whitelist, SOL caps, rate limits |
| Transaction Simulation | State change prediction via Helius |
| Human-in-the-Loop | Manual override for suspicious tx |
| Audit Logging | Sled DB for local audit records |
| On-Chain Audit | Anchor program for immutable records |
| Agent Registry | On-chain agent identity + reputation |
| Agent Delegation | Parent agents spawn sub-agents with delegated authority, capability inheritance, budget limits |
| MCP HTTP Server | 15 tools + 3 prompts via SSE, proxied at `/mcp/*` on fly.dev |
| x402 Payments | Pay-per-call pricing with Solana SOL transfers and free monthly tier |
| pay.sh Provider | One-command gateway: `pay --sandbox server start bastion-provider.yml` |
| CORS Support | Browser-native access via SSE with `Access-Control-Allow-Origin: *` |
| SOL Staking | AgentStake PDA — stake SOL for higher transaction limits via StakeWeighted policy |
| Emergency Pause | Circuit breaker for protocol |
| Web2 API Firewall | In progress. Proxy engine for API calls to OpenAI, Stripe, Slack, GitHub, and AWS. See `@bastion-agentique/web2-sdk` |

## Architecture

Bastion consists of nine main components:

1. **Transaction Firewall** — Solana + EVM transaction interception and simulation
2. **Simulation Core** — Helius API and Celo eth_call for outcome prediction
3. **Policy Engine** — Static allowlists, simulation checks, BlockInt security rules
4. **Web2 Proxy Firewall** — HTTP API gateway for AI agent calls to OpenAI, Stripe, Slack, GitHub, AWS
5. **MCP HTTP Server** — SSE transport proxied via sidecar, 15 security tools for AI agents
6. **Agent Registry** — W3C DID-based agent identity with hierarchical delegation
7. **x402 Payment Gateway** — Pay-per-call pricing with Solana SOL transfers
8. **GrondOSINT Oracle** — Address and API endpoint risk scoring via Daemon BlockInt
9. **On-Chain Audit Program** — Anchor program for immutable records on Solana

## Quick Start

### Prerequisites

- Rust (stable)
- Node.js 18+
- Helius API Key (for simulation)

### Build and Run

```bash
# Clone the repository
git clone https://github.com/bastion-agentique/bastion.git
cd bastion

# Build the middleware
cargo build --release

# Set Helius API key
export HELIUS_API_KEY="your-api-key"

# Run the server
cargo run --release

# Server starts at https://bastion-agentique.fly.dev/
# Dashboard at https://bastion-agentique.fly.dev//dashboard
```

### Run the Dashboard

```bash
pnpm --filter bastion-dashboard dev
# Dashboard opens at http://localhost:5173
```

### Run the MCP Server

MCP is now **bundled in Docker** and proxied through the sidecar at `/mcp/*`. No separate process needed in production.

```bash
# Production (via fly.dev proxy — bundled in Docker)
# SSE:   https://bastion-agentique.fly.dev/mcp/sse
# POST:  https://bastion-agentique.fly.dev/mcp/messages
# Health: https://bastion-agentique.fly.dev/mcp/health
# Pricing: https://bastion-agentique.fly.dev/mcp/pricing

# Local development (stdio transport — Claude Desktop / Cursor / Codex)
BASTION_SIDECAR_URL=http://localhost:3000 \
pnpm --filter @bastion/mcp-server dev

# Local development (SSE transport — browser agents)
BASTION_SIDECAR_URL=http://localhost:3000 \
pnpm --filter @bastion/mcp-server dev:http
```

### Run via pay.sh

```bash
pay --sandbox server start packages/mcp-server/bastion-provider.yml
# Gateway on http://127.0.0.1:1402
# pay --sandbox curl http://127.0.0.1:1402/v1/simulate -d '{...}'
```

### Use the SDK

```bash
cd packages/sdk
pnpm install
pnpm build
pnpm test
```

```typescript
import { BastionClient, AGENT_CAPABILITIES } from "@bastion-agentique/sdk";

const client = new BastionClient({
  connection: new Connection("https://api.devnet.solana.com")
});

// Register an agent
const tx = await client.registerAgent(
  wallet,
  "MyTradingBot",
  AGENT_CAPABILITIES.TRANSFER | AGENT_CAPABILITIES.SWAP
);
```

## Configuration

Create `config.toml` in the project root:

```toml
# Policy Settings
max_sol_per_tx = 1
max_balance_drain_lamports = 100000000  # 0.1 SOL
rate_limit_per_minute = 10
simulation_checks_enabled = true

# Allowed Programs (whitelist mode)
allowed_programs = [
    "11111111111111111111111111111111",  # System Program
    "TokenkegZwpDfbvXPB9SSct59MSBhGUMCfX2LzXBe",  # Token Program
    "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",  # Jupiter v6
]

# Blocked Addresses
blocked_addresses = []
```

## API Reference

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /simulate | Validate transaction |
| GET | /logs | Fetch audit logs |
| GET | /policy | Get policy settings |
| PUT | /policy | Update policy |
| POST | /override | Human override |
| GET | /health | Health check |

### POST /simulate

Validate a transaction before signing.

```bash
curl -X POST https://bastion-agentique.fly.dev//simulate \
  -H "Content-Type: application/json" \
  -d '{"transaction": "base64_encoded_tx", "intent": "Swap 1 SOL for USDC"}'
```

**Success Response (200)**:
```json
{
  "units_consumed": 150000,
  "balance_changes": {"wallet": -1000000000}
}
```

**Blocked Response (403)**:
```json
{
  "error": "Exceeds max SOL per transaction",
  "block_id": "uuid-for-override"
}
```

### GET /logs

Fetch audit history.

```bash
curl "https://bastion-agentique.fly.dev//logs?limit=10&offset=0"
```

### POST /override

Override a blocked transaction.

```bash
curl -X POST https://bastion-agentique.fly.dev//override \
  -H "Content-Type: application/json" \
  -d '{"block_id": "uuid", "action": "ALLOW"}'
```

## On-Chain Program

The Anchor program provides immutable audit records on Solana.

### Program ID

```
BaSZuLcwjfh75T3TjbVYpTH4qpJt1tNoZ3S6PTkvNhCb (deprecated) | **New:** `A29V5MUVs73y7XBHHxPpPcAW7h4gGHupbDdwYSwA2n9D` (devnet)
```

### Instructions

| Instruction | Description |
|-------------|-------------|
| initialize | Initialize audit state |
| log_audit | Record transaction audit |
| register_agent | Register agent on-chain |
| update_agent_reputation | Update agent reputation |
| set_policy | Set on-chain policy |
| emergency_pause | Pause protocol |
| emergency_resume | Resume protocol |

### Build and Deploy

```bash
cd programs/bastion-audit
anchor build
anchor deploy --provider.cluster devnet
```

## Dashboard

The dashboard provides real-time monitoring and policy management.

### Features

- Live transaction feed
- Pending approval queue
- Audit logs viewer
- Policy editor
- Emergency pause/resume
- Statistics (total/allowed/blocked)

### Run

```bash
pnpm --filter bastion-dashboard dev
# Dashboard opens at http://localhost:5173
```

## SDK

### @bastion-agentique/sdk — Solana + EVM Chain Firewall

TypeScript SDK for on-chain agent security. [npm → @bastion-agentique/sdk](https://www.npmjs.com/package/@bastion-agentique/sdk)

```bash
npm install @bastion-agentique/sdk
```

```typescript
import { BastionClient, BastionSidecar, AGENT_CAPABILITIES } from "@bastion-agentique/sdk";

// On-chain client
const client = new BastionClient({
  connection: new Connection("https://api.devnet.solana.com")
});
await client.registerAgent(wallet, "MyBot", AGENT_CAPABILITIES.TRANSFER);

// Sidecar HTTP client
const sidecar = new BastionSidecar({ baseUrl: "https://bastion-agentique.fly.dev" });
const result = await sidecar.simulate({ transaction: base64Tx, intent: "Swap 1 SOL" });

// EVM simulation
const evmResult = await sidecar.simulateEvm({
  transaction: { from: "0x...", to: "0x..." },
  chain: "celo"
});

// Real-time audit events
const stream = sidecar.events();
for await (const event of stream) {
  console.log(event.type, event.data);
}
```

## Web2 SDK (In Progress)

> **IN PROGRESS — Not production-ready.**

TypeScript SDK for AI agent API call security. Proxy engine inspects every HTTP call before reaching providers.

[npm → @bastion-agentique/web2-sdk](https://www.npmjs.com/package/@bastion-agentique/web2-sdk)

```bash
npm install @bastion-agentique/web2-sdk
```

```typescript
import { BastionWeb2Client } from "@bastion-agentique/web2-sdk";

const client = new BastionWeb2Client({ proxyUrl: "http://localhost:4000" });

const req = client.buildRequest("POST", "https://api.openai.com/v1/chat/completions", {
  "Content-Type": "application/json"
}, JSON.stringify({ model: "gpt-4o", messages: [] }));

const result = await client.evaluate(req);
// result.decision: "pass" | "block" | "pending_hitl"
```

See [`docs/WEB2_EXPANSION_PLAN.md`](docs/WEB2_EXPANSION_PLAN.md) for the full roadmap.

## EVM (Ethereum/Celo/Polygon/Base)

> **UNDER ACTIVE DEVELOPMENT — Not production-ready.**

Solidity contracts in `evm/src/` implementing the Bastion security stack for EVM chains:

| Contract | Purpose |
|----------|---------|
| `BastionFirewall.sol` | ERC-7579 validator module — gates UserOperations |
| `BastionPolicy.sol` | Per-agent policy rules (allowlists, limits, cooldowns) |
| `BastionAudit.sol` | EIP-712 signed immutable audit trail |
| `BastionRegistry.sol` | Agent + target address directory |
| `BastionERC8004Registry.sol` | ERC-8004 agent identity (ERC-721 + EIP-712) |
| `BastionSidecar.sol` | Oracle request/fulfill pattern for off-chain simulation |

```bash
cd evm
forge build          # compile
forge test -vvv      # run tests
forge fmt            # format
```

See [`evm/README.md`](evm/README.md) for deployment details.

## Tech Stack

| Component | Technology |
|-----------|-------------|
| Middleware | Rust, Axum, Tokio |
| Simulation | Helius API, Celo eth_call |
| Database | Sled |
| On-Chain (Solana) | Anchor, solana-program |
| On-Chain (EVM) | Solidity 0.8.28, Foundry, OpenZeppelin, Solady |
| Confidentiality Engine | Arcium MXEs, Arcis (Rust MPC circuits) |
| Web2 Firewall | Rust (bastion-web2-firewall), OpenAPI parser |
| MCP Server | TypeScript, @modelcontextprotocol/sdk, SSE |
| Payments | x402 (Solana), pay.sh |
| SDK | TypeScript (@bastion-agentique/sdk) |
| Web2 SDK | TypeScript (@bastion-agentique/web2-sdk) |
| Dashboard | React, Vite, TailwindCSS |
| Agent Skills | 48 blockint/Web2 skills (.agents/skills/) |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Acknowledgments

- **Daemon Blockint Technologies** ([github.com/daemon-blockint-tech/daemon](https://github.com/daemon-blockint-tech/daemon)) — Powers Bastion's entire intelligence layer. GrondOSINT provides the threat oracle, the Blockint rules engine detects flash loans, high slippage, authority changes, and risk labeled addresses, and the 48 agent skills ecosystem covers blockchain forensics, compliance workflows, and DeFi security auditing. Thank you to the Daemon team for the intelligence pipeline that makes Bastion possible.

## License

Apache-2.0 License - See LICENSE file for details.

---

Built for the Solana Frontier Hackathon by Bastion Agentique.