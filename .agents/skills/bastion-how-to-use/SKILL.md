---
name: bastion-how-to-use
description: Guides agent developers on integrating Bastion (AI Agent Firewall for Solana). Covers SDK usage (BastionClient), REST API endpoints (/simulate, /policy, /override, /logs), interpreting audit logs and simulation results, configuring policy rules (allowlists, SOL caps, rate limits, blockint security checks), on-chain program interaction (audit trail, agent registry, circuit breaker), and deployment. Use when the user asks about integrating an AI agent with Bastion, sending transactions through the firewall, configuring security policies, reading audit trails, or deploying the Bastion middleware alongside autonomous agents on Solana.
---

# Bastion — How to Use (Agent Developer Guide)

Bastion is a Rust middleware (Axum) + Anchor on-chain program that sits between an AI agent and Solana. Every transaction the agent wants to sign passes through Bastion first: simulate, policy-check, optionally log on-chain, then either sign or block.

This skill covers what an agent developer needs to integrate with Bastion.

## Architecture Overview

```
Agent → Bastion REST API → Policy Engine → Helius Simulation → On-chain Audit → Sign or Block
         ↑───────────────────────────────────────────────────────────────┘ (async)
```

Bastion runs as a local HTTP server (default `https://bastion-agentique.fly.dev/`). Agents send transaction payloads to `/simulate` and receive a decision (ALLOW, BLOCK, or PENDING_APPROVAL).

## Quick Start: Agent Integration Flow

1. Start Bastion server (see README)
2. **Register your agent identity** via `POST /agents` (NEW in v0.3.0)
3. Configure policy (whitelist programs, set SOL caps, enable blockint checks)
4. Send transactions to `POST /simulate` before signing
5. If allowed, sign and send the transaction
6. If blocked, request human override via `POST /override`
7. Monitor audit logs via `GET /logs`

## Agent Identity & Self-Registration (v0.3.0)

**Every AI agent MUST register with Bastion before sending transactions.** Registration gives you a W3C DID, tracks your audit trail, and enables delegation of sub-agents.

### Register (first time)

```bash
curl -s -X POST https://bastion-agentique.fly.dev//agents \
  -H "Content-Type: application/json" \
  -d '{
    "did": "did:bastion:solana:YOUR_AGENT_PDA_BASE58",
    "authority_pubkey": "YOUR_SOLANA_PUBKEY_BASE58",
    "sidecar_endpoint": null
  }'
```

**If BASTION_API_KEY is set** (you get 401), add: `-H "X-Api-Key: YOUR_KEY"`

### Verify

```bash
curl -s https://bastion-agentique.fly.dev//agents | python3 -m json.tool
```

### Spawn sub-agent (delegation)

```bash
curl -s -X POST "https://bastion-agentique.fly.dev//agents/did:bastion:solana:PARENT_DID/delegate" \
  -H "Content-Type: application/json" \
  -d '{
    "child_did": "did:bastion:solana:CHILD_DID",
    "child_name": "SubAgent-ETH",
    "delegated_capabilities": ["TRANSFER"]
  }'
```

### See your delegation tree

```bash
curl -s "https://bastion-agentique.fly.dev//agents/did:bastion:solana:DID/tree" | python3 -m json.tool
```

### Agent Registry API

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/agents` | Yes | Register agent (with optional parent_did for delegation) |
| GET | `/agents` | No | List all registered agents |
| GET | `/agents/:did` | No | Single agent detail |
| GET | `/agents/:did/audit` | No | Agent-specific audit trail |
| GET | `/agents/:did/children` | No | List sub-agents |
| GET | `/agents/:did/tree` | No | Full delegation tree |
| POST | `/agents/:did/delegate` | Yes | Spawn sub-agent |
| DELETE | `/agents/:did/delegation/:child_did` | Yes | Revoke delegation |
| GET | `/agents/:did/stake` | No | Agent stake status |

## REST API Reference

### `POST /simulate` — Validate a transaction

Request:
```json
{
  "transaction": "base64_encoded_serialized_transaction",
  "intent": "human-readable description of what the agent intends to do"
}
```

Response `200 ALLOWED`:
```json
{
  "decision": "ALLOW",
  "units_consumed": 150000,
  "balance_changes": {"wallet_pubkey": -1000000000},
  "block_id": null
}
```

Response `403 BLOCKED`:
```json
{
  "error": "Blockint: flash-loan pattern detected on account ...",
  "decision": "BLOCK",
  "block_id": "uuid-for-override"
}
```

The `intent` field is logged alongside the decision for later audit review.

### `POST /override` — Human override for blocked transactions

```json
{
  "block_id": "uuid-from-blocked-response",
  "action": "ALLOW"
}
```

Actions: `ALLOW` or `REJECT`.

### `GET /logs` — Fetch audit logs

```
GET /logs?limit=10&offset=0&result=BLOCKED
```

Query params: `limit` (default 50), `offset`, `result` (ALLOWED/BLOCKED/PENDING_APPROVAL).

Returns:
```json
{
  "total": 142,
  "offset": 0,
  "limit": 10,
  "entries": [
    {
      "id": "...",
      "transaction_id": "...",
      "signature": null,
      "decision": "BLOCKED",
      "reason": "Blockint: flash-loan pattern detected on account ...",
      "block_id": "uuid",
      "timestamp": 1715000000,
      "intent": "Swap 1 SOL for USDC"
    }
  ]
}
```

### `GET /logs/tx/:transaction_id` — Lookup by transaction hash

### `GET /logs/signature/:signature` — Lookup by on-chain signature

### `GET /policy` — Current policy settings

### `PUT /policy` — Update core policy

```json
{
  "max_sol_per_tx": 1,
  "max_balance_drain_lamports": 100000000,
  "rate_limit_per_minute": 10,
  "simulation_checks_enabled": true,
  "allowed_programs": ["JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"],
  "blocked_addresses": []
}
```

### `PUT /policy/full` — Full policy update including blockint rules

All fields from `/policy` plus:
```json
{
  "blockint_flash_loan_check": true,
  "blockint_high_slippage_check": true,
  "blockint_mint_authority_blocked": true,
  "blockint_freeze_authority_blocked": true,
  "blockint_max_slippage_bps": 500,
  "blockint_risk_labeled_addresses": []
}
```

### Circuit breaker endpoints

- `GET /circuit-breaker/status` — Returns `{ engaged: true/false }`
- `POST /circuit-breaker/engage` — Pauses all transaction processing (also calls `emergencyPause` on-chain if configured)
- `POST /circuit-breaker/disengage` — Resumes (calls `emergencyResume` on-chain)

### `GET /health` — Health check (returns `"Hello, Bastion!"`)

## Policy Configuration

### Program Allowlist

By default all programs are allowed (empty allowlist). Once you add entries, only whitelisted programs are permitted:

```
allowed_programs = [
  "11111111111111111111111111111111",    // System Program
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",  // Token Program
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",   // Jupiter v6
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",   // Raydium
]
```

### Blockint Security Checks (from Daemon Blockint Tech)

- **Flash loan detection**: Flags accounts with near-equal large inflow/outflow (ratio threshold configurable, default 100x)
- **High slippage**: Flags effective slippage exceeding max bps (default 500 = 5%)
- **Mint authority changes**: Blocks token mint authority transfers
- **Freeze authority changes**: Blocks token freeze authority transfers
- **Risk-labeled addresses**: Blocks transactions involving known-risk addresses

### Simulation Checks

- `NoErrorCheck`: Transaction must simulate without errors
- `MaxUnitsCheck`: Compute units must be under 1,400,000
- `MaxBalanceDrainCheck`: Total outflow must not exceed configured lamport limit

## On-Chain Program Integration

Program ID: `A29V5MUVs73y7XBHHxPpPcAW7h4gGHupbDdwYSwA2n9D`

### Instructions

| Instruction | Description |
|---|---|
| `initialize` | Initialize audit state (called once by authority) |
| `logAudit` | Record a decision (0=Allowed, 1=Blocked, 2=Pending) with simulation hash and reasoning |
| `registerAgent` | Register an agent identity with capability bitmask |
| `updateAgentReputation` | Adjust an agent's on-chain reputation score |
| `setPolicy` | Commit allowed programs, SOL cap, and rate limit on-chain |
| `emergencyPause` | Pause the protocol (circuit breaker) |
| `emergencyResume` | Resume the protocol |
| `stakeLamports` | Stake SOL for higher transaction limits (48h min before unstake) |
| `requestUnstake` | Start 7-day unstake cooldown |
| `claimUnstake` | Claim SOL after cooldown expires |

### On-Chain Configuration

Bastion submits audit entries on-chain asynchronously (fire-and-forget). Enable with env vars:
```
BASTION_ON_CHAIN=1
SOLANA_RPC_URL=https://api.devnet.solana.com
BASTION_KEYPAIR_PATH=./keypair.json
```

When disabled (default), audit entries are local-only (Sled DB) and circuit breaker is API-only.

## TypeScript SDK

```typescript
import { BastionClient, BASTION_PROGRAM_ID } from "@bastion-agentique/sdk";
import { Connection, Keypair } from "@solana/web3.js";

const client = new BastionClient({
  connection: new Connection("https://api.devnet.solana.com")
});

const wallet = Keypair.generate();

// Register agent on-chain
await client.registerAgent(wallet, "MyTradingBot", 3);

// Set on-chain policy
const jupiterProgram = new PublicKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");
await client.setPolicy(wallet, [jupiterProgram], 5, 10);

// Fetch audit state
const state = await client.fetchAuditState();

// Emergency pause
await client.emergencyPause(wallet);
```

## Understanding Audit Logs

Each log entry contains:
- `decision`: ALLOWED, BLOCKED, or PENDING_APPROVAL
- `reason`: Why it was blocked (policy violation, simulation error, blockint rule)
- `block_id`: UUID for use with `/override` (only for BLOCKED/PENDING_APPROVAL)
- `intent`: Human-readable description from the agent
- `transaction_id`: Hash of the transaction payload
- `signature`: On-chain signature (populated after async on-chain submission)
- `timestamp`: Unix timestamp

## Deployment

### Docker (quick start)
```bash
docker-compose up --build
```

### Manual
```bash
cargo build --release
HELIUS_API_KEY=your_key BASTION_ON_CHAIN=1 cargo run --release
```

### On-chain program
```bash
cd programs/bastion-audit
anchor build
anchor deploy --provider.cluster devnet
```

## MCP HTTP Server (SSE)

Start the MCP server for browser-native SSE access:

```bash
BASTION_SIDECAR_URL=https://bastion-agentique.fly.dev/ \
pnpm --filter @bastion/mcp-server dev:http
```

Endpoints:
- `GET /mcp/sse` — SSE connection
- `POST /mcp/messages` — MCP JSON-RPC messages (with `?sessionId=<id>`)
- `GET /mcp/health` — Health check
- `GET /mcp/pricing` — Tool pricing + free tier info

**15 tools** (same as stdio MCP): simulate, ingest, get/update policy, audit logs/stats, override, pending, circuit breaker, cases, DID, token balances.

**3 prompts:** `bastion_verify_transaction`, `bastion_security_review`, `bastion_incident_response`.

## x402 Payments

Paid tools require Solana SOL transfer before execution. Free monthly tier resets on the 1st.

| Tool | Free/Month | Price (SOL) |
|------|-----------|-------------|
| `bastion_simulate_transaction` | 100 | 0.001 |
| `bastion_override_block` | 10 | 0.01 |
| `bastion_update_policy` | 5 | 0.05 |
| `bastion_circuit_breaker_toggle` | 3 | 0.1 |

Replay protection: used tx hashes tracked in `USED_PAYMENTS` Set.

## pay.sh Integration

```bash
pay --sandbox server start packages/mcp-server/bastion-provider.yml
pay --sandbox curl -X POST http://127.0.0.1:1402/v1/simulate -d '{"transaction":"...","intent":"..."}'
```

`routing.auth` injects `X-Api-Key` after payment verification — server treats as pre-verified.

## CORS

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Content-Type, Authorization, X-Api-Key, X-Payment, X-Payment-Chain, X-Agent-Id
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
```

## Related Skills

- **blockchain-intelligence-playbook** — Broader blockchain investigation methodology
- **solana-onchain-intelligence-resources** — Solana-specific tools and data sources
- **defi-security-audit-agent** — DeFi security patterns that complement Bastion policy rules
