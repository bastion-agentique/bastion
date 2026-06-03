# Bastion Architecture

Bastion Agentic Defense is security middleware for autonomous AI agents operating on blockchain infrastructure. It provides a transaction firewall, a programmable policy engine, and an immutable audit layer deployed across Solana, EVM chains, and Midnight Network.

## System Overview

```
                    ┌──────────────────────────────┐
                    │        Agent Operator         │
                    │  (policy config, HITL review) │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                         Bastion Monorepo                         │
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐ │
│  │ crates/core  │   │   SDK + CLI  │   │  Compliance Dashboard│ │
│  │ (chain-agn.) │   │  (TypeScript)│   │  (React, apps/web/)  │ │
│  └──────┬───────┘   └──────────────┘   └──────────────────────┘ │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐                                                │
│  │crates/sidecar│  ← Off-chain evaluator (Axum HTTP)             │
│  └──────┬───────┘                                                │
│         │                                                        │
│    ┌────┴──────────────────────────┐                             │
│    ▼                               ▼                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                       │
│  │ Solana   │  │   EVM    │  │ Midnight │                       │
│  │ (Anchor) │  │(Solidity)│  │ (Compact)│                       │
│  └──────────┘  └──────────┘  └──────────┘                       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### crates/core — Chain-Agnostic Policy Engine

The shared foundation. Every chain-specific adapter normalizes its native transaction format into `NormalizedTransaction` and passes it through `PolicyEvaluator`. The evaluator returns a `FirewallDecision`: `Pass`, `Block { reason, policy_id }`, or `PendingHITL { approval_id, reason }`.

**Key types:**

| Type | Purpose |
|------|---------|
| `NormalizedTransaction` | Chain-agnostic tx representation (agent_id, from, to, amount, currency, tx_type, chain, metadata) |
| `FirewallDecision` | Enum: Pass, Block, PendingHITL |
| `PolicyRule` | Enum of rule types: AmountLimit, Destination, Frequency, HITL, Reputation, TxTypeAllowlist |
| `PolicySet` | Ordered, composable rule collection |
| `PolicyEvaluator<O: RiskOracle>` | Core evaluation loop with optional risk oracle |
| `RiskOracle` | Trait for address risk scoring (Webacy is first impl) |
| `AuditRecord` | Chain-agnostic audit event structure |

### crates/sidecar — Off-Chain Evaluator Service

An Axum HTTP server that exposes the policy evaluator as a REST API. This is the bridge that lets non-Rust chain implementations (EVM, Midnight) access the Rust policy engine.

**Flow:**
1. Agent submits transaction → sidecar receives it
2. Sidecar normalizes the transaction into `NormalizedTransaction`
3. Calls `PolicyEvaluator::evaluate()` against the active policy set
4. Returns `FirewallDecision` to the caller
5. Applies chain-specific enforcement (on-chain for Solana, via oracle for EVM/Midnight)

**CORS:** `CorsLayer` with `Access-Control-Allow-Origin: *`, headers: `Content-Type, Authorization, X-Api-Key, X-Payment, X-Payment-Chain, X-Agent-Id`.

### packages/mcp-server — MCP HTTP Server (SSE)

TypeScript MCP server on port 3001 bridging AI agents to Bastion sidecar. SSE transport (`GET /mcp/sse` + `POST /mcp/messages`). 15 tools + 3 prompts. x402 payment verification for paid tools via Solana RPC polling. pay.sh provider YAML at `bastion-provider.yml`.

### crates/solana — Anchor On-Chain Program

The Solana-native enforcement layer. Deployed as an Anchor program on Solana devnet. Provides:

- `AuditState` — master state: owner, total_audits, allowed/blocked counts, paused flag
- `AuditEntry` — per-transaction immutable record
- `Agent` — on-chain agent identity with reputation score
- `Policy` — on-chain policy state

**Instructions:** `initialize`, `logAudit`, `registerAgent`, `updateAgentReputation`, `setPolicy`, `emergencyPause`, `emergencyResume`

### evm/ — Solidity Contracts (ERC-7579 Compatible)

Four contracts deployed via Foundry:

| Contract | Role |
|----------|------|
| `BastionFirewall` | ERC-7579 validator module. Gates agent UserOperations through `validateUserOp()` |
| `BastionPolicy` | Per-agent rules: target allowlists, value limits, rate limits, cooldowns |
| `BastionAudit` | Immutable on-chain audit log with EIP-712 typed data |
| `BastionRegistry` | Directory of agents, targets, and verified contracts |

Chain support: Base, Ethereum mainnet, Polygon, Arbitrum.

### midnight/ — Compact ZK Contracts

Privacy-preserving security middleware for Midnight Network. Uses Midnight's Compact language for:

- `audit.compact` — ZK-proven audit log (proves compliance ran without revealing transaction contents)
- `policy.compact` — Policy engine with private state
- `registry.compact` — Agent and target directory

## Data Flow

### Transaction Evaluation Flow

```
Agent
  │
  ├──1. Submit transaction──▶ Chain-specific adapter
  │                              │
  │                              ├── Solana: Anchor CPI
  │                              ├── EVM: ERC-7579 validateUserOp
  │                              └── Midnight: Compact contract
  │                              │
  │                    2. Normalize to ──▶ NormalizedTransaction
  │                        NormalizedTx      │
  │                                          ▼
  │                               PolicyEvaluator::evaluate()
  │                                          │
  │                                    ┌─────┴─────┐
  │                                    ▼           ▼
  │                              FirewallDecision  AuditRecord
  │                                    │
  │                          ┌─────────┼─────────┐
  │                          ▼         ▼         ▼
  │                        Pass      Block    PendingHITL
  │                          │         │         │
  │                          │         │         ▼
  │                          │         │    Human approval
  │                          │         │    (override endpoint)
  │                          │         │
  └──3. Result returned◀─────┴─────────┘
```

## Security Model

Bastion protects against six threat actor classes:

1. **Compromised agent** — LLM manipulated, firewall is last line of defense
2. **Malicious operator** — on-chain policy lives where operator can't modify it
3. **Policy bypass** — aggregate behavioral analysis, sliding window counters
4. **Intent observer** (Midnight) — ZK privacy prevents strategy extraction
5. **Cross-chain correlator** (Midnight) — randomized delays, batching
6. **Governance attacker** — time-locked multisig policy upgrades

For the full threat model, see `docs/THREAT_MODEL.md` (forthcoming).

## Cross-Chain Coherence

Bastion achieves cross-chain policy coherence through:

- **NormalizedTransaction** — single canonical format across all chains
- **PolicyEvaluator** — single evaluation logic, four chain adapters
- **crates/sidecar** — HTTP bridge for non-Rust chains to access the Rust evaluator
- **ERC-8004** — canonical agent identity anchor across chains (forthcoming)

## Repository Structure

```
bastion/
├── crates/            ← Rust workspace
│   ├── core/          ← Chain-agnostic types + policy engine
│   ├── sidecar/       ← Off-chain evaluator HTTP service
│   └── solana/        ← Anchor on-chain program
├── evm/               ← Solidity contracts (Foundry)
├── midnight/          ← Compact ZK contracts
├── apps/web/          ← React compliance dashboard (Vite + Tailwind)
├── packages/sdk/      ← TypeScript SDK
└── docs/              ← Architecture, threat model, contribution guide
```

## Technology Stack

| Layer | Solana | EVM | Midnight |
|-------|--------|-----|----------|
| Language | Rust (Anchor 0.30) | Solidity 0.8.28 | Compact (TypeScript) |
| Framework | Anchor | Foundry | Midnight SDK |
| Middleware | Axum (Rust) | Sidecar HTTP | Sidecar HTTP |
| SDK | @bastion/sdk (TS) | ethers.js / viem | @midnight-js |
| Dashboard | React 18 + Vite | Same | Same |

## Agent Delegation System

Bastion supports hierarchical agent delegation — parent agents spawn sub-agents with delegated authority.

### Delegation Flow

```
  POST /agents (parent registration)
       │
       ▼
  AgentStore.register_agent(did, authority, capabilities)
       │
       ├── Parent agent stored in tree root
       │
       ▼
  POST /agents/:did/delegate (spawn sub-agent)
       │
       ├── Validates: parent exists, depth < 3, capabilities ⊆ parent
       │
       ▼
  AgentStore stores child with parent_did = parent.did
       │
       ▼
  Dashboard: AgentFloor shows parent-child hierarchy
  GET /agents: flat list with delegation depth filter
  GET /agents/:did/tree: full delegation tree
```

### Data Model

```
TrackedAgent {
    did, authority, agent_pda, name
    capability_bitmask, reputation_score
    parent_did: Option<String>        ← null for root agents
    delegation_depth: u8              ← 0=root, 1=sub, 2=sub-sub
    delegated_capabilities: Vec       ← subset of parent caps
    delegation_budget: Option<u64>    ← lamport ceiling
    delegation_spent: u64             ← running counter
    delegation_expires_at: Option<i64> ← unix timestamp
    child_dids: Vec<String>           ← children list
}
```

### Policy Constraints

- **Max depth**: 3 levels (root → sub → sub-sub)
- **Capability inheritance**: child must be subset of parent
- **Budget enforcement**: sidecar tracks delegation_spent ≤ delegation_budget
- **Expiry**: optional timestamp, evaluated at policy check time

### Security

- Only parent can revoke its own delegations
- Revocation invalidates all sub-delegations under the revoked child
- API key auth required for mutating delegation endpoints
- Audit trail records all delegation lifecycle events
