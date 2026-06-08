# Bastion Agent Operations Log

> **Reference for AI agents integrating with Bastion**  
> Generated: 2026-06-04 | Sidecar: `0.3.0` | Solana devnet | Program: `A29V5MUVs73y7XBHHxPpPcAW7h4gGHupbDdwYSwA2n9D`

## Quick Start (Copy-Paste)

An agent needs 3 things to integrate:
1. A Solana keypair (any valid keypair works)
2. A running Bastion sidecar (default: `https://bastion-agentique.fly.dev/`)
3. Self-registration via REST API

```bash
# 1. Register yourself as an agent
PUBKEY=$(solana address)
curl -s -X POST https://bastion-agentique.fly.dev/agents \
  -H "Content-Type: application/json" \
  -d "{\"did\":\"did:bastion:solana:${PUBKEY}\",\"authority_pubkey\":\"${PUBKEY}\",\"sidecar_endpoint\":null}"

# 2. Verify registration
curl -s https://bastion-agentique.fly.dev/agents | python3 -m json.tool

# 3. Spawn a sub-agent (if you have delegation rights)
curl -s -X POST "https://bastion-agentique.fly.dev/agents/did:bastion:solana:YOUR_DID/delegate" \
  -H "Content-Type: application/json" \
  -d '{"child_did":"did:bastion:solana:child-did","child_name":"SubAgent"}'

# 4. Simulate a transaction before signing
curl -s -X POST https://bastion-agentique.fly.dev/simulate \
  -H "Content-Type: application/json" \
  -d '{"transaction":"<base64_tx>","intent":"swap 0.1 SOL for USDC on Jupiter"}'

# 5. Check your audit trail
curl -s https://bastion-agentique.fly.dev/logs?limit=10 | python3 -m json.tool
```

---

## Test Session Results (OpenCode ← Bastion)

### Infrastructure

| Component | Value |
|-----------|-------|
| Sidecar port | `bastion-agentique.fly.dev/` (Axum, Rust) |
| MCP port | `bastion-agentique.fly.dev/` (SSE transport) |
| Solana devnet | `https://api.devnet.solana.com` |
| Program ID | `A29V5MUVs73y7XBHHxPpPcAW7h4gGHupbDdwYSwA2n9D` |

### Agent Hierarchy

```
Parent: Agent-E9PsSz9X  (depth 0, is_delegator: true)
  └── Child: OpenCode   (depth 1, parent: did:bastion:solana:E9PsSz9X...)
```

### Operations Tested

| # | Operation | Endpoint | Result |
|---|-----------|----------|--------|
| 1 | Health check | `GET /health` | `{"status":"ok","uptime_seconds":466}` |
| 2 | Register agent | `POST /agents` | Registered `Agent-E9PsSz9X` |
| 3 | Spawn sub-agent | `POST /agents/:did/delegate` | Created `OpenCode` at depth 1 |
| 4 | Agent tree | `GET /agents/:did/tree` | 1 parent, 1 child correctly nested |
| 5 | Policy check | `GET /policy` | Policy: max_sol_per_tx=1, rate=120/min, 5 blockint rules enabled |
| 6 | Simulate tx | `POST /simulate` | Blocked: invalid payload (expected — mock tx used) |
| 7 | Audit stats | `GET /audit/stats` | 2 total, 0 allowed, 2 blocked |
| 8 | Audit logs | `GET /logs?limit=5` | 2 entries with intent, decision, reasoning |
| 9 | Circuit breaker | `GET /circuit-breaker/status` | `{"engaged":false}` |
| 10 | Agent detail | `GET /agents/:did` | Full metadata + delegation fields |
| 11 | Agent children | `GET /agents/:did/children` | 1 child: OpenCode depth 1 |
| 12 | Create case | `POST /cases` | Case `fda595da` created (open) |
| 13 | List cases | `GET /cases` | 1 case, status: open |
| 14 | DID resolution | `GET /did/resolve/solana:...` | W3C DID doc with Ed25519 key + metadata |
| 15 | Pending approvals | `GET /pending` | Empty (no blocks with block_id) |
| 16 | Sub-agent detail | `GET /agents/:child_did` | Full metadata + parent_did + delegation_depth=1 |

### Policy Configuration (as tested)

```json
{
  "max_sol_per_tx": 1,
  "rate_limit_per_minute": 120,
  "allowed_programs": [],
  "blocked_addresses": [],
  "simulation_checks_enabled": true,
  "blockint_flash_loan_check": true,
  "blockint_high_slippage_check": true,
  "blockint_mint_authority_blocked": true,
  "blockint_freeze_authority_blocked": true,
  "blockint_max_slippage_bps": 500
}
```

### Case Created

| Field | Value |
|-------|-------|
| ID | `fda595da-e72b-4bab-b2c7-58e21e3af36d` |
| Title | Suspicious transfer blocked |
| Status | open |
| Created | 1780556639 (Unix timestamp) |

### Auth Model

No API keys. The sidecar is open on localhost. In production:
- **pay.sh** pre-verifies payment before proxying to sidecar
- **x402** on MCP server handles tool payment (SOL transfer to treasury)
- **Delegation** provides authority chain without API keys

---

## API Endpoint Reference

### Agent Registry

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/agents` | Register agent (self-service, no auth) |
| `GET` | `/agents` | List all agents |
| `GET` | `/agents/:did` | Single agent detail |
| `GET` | `/agents/:did/audit` | Agent-specific audit trail |
| `GET` | `/agents/:did/stake` | Agent stake status |
| `POST` | `/agents/:did/stake` | Stake SOL via SDK |
| `POST` | `/agents/:did/stake/unstake` | Request unstake |
| `POST` | `/agents/:did/stake/claim` | Claim unstaked SOL |
| `GET` | `/agents/:did/children` | List sub-agents |
| `GET` | `/agents/:did/tree` | Full delegation tree |
| `POST` | `/agents/:did/delegate` | Spawn sub-agent |
| `DELETE` | `/agents/:did/delegation/:child_did` | Revoke delegation |

### Firewall

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/simulate` | Simulate transaction before signing |
| `POST` | `/override` | HITL override for blocked tx |
| `GET` | `/pending` | Pending approvals |
| `GET` | `/policy` | Current policy |
| `POST` | `/policy/full` | Update policy |
| `GET` | `/circuit-breaker/status` | Breaker status |
| `POST` | `/circuit-breaker/engage` | Pause protocol |
| `POST` | `/circuit-breaker/disengage` | Resume protocol |

### Audit + Cases

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/audit/stats` | Aggregate stats |
| `GET` | `/logs` | Paginated audit logs |
| `POST` | `/cases` | Create investigation case |
| `GET` | `/cases` | List cases |
| `PATCH` | `/cases/:id` | Update case |
| `POST` | `/cases/:id/evidence` | Add evidence |

### Identity + Discovery

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/did/resolve/:did` | W3C DID resolution |
| `GET` | `/health` | Health check |
| `GET` | `/token-balances` | SPL token balances |

---

## SDK Integration

```typescript
import { BastionClient, AGENT_CAPABILITIES } from "@bastion-agentique/sdk";
import { Connection, Keypair } from "@solana/web3.js";

const connection = new Connection("https://api.devnet.solana.com");
const client = new BastionClient({ connection });
const wallet = Keypair.generate();

// Register agent on Solana
const tx = await client.registerAgent(wallet, "MyAgent", AGENT_CAPABILITIES.TRANSFER);
await connection.sendTransaction(tx, [wallet]);

// Derive DID
const did = client.getAgentDID(wallet.publicKey);

// Self-register with sidecar
await fetch("https://bastion-agentique.fly.dev/agents", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    did,
    authority_pubkey: wallet.publicKey.toBase58(),
    sidecar_endpoint: null
  })
});

// Stake SOL for higher limits
await client.stakeLamports(wallet, 5_000_000_000); // 5 SOL

// Fetch delegation tree
const tree = await client.fetchAgentTree(wallet.publicKey);
console.log(`Delegation depth: ${tree.children.length}`);
```

---

## Notes for Future Agents

1. **No API keys needed** — Sidecar is open on localhost. pay.sh handles production auth.
2. **Delegation works** — Parent spawns children, tree is queryable, depth tracked.
3. **Policy is configurable** — max SOL/tx, rate limits, blockint rules all modifiable via API.
4. **Audit trail is persistent** — All decisions logged to Sled DB with intent, reasoning, tx details.
5. **DID provides identity** — Every agent gets a W3C DID with Ed25519 verification key + service endpoints.
6. **Staking exists** — Stake SOL via SDK for higher transaction limits (StakeWeighted policy).
7. **Case management** — Create, list, update investigation cases linked to blocked transactions.
