# Bastion Architecture

Bastion Agentic Defense is security middleware for autonomous AI agents operating on blockchain infrastructure and Web2 API ecosystems. It provides a transaction firewall, a Web2 API proxy firewall, a programmable policy engine, and an immutable audit layer deployed across Solana, EVM chains, and Midnight Network.

> Alpha software. Bastion is in active development and not yet production hardened. Use with caution.

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
│  │ crates/core  │   │   SDK + Web2  │   │  Dashboard (React)   │ │
│  │ (chain-agn.) │   │  (TypeScript) │   │  (apps/web)           │ │
│  └──────┬───────┘   └──────────────┘   └──────────────────────┘ │
│         │                                                        │
│    ┌────┴─────────────────────────────┐                          │
│    ▼                                  ▼                          │
│  ┌──────────────┐               ┌────────────────────┐          │
│  │crates/sidecar│               │crates/web2-firewall│          │
│  │(Solana/tx)   │               │(Web2 API proxy)    │          │
│  └──────┬───────┘               └────────────────────┘          │
│         │                                                        │
│    ┌────┴──────────────────────────┐                             │
│    ▼                               ▼                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                       │
│  │ Solana   │  │   EVM    │  │ Midnight │                       │
│  │ (Anchor) │  │(Solidity)│  │ (Compact)│                       │
│  └──────────┘  └──────────┘  └──────────┘                       │
│                                                                  │
│  ┌───────────────────────────────────────────────┐              │
│  │ crates/correlation (SIEM event correlation)   │              │
│  └───────────────────────────────────────────────┘              │
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

An Axum HTTP server that exposes the policy evaluator as a REST API. This is the bridge that lets non-Rust chain implementations (EVM, Midnight) access the Rust policy engine. Also serves as the host for Web2 proxy endpoints, MCP reverse proxy, agent registry, case management, DID resolution, and robot telemetry.

**Key endpoints:** `/simulate`, `/api/v2/simulate-evm`, `/api/v2/evaluate`, `/events` (SSE), `/agents`, `/policy`, `/circuit-breaker`, `/cases`, `/ingest`, `/did/resolve`, `/robots/:did/telemetry`, `/token-balances`, `/mcp/*` (reverse proxy).

### crates/web2-firewall — Web2 API Proxy Firewall

A new crate providing a proxy engine that evaluates AI agent HTTP API calls against policy rules before forwarding to target providers. Shares the chain-agnostic policy engine trait from bastion-core.

**Key types:**
- `ApiEvent` — normalized API call (method, URL, headers, body, provider, agent_id, timestamp)
- `ProxyDecision` — Pass, Block, PendingHITL, LogOnly (maps to FirewallDecision)
- `ApiPolicyRule` — EndpointAllowlist, EndpointBlocklist, ProviderBudget, RateLimit, ContentInspection, HeaderFilter, CostCap, TimeOfDayRestriction
- `OpenApiSpec` — parses OpenAPI 3.0 specs, generates auto-configured allowlist rules
- `ProxyEngine` — evaluates ApiEvents against rules, detects providers from URL patterns

**Provider adapters:** OpenAI, Stripe, Slack, GitHub (factory pattern via `ProviderAdapter` trait).

### crates/correlation — SIEM Correlation Engine

Sliding time window event correlation engine. Matches sequences of SecurityEvents against YAML-defined correlation rules. Integrates with GrondOSINT for threat context enrichment and MITRE ATT&CK mapping for Web3 and ICS categories.

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

Six contracts deployed via Foundry:

| Contract | Role |
|----------|------|
| `BastionFirewall` | ERC-7579 validator module. Gates agent UserOperations through `validateUserOp()` |
| `BastionPolicy` | Per-agent rules: target allowlists, value limits, rate limits, cooldowns |
| `BastionAudit` | Immutable on-chain audit log with EIP-712 typed structured data |
| `BastionRegistry` | Directory of agents, targets, and verified contracts |
| `BastionERC8004Registry` | ERC-8004 agent identity (ERC-721 soulbound token + EIP-712 wallet binding) |
| `BastionSidecar` | Oracle request/fulfill pattern for off-chain simulation |

Chain support: Celo, Base, Ethereum mainnet, Polygon. ~54 Foundry tests.

### midnight/ — Compact ZK Contracts

Privacy-preserving security middleware for Midnight Network. Uses Midnight's Compact language for:

- `audit.compact` — ZK-proven audit log (proves compliance ran without revealing transaction contents)
- `policy.compact` — Policy engine with private state
- `registry.compact` — Agent and target directory

## Data Flow

### Transaction Evaluation Flow (Blockchain)

```
Agent
  │
  ├──1. Submit transaction──▶ Chain-specific adapter
  │                              │
  │                              ├── Solana: Anchor CPI → /simulate
  │                              ├── EVM: /api/v2/simulate-evm (eth_call)
  │                              └── Midnight: Compact contract
  │                              │
  │                    2. Policy check ──▶ PolicyEngine (crates/core)
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
  │                          │         │    (POST /override)
  │                          │         │
  └──3. Result returned◀─────┴─────────┘
```

### Web2 API Proxy Flow

```
Agent (LangChain, CrewAI, Vercel AI SDK)
  │
  ├──1. HTTP call──▶ BastionWeb2Client (packages/web2-sdk)
  │                    │
  │                    ▼
  │              ProxyEngine::evaluate(ApiEvent)
  │                    │
  │              ┌─────┴─────┐
  │              ▼           ▼
  │        ProxyDecision    Sled Audit Log
  │              │
  │    ┌─────────┼─────────┐
  │    ▼         ▼         ▼
  │  Pass      Block    PendingHITL
  │    │         │         │
  │    ▼         ▼         ▼
  │  Forward   403 /    Human
  │  to API    reject   approval
  │
  └──2. Response returned to agent
```

### Event Ingestion Flow (SIEM)

```
Any source (CloudTrail, GitHub webhook, syslog, OJK stream, robot telemetry)
  │
  ▼
POST /ingest ──▶ SecurityEvent (crates/core)
  │
  ├──▶ Sled DB (local audit)
  ├──▶ CorrelationEngine (cross-event pattern matching)
  ├──▶ GrondOSINT (threat enrichment)
  └──▶ On-chain Anchor audit (optional, enterprise tier)
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
├── crates/                  ← Rust workspace
│   ├── core/                ← Chain-agnostic types + policy engine (SecurityEvent, FirewallDecision, PolicyRule)
│   ├── sidecar/             ← Axum HTTP server (simulation, agents, DID, cases, events, MCP proxy, telemetry)
│   ├── web2-firewall/       ← Web2 API proxy engine (ApiEvent, ProxyDecision, ApiPolicyRule, OpenApiSpec, ProviderAdapter)
│   ├── correlation/         ← SIEM correlation engine (sliding window, YAML rules, MITRE ATT&CK mapping)
│   └── solana/programs/     ← Anchor on-chain program (bastion-audit)
├── evm/                     ← Solidity contracts (Foundry, 6 contracts, ~54 tests)
├── midnight/                ← Compact ZK contracts (audit, policy, registry)
├── apps/web/                ← React compliance dashboard (Vite + TailwindCSS)
├── packages/
│   ├── sdk/                 ← @bastion-agentique/sdk (TypeScript, on-chain + sidecar clients, 6 tests)
│   └── web2-sdk/            ← @bastion-agentique/web2-sdk (TypeScript, BastionWeb2Client, 9 tests)
├── .agents/skills/          ← 48 agent skills (blockchain forensics, compliance, DeFi security, Web2 firewall)
├── docs/                    ← Architecture, roadmap, expansion plans, PRDs
├── config.toml              ← Sidecar policy configuration
├── Cargo.toml               ← Rust workspace manifest
├── pnpm-workspace.yaml      ← pnpm monorepo config
└── docker-compose.yml       ← Docker compose for sidecar + MCP
```

## Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| **Rust Sidecar** | Rust (edition 2024), Axum, Tokio, Sled | 1.85+ |
| **Rust Core** | serde, thiserror, uuid, async-trait | 0.1.0 |
| **Rust Web2 Firewall** | bastion-web2-firewall, http, url, reqwest | 0.1.0 |
| **Rust Correlation** | bastion-correlation | - |
| **Solana On-Chain** | Anchor, solana-program, borsh | 0.30.1 / 1.18 / 1 |
| **EVM Contracts** | Solidity, Foundry, OpenZeppelin, Solady | 0.8.28 |
| **Midnight ZK** | Compact, @midnight-ntwrk/midnight-js | 0.1.0 |
| **Dashboard** | React, Vite, TailwindCSS, TypeScript | 18 / 5 / 3.4 / 5 |
| **SDK** | TypeScript, Anchor, @solana/web3.js | 5 / 0.30.1 / 1.91 |
| **Web2 SDK** | TypeScript, BastionWeb2Client | 5 / 0.1.0 |
| **MCP Server** | TypeScript, @modelcontextprotocol/sdk, SSE | - |
| **Payments** | x402 (Solana), pay.sh | - |
| **CI/CD** | GitHub Actions, Netlify, Vercel, Fly.io, Docker | - |

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
