---
name: bastion
description: "High-performance Rust firewall for AI Agents. Intercepts, simulates, and validates transactions before signing."
homepage: "https://github.com/bastion-agentic-defense/bastion"
metadata: {
  "category": "security",
  "emoji": "🛡️",
  "requires": {
    "bins": ["bastion"]
  }
}
---

# Bastion 🛡️

Bastion is an autonomous security middleware that sits between an Agent's Brain and its Wallet.

## Installation

```bash
# Clone and build
git clone https://github.com/bastion-agentic-defense/bastion.git
cd bastion && cargo build --release
```

## Features
- **Transaction Simulation**: Uses Helius simulation API to predict balance changes.
- **Program Whitelisting**: Blocks unauthorized Program IDs.
- **Audit Logging**: Persistent history of all attempts via Sled DB.
- **REST API**: Dynamically update policies and fetch logs.
- **Human-in-the-loop**: Request manual approval for suspicious transactions.
- **On-Chain Audit**: Anchor program for immutable audit records (v2).
- **Agent Registry**: On-chain agent identity and reputation (v2).
- **GrondOSINT Oracle**: Address risk scoring via Grond's agentic OSINT pipeline (Tavily, Shodan, Twitter).
- **MCP HTTP Server (SSE)**: 15 tools + 3 prompts on port 3001 for Claude, Cursor, browser agents.
- **x402 Payments**: Pay-per-call with Solana SOL transfers + free monthly tier.
- **pay.sh Provider**: One-command gateway with automatic payment handling.
- **Auth: pay.sh + x402.** pay.sh pre-verifies payment before proxying to sidecar. x402 on MCP server handles tool payment. Sidecar REST API is open.

## Staking (AgentStake PDA)

Start the MCP HTTP server for browser-native agent access:

```bash
BASTION_SIDECAR_URL=http://localhost:3000 \
pnpm --filter @bastion/mcp-server dev:http
```

Endpoints:
- `GET /mcp/sse` — SSE connection
- `POST /mcp/messages` — MCP JSON-RPC messages
- `GET /mcp/health` — Health check
- `GET /mcp/pricing` — Tool pricing + free tier info

For stdio transport (Claude Desktop / Cursor / Codex):
```bash
pnpm --filter @bastion/mcp-server dev
```

## Payments (x402)

Paid tools require Solana SOL transfer to treasury before execution:

| Tool | Free/Month | Price (SOL) | Price (USD) |
|------|-----------|-------------|-------------|
| `bastion_simulate_transaction` | 100 | 0.001 | $0.10 |
| `bastion_override_block` | 10 | 0.01 | $1.00 |
| `bastion_update_policy` | 5 | 0.05 | $5.00 |
| `bastion_circuit_breaker_toggle` | 3 | 0.1 | $10.00 |
| All read-only tools | ∞ | Free | Free |

**Flow:** Transfer SOL → `E9PsSz9XWgNR3TmSC57NHC2ZxJzF5NmbrWsDKEe7A7yM`, then retry with `X-Payment: <tx_hash>, X-Payment-Chain: solana` headers.

**pay.sh:** `pay --sandbox server start packages/mcp-server/bastion-provider.yml` — no manual headers needed.

## CORS

Sidecar supports browser-native access with:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Content-Type, Authorization, X-Api-Key, X-Payment, X-Payment-Chain, X-Agent-Id
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
```

## Usage for Agents

Other AI agents should use Bastion to verify every transaction before sending it to the network.

### Verification Flow
1. **Prepare Transaction**: Build your Solana transaction.
2. **Simulate/Verify**: Send `POST /simulate` with the base64 transaction and your `intent` (what you think you are doing).
3. **Handle Response**:
    - **200 OK**: Success! Proceed to sign and broadcast.
    - **403 Forbidden**: Check for `block_id` in the response.
        - If `block_id` exists: The transaction is suspicious but might be valid. **You MUST notify the human**, explain the intent, show the block reason, and provide the `block_id` for them to decide.
        - If no `block_id`: The transaction is explicitly denied by static policy. Abort.

### Including Intent
Always provide a human-readable `intent` string in your requests. This is logged and shown to the human during override requests.
Example: `"intent": "Swapping 1 SOL for USDC on Jupiter"`

### Handling Blocks (Human Override)
If a transaction is blocked with a `block_id`, ask the human:
"Bastion blocked this transaction: [Reason]. If you trust this, reply with 'allow [block_id]' or 'reject [block_id]'."

Then call `POST /override` with:
```json
{
  "block_id": "...",
  "action": "ALLOW" or "REJECT"
}
```

## Agent Self-Registration (NEW — v0.3.0)

**An AI coding agent MUST register itself with Bastion before sending transactions.** This gives you a DID, tracks your audit trail, and enables delegation.

### Step 1: Generate your DID

Your DID is `did:bastion:solana:{agent_pda_base58}`. You need a Solana keypair:
```bash
# Generate a keypair (or use your existing agent wallet)
solana-keygen new --outfile ~/.config/solana/bastion-agent.json
```

### Step 2: Register with the sidecar

```bash
# Default host: localhost:3000 (running Bastion instance)
# Auth: only needed if BASTION_API_KEY is set. Check with an unauthenticated request first.
curl -s -X POST http://localhost:3000/agents \
  -H "Content-Type: application/json" \
  -d '{
    "did": "did:bastion:solana:YOUR_AGENT_PDA_BASE58",
    "authority_pubkey": "YOUR_SOLANA_PUBKEY_BASE58",
    "sidecar_endpoint": null
  }'
```

**If BASTION_API_KEY is set** (you get a 401 response), add the header:
```bash
curl -s -X POST http://localhost:3000/agents \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: YOUR_API_KEY" \
  -d '...'
```

### Step 3: Verify registration

```bash
# List all agents (no auth required)
curl -s http://localhost:3000/agents | python3 -m json.tool

# Get your agent by DID
curl -s http://localhost:3000/agents/did:bastion:solana:YOUR_DID | python3 -m json.tool
```

### Step 4: Spawn sub-agents (delegation)

```bash
# Parent spawns a sub-agent with restricted capabilities
curl -s -X POST "http://localhost:3000/agents/did:bastion:solana:PARENT_DID/delegate" \
  -H "Content-Type: application/json" \
  -d '{
    "child_did": "did:bastion:solana:CHILD_DID",
    "child_name": "SubAgent-ETH",
    "delegated_capabilities": ["TRANSFER"],
    "delegation_budget_sol": 5
  }'
```

### Step 5: See your delegation tree

```bash
curl -s "http://localhost:3000/agents/did:bastion:solana:PARENT_DID/tree" | python3 -m json.tool
```

### Auth Notes

- `BASTION_API_KEY` is optional — if not set, all endpoints are open
- Mutating endpoints (`POST /agents`, `POST /override`, `/policy/*`, `/circuit-breaker/*`) require the header when `BASTION_API_KEY` is configured
- Read-only endpoints (`GET /agents`, `GET /health`, `GET /logs`) are always open
- The correct header is `X-Api-Key` (not `Authorization`)

## API Endpoints
- `POST /simulate`: Intercept and verify a transaction.
- `GET /logs`: Fetch audit history.
- `POST /policy`: Update allowed programs list.
- `POST /override`: Human override for a blocked transaction.
- `GET /health`: Server health check.
- `GET /policy`: Get current policy settings.