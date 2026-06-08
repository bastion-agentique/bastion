# Bastion MCP + x402 — Private Repository Plan

## Purpose

A private repository inside `bastion-agentique` org hosting Bastion's monetized API layer:
- **MCP (Model Context Protocol) tools** — expose Bastion's security services to AI agents
- **x402 payment middleware** — HTTP 402 Payment Required with on-chain settlement
- **API routes** — rate-limited, authenticated endpoints behind x402 paywall
- **Usage tracking** — per-agent billing, credits, and analytics

This is the **commercial surface** of Bastion. The public repo (`bastion`) remains the open-source
firewall core. The private repo (`bastion-mcp`) is how Bastion generates revenue.

---

## Why Private

| Concern | Reason |
|---|---|
| **x402 payment signing keys** | Server-side keys for verifying payment proofs must not be public |
| **Rate limit thresholds** | Attackers reverse-engineering rate limits weaken defenses |
| **API key management** | Key generation, revocation, and rate-limit config are secret |
| **Pricing strategy** | Commercial pricing and discount logic is competitive intel |
| **Enterprise features** | Tiered access, SLA enforcement, dedicated endpoints |

The private repo deploys to a protected server (Cloudflare Workers, AWS Lambda, or Fly.io).
The public SDK (`@bastion-agentique/sdk`) calls these endpoints without exposing internals.

---

## Repository Structure

```
bastion-mcp/                        # Private repo
├── package.json                    # Workspace root
├── tsconfig.json
├── .env.example                    # Template for required secrets
├── .gitignore                      # Excludes .env, keys, credentials
│
├── apps/
│   └── api/                        # API server (Express/Fastify/Hono)
│       ├── src/
│       │   ├── index.ts            # Server entry point
│       │   ├── routes/
│       │   │   ├── simulate.ts     # POST /v2/simulate (x402 protected)
│       │   │   ├── audit.ts        # GET  /v2/audit/:agentId
│       │   │   ├── policy.ts       # GET/PUT /v2/policy
│       │   │   ├── override.ts     # POST /v2/override (HITL)
│       │   │   ├── register.ts     # POST /v2/register (ERC-8004 mint)
│       │   │   ├── billing.ts      # GET /v2/billing (usage, credits)
│       │   │   └── health.ts       # GET /health
│       │   ├── middleware/
│       │   │   ├── x402.ts         # x402 payment required middleware
│       │   │   ├── auth.ts         # API key + signature verification
│       │   │   ├── ratelimit.ts    # Per-agent rate limiting
│       │   │   └── logging.ts      # Request/response audit logging
│       │   ├── services/
│       │   │   ├── payment.ts      # On-chain payment verification
│       │   │   ├── simulation.ts   # Helius / Celo RPC simulation
│       │   │   ├── policy.ts       # Policy evaluation engine
│       │   │   ├── billing.ts      # Credit deduction, invoice gen
│       │   │   └── webhook.ts      # On-chain event listeners
│       │   ├── db/
│       │   │   ├── schema.ts       # Drizzle/Turso schema
│       │   │   ├── migrations/     # DB migrations
│       │   │   └── queries.ts      # Typed queries
│       │   └── lib/
│       │       ├── chains.ts       # Chain configs (Celo, Base, Polygon...)
│       │       ├── constants.ts    # Pricing, limits, timeouts
│       │       └── errors.ts       # Standardized error responses
│       ├── Dockerfile
│       └── fly.toml                # Fly.io deploy config
│
├── packages/
│   ├── mcp-server/                 # MCP Server for AI agents
│   │   ├── src/
│   │   │   ├── index.ts            # MCP server entry (stdio + SSE)
│   │   │   ├── tools/
│   │   │   │   ├── simulate.ts     # Tool: bastion_simulate_transaction
│   │   │   │   ├── audit.ts        # Tool: bastion_get_audit_log
│   │   │   │   ├── policy.ts       # Tool: bastion_get_policy
│   │   │   │   ├── register.ts     # Tool: bastion_register_agent
│   │   │   │   └── override.ts     # Tool: bastion_override_block
│   │   │   ├── prompts/
│   │   │   │   ├── verify.ts       # Prompt: "Verify this transaction before signing"
│   │   │   │   └── audit.ts        # Prompt: "Get my agent's audit history"
│   │   │   └── x402.ts             # x402 client: pay before calling tool
│   │   ├── README.md               # MCP setup instructions for Claude/Cursor
│   │   └── package.json
│   │
│   └── sdk-x402/                   # Client SDK with x402 support
│       ├── src/
│       │   ├── index.ts
│       │   ├── client.ts           # BastionClient with x402 payment flow
│       │   ├── payment.ts          # x402 payment construction + verification
│       │   ├── types.ts
│       │   └── chains.ts
│       └── package.json
│
├── infra/                          # Infrastructure as code
│   ├── terraform/                  # (optional) Terraform for cloud resources
│   └── docker/
│       └── docker-compose.yml      # Local dev stack
│
└── docs/
    ├── API.md                      # API reference (public)
    ├── X402.md                     # x402 integration docs
    ├── PRICING.md                  # Pricing tiers
    └── DEPLOY.md                   # Deployment runbook
```

---

## x402 Payment Flow

### What is x402?

x402 is the blockchain-native implementation of HTTP 402 (Payment Required).
An API server returns HTTP 402 with payment details; the client pays on-chain
and retries with proof of payment.

### Flow

```
Client                          API Server                       Blockchain
  │                                │                                │
  ├── POST /v2/simulate ──────────►│                                │
  │   (no payment header)          │                                │
  │                                ├── Check credits/balance        │
  │                                ├── Insufficient                │
  │◄── HTTP 402 + payment details──┤                                │
  │   {                             │                                │
  │     "type": "x402",             │                                │
  │     "chainId": 42220,           │                                │
  │     "recipient": "0x...",       │                                │
  │     "amount": "0.01",           │                                │
  │     "currency": "CELO",         │                                │
  │     "deadline": 1716307200,     │                                │
  │     "requestId": "uuid"         │                                │
  │   }                             │                                │
  │                                │                                │
  ├── Send payment on-chain ───────│───────────────────────────────►│
  │   (0.01 CELO to recipient)     │                                │
  │                                │        ┌───── tx confirmed ───┤
  │                                │◄───────┘                      │
  │                                │                                │
  ├── POST /v2/simulate ──────────►│                                │
  │   Header: x-payment-tx: 0x...  │                                │
  │   Header: x-payment-chain: 42220│                               │
  │                                ├── Verify tx on-chain           │
  │                                ├── Verify amount >= required    │
  │                                ├── Verify recipient matches     │
  │                                ├── Verify deadline not passed   │
  │                                ├── Execute simulation           │
  │◄── 200 + simulation result ────┤                                │
```

### Pricing Tiers (Example)

| Tier | Price per Simulation | Monthly Limit | Includes |
|---|---|---|---|
| **Free** | 0 CELO | 100/mo | Basic policy checks |
| **Builder** | 0.01 CELO | 10,000/mo | Full simulation + audit |
| **Pro** | 0.005 CELO | 100,000/mo | Priority + HITL + Webhooks |
| **Enterprise** | Custom | Unlimited | SLA + dedicated infra + ERC-8004 integration |

### Credit System

For better UX, agents pre-purchase credits:
1. Agent deposits CELO into Bastion's credit contract
2. Credits are consumed per request (no per-request tx needed)
3. Low-credit webhook alerts agent to top up
4. Unused credits are withdrawable

---

## MCP Tools

The MCP server exposes these tools to AI agents (Claude, Cursor, etc.):

### Tool: `bastion_simulate_transaction`

```typescript
{
  name: "bastion_simulate_transaction",
  description: "Simulate a transaction through Bastion's security firewall before signing. Returns Pass/Block/PendingHITL.",
  inputSchema: {
    type: "object",
    properties: {
      transaction: { type: "string", description: "Base64-encoded transaction" },
      intent: { type: "string", description: "Human-readable description of what this tx does" },
      chain: { type: "string", enum: ["celo", "base", "ethereum", "polygon", "arbitrum"] },
      agentId: { type: "string", description: "Your ERC-8004 agent ID" },
      paymentProof: { type: "string", description: "x402 payment transaction hash (optional for free tier)" }
    },
    required: ["transaction", "intent", "chain", "agentId"]
  }
}
```

### Tool: `bastion_get_audit_log`

```typescript
{
  name: "bastion_get_audit_log",
  description: "Retrieve the on-chain audit trail for an agent. Returns all Pass/Block decisions.",
  inputSchema: {
    type: "object",
    properties: {
      agentId: { type: "string" },
      chain: { type: "string" },
      limit: { type: "number", default: 50 },
      offset: { type: "number", default: 0 }
    }
  }
}
```

### Tool: `bastion_register_agent`

```typescript
{
  name: "bastion_register_agent",
  description: "Register a new AI agent on-chain via ERC-8004 Identity Registry. Returns ERC-721 tokenId.",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string" },
      agentURI: { type: "string", description: "IPFS URI to ERC-8004 registration file" },
      chain: { type: "string" },
      capabilities: { type: "string[]", description: "Agent capabilities for policy defaults" }
    }
  }
}
```

---

## API Routes (x402 Protected)

| Method | Path | x402 Required | Rate Limit | Description |
|---|---|---|---|---|
| POST | `/v2/simulate` | Yes (free tier: 100/mo) | 10/min | Simulate + validate transaction |
| GET | `/v2/audit/:agentId` | No | 30/min | Fetch agent audit history |
| GET | `/v2/policy/:agentId` | No | 30/min | Get active policy for agent |
| PUT | `/v2/policy/:agentId` | Yes | 5/min | Update policy (owner only) |
| POST | `/v2/override` | Yes | 5/min | Human override for blocked tx |
| POST | `/v2/register` | Yes (one-time) | 3/min | Register agent (ERC-8004 mint) |
| GET | `/v2/billing/:agentId` | No | 10/min | Usage, credits, billing history |
| GET | `/health` | No | Unlimited | Health check |

---

## Authentication

### API Keys

Agents authenticate with API keys:
```
Authorization: Bearer bastion_sk_abc123...
```

Keys are:
- Generated per agent on registration
- Scoped to agent's ERC-8004 identity
- Rate-limited independently
- Revocable via dashboard

### EIP-712 Signatures (Optional, Higher Security)

For high-value operations (policy changes, overrides):
```
X-Bastion-Signature: 0x...
X-Bastion-Deadline: 1716307200
```

Verifies the caller controls the agent's ERC-8004 owner wallet.

---

## Deployment Architecture

```
                    ┌─────────────────────────────────┐
                    │         AI Agent (Client)         │
                    │  (Claude, Cursor, custom agent)   │
                    └──────────────┬──────────────────┘
                                   │ MCP Protocol (stdio/SSE)
                                   ▼
                    ┌─────────────────────────────────┐
                    │      bastion-mcp (Private)       │
                    │                                  │
                    │  ┌──────────────────────────┐    │
                    │  │   apps/api (Hono/Fastify) │    │
                    │  │   - x402 middleware       │    │
                    │  │   - auth + ratelimit      │    │
                    │  │   - API routes            │    │
                    │  └──────────┬───────────────┘    │
                    │             │                     │
                    │  ┌──────────▼───────────────┐    │
                    │  │  packages/mcp-server      │    │
                    │  │  - MCP tools              │    │
                    │  │  - x402 client            │    │
                    │  │  - prompts                │    │
                    │  └──────────────────────────┘    │
                    │                                  │
                    └──────────────┬───────────────────┘
                                   │
                    ┌──────────────▼───────────────────┐
                    │        External Services          │
                    │                                   │
                    │  ┌─────────┐  ┌────────────────┐  │
                    │  │  Celo   │  │  Helius / RPC  │  │
                    │  │ Mainnet │  │  Simulation    │  │
                    │  └─────────┘  └────────────────┘  │
                    │                                   │
                    │  ┌─────────────────────────────┐  │
                    │  │  Turso / Neon (Postgres)     │  │
                    │  │  - API keys                  │  │
                    │  │  - Credits/balances          │  │
                    │  │  - Usage logs                │  │
                    │  │  - Rate limit counters       │  │
                    │  └─────────────────────────────┘  │
                    └───────────────────────────────────┘
```

### Hosting

| Service | Platform | Why |
|---|---|---|
| API Server | Fly.io / Cloudflare Workers | Global edge, auto-scaling, Celo RPC proximity |
| Database | Turso (SQLite edge) | Low latency, per-region replicas, x402 credits |
| MCP Server | Same as API server | Shares auth, DB, and x402 verification |
| Payment Indexer | Cron job (every 30s) | Watches Celo for x402 payment confirmations |

---

## Environment Variables (`.env`)

```bash
# Server
PORT=3000
NODE_ENV=production

# Database
TURSO_DATABASE_URL=libsql://bastion-mcp.turso.io
TURSO_AUTH_TOKEN=...

# Chains
CELO_RPC_URL=https://forno.celo.org
BASE_RPC_URL=https://mainnet.base.org
ETHEREUM_RPC_URL=https://eth.llamarpc.com

# Payment
BASTION_TREASURY_ADDRESS=0x...        # Celo address receiving x402 payments
X402_PRICE_SIMULATE_CELO=0.01        # CELO per simulation
X402_FREE_TIER_LIMIT=100             # Free simulations per month

# Security
JWT_SECRET=...
API_KEY_PREFIX=bastion_sk_

# Bastion Core (Rust sidecar)
SIDECAR_URL=http://localhost:3001    # Rust policy evaluator

# ERC-8004
ERC8004_REGISTRY_CELO=0x...          # BastionERC8004Registry on Celo
ERC8004_REGISTRY_BASE=0x...          # BastionERC8004Registry on Base

# Self Protocol
SELF_AGENT_ID_VERIFIER=0x...         # Self Protocol contract on Celo
```

---

## Implementation Phases

### Phase 1: Core API + x402 (3-4 hours)
- Hono/Fastify server with health, simulate, audit routes
- x402 middleware: 402 response generation, payment verification
- Database schema: agents, credits, usage_logs
- API key generation and validation

### Phase 2: MCP Server (2-3 hours)
- MCP server with stdio + SSE transports
- 5 tools wrapping API routes
- x402 client inside MCP: auto-pay when tool gets 402
- Prompt templates for common agent workflows

### Phase 3: Billing + Credits (2 hours)
- Credit deposit contract (or direct x402 per-request)
- Billing dashboard endpoints
- Low-credit webhooks
- Usage analytics

### Phase 4: Production Hardening (2 hours)
- Rate limiting per agent + per IP
- CORS, CSP, security headers
- Docker + fly.toml deploy config
- Monitoring (Sentry, Axiom)
- CI/CD (GitHub Actions → Fly.io)

**Total: ~10 hours**

---

## Integration with Public Bastion Repo

The public `@bastion-agentique/sdk` package should add:

```typescript
// packages/sdk/src/x402.ts (public — no secrets)
import { BastionClient } from "./client";

export interface X402Payment {
  chainId: number;
  recipient: string;
  amount: string;
  currency: string;
  deadline: number;
  requestId: string;
}

export interface X402ClientOptions {
  apiUrl: string;       // https://api.bastion.xyz
  apiKey: string;       // bastion_sk_...
  signer: Signer;       // viem WalletClient or ethers Signer
}

export class BastionX402Client extends BastionClient {
  async simulate(tx: string, intent: string): Promise<SimulateResult> {
    try {
      return await this.api.simulate(tx, intent, this.apiKey);
    } catch (err) {
      if (err.status === 402) {
        const payment: X402Payment = err.body;
        const txHash = await this.payAndWait(payment);
        return await this.api.simulate(tx, intent, this.apiKey, txHash);
      }
      throw err;
    }
  }

  private async payAndWait(payment: X402Payment): Promise<string> {
    const hash = await this.signer.sendTransaction({
      to: payment.recipient,
      value: parseEther(payment.amount),
      chainId: payment.chainId,
    });
    await this.provider.waitForTransaction(hash);
    return hash;
  }
}
```

The public SDK exposes the x402 client interface but never contains server-side secrets,
payment verification logic, or pricing configuration.

---

## Security Considerations

| Threat | Mitigation |
|---|---|
| Replay attacks (reuse payment tx) | Server tracks used tx hashes, marks consumed |
| Payment to wrong address | Server verifies `to` matches treasury before serving |
| Insufficient payment | Server verifies `value >= required` on-chain |
| Expired payment | Server checks `deadline` field, rejects stale payments |
| API key theft | Keys are server-side hashed; only prefix stored |
| DDoS on paid endpoints | Rate limiting + Cloudflare DDoS protection |
| Sybil free tier abuse | ERC-8004 identity + Self Protocol verification required |

---

## Open Questions

1. **Credit contract vs direct x402**: Deposit-based credits are better UX (one tx funds many requests). But x402 is more standard. Which for v1?
2. **Self Protocol integration**: How exactly does Self Agent ID factor into auth? Register agent via Self first, then link to Bastion?
3. **Multichain payments**: Accept CELO only, or USDC/USDT on Celo? The x402 spec supports any ERC-20.
4. **MCP transport**: stdio for local dev, SSE for remote? Or both from launch?
