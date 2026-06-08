# Midnight Bastion — Technical Specification

**Version:** 0.1.0  
**Chain:** Midnight Network  
**Language:** Compact (ZK circuits) + TypeScript SDK + Rust middleware

---

## Overview

Midnight Bastion is a ZK-privacy security middleware for autonomous AI agents on the Midnight Network. It enforces agent transaction policies and maintains a verifiable audit trail without leaking sensitive operational data.

Unlike the EVM and Solana variants where all data is public, Midnight Bastion uses Midnight's selective disclosure architecture to:

- Prove an agent is registered without revealing its identity
- Enforce policy rules without revealing the policy contents
- Log auditable events without exposing agent operations
- Allow selective disclosure to authorized compliance reviewers

---

## Problem

AI agents are increasingly executing high-value on-chain transactions autonomously. Two competing requirements:

1. **Security**: Every agent action must be auditable and policy-gated
2. **Privacy**: Agent strategies, transaction volumes, and identities must remain confidential

Public blockchains solve (1) but destroy (2). Midnight solves both simultaneously.

---

## Architecture

```
Agent ──request──> Bastion Middleware (Rust Axum)
                          │
                    Policy Check
                          │
                    ZK Proof Generation (via midnight-js)
                          │
              ┌───────────┴───────────┐
              │                       │
         Compact Contracts      Audit Commitment
         (Midnight Network)
              │
   ┌──────────┼──────────┐
   │          │          │
Registry   Policy     Audit
Contract  Contract   Contract
```

The middleware is an off-chain enforcer. It:
1. Receives an agent transaction request
2. Checks it against the cached policy
3. Generates a ZK proof of compliance
4. Submits the proof + audit commitment to Midnight contracts
5. Returns allow/block to the agent

---

## Privacy Model

### What is PUBLIC

- Agent registration (commitment only, not identity)
- Whether a transaction was allowed or blocked (boolean)
- Audit entry existence (commitment hash)
- Timestamp of audit entries

### What is PRIVATE (ZK-protected)

- Agent wallet address
- Target contract address
- Transaction value
- Selector / function called
- Policy parameters (limits, allowlists)
- Audit entry contents (unless selectively disclosed)

### Selective Disclosure

Authorized parties (e.g., a compliance reviewer) can request disclosure of specific audit entries. The agent or operator presents a ZK proof that reveals only the requested fields without exposing others.

---

## Contracts

### Registry (`contract/registry.compact`)

Maintains agent and target directories as ZK commitments.

**Ledger state:**
- `agents: StateMap<Field, Field>` — agentId => commitment
- `targets: StateMap<Field, TargetInfo>` — targetId => public target info
- `agentCount: Counter`
- `targetCount: Counter`
- `isPaused: Cell<Boolean>`

**Circuits:**
- `registerAgent(agentId, commitment)` — enroll agent with ZK identity commitment
- `deactivateAgent(agentId, ownerProof)` — deactivate with owner proof
- `registerTarget(targetId, name)` — register a target (public)
- `verifyTarget(targetId, adminProof)` — admin verification of target
- `pause(adminProof)` / `resume(adminProof)` — emergency pause

### Policy (`contract/policy.compact`)

Stores per-agent policy as ZK commitments. Policy contents are never exposed on-chain.

**Ledger state:**
- `policies: StateMap<Field, Field>` — agentId => policyCommitment
- `policyCount: Counter`

**Circuits:**
- `setPolicy(agentId, policyCommitment, ownerProof)` — set policy commitment
- `removePolicy(agentId, ownerProof)` — remove policy
- `verifyCompliance(agentId, txProof)` — verify a transaction proof matches the committed policy

### Audit (`contract/audit.compact`)

Append-only ZK-private audit trail. Entries are stored as commitments.

**Ledger state:**
- `entries: StateMap<Field, AuditCommitment>` — entryId => commitment
- `agentEntryCount: StateMap<Field, Counter>` — agentId => entry count
- `totalCount: Counter`

**Circuits:**
- `logEntry(entryId, agentId, commitment)` — record an audit commitment
- `discloseEntry(entryId, secret, viewerKey)` — selective disclosure to authorized party
- `proveEntryExists(entryId)` — prove an entry exists without revealing contents

---

## Middleware

Rust Axum server (`middleware/`). Responsibilities:

- Receive agent transaction requests via HTTP
- Fetch policy from cache (refreshed from Midnight contract)
- Run policy checks locally
- Generate ZK proofs via `@midnight-ntwrk/midnight-js` (called via Node subprocess)
- Submit proof + audit commitment to Midnight
- Return allow/block + proof hash to agent

### API Endpoints

```
POST /validate          — validate an agent transaction
GET  /policy/:agentId   — get current policy (redacted)
POST /register          — register a new agent
POST /pause             — emergency pause
POST /resume            — emergency resume
GET  /audit/:agentId    — get audit log (commitments only)
GET  /health            — health check
```

---

## SDK

TypeScript SDK (`sdk/`) — `@midnight-bastion/sdk`

```typescript
const client = new BastionMidnightClient({
  middlewareUrl: "https://bastion-agentique.fly.dev/",
  network: "testnet",
});

// Register an agent
await client.registerAgent({ name: "my-agent", secret: agentSecret });

// Set a policy
await client.setPolicy(agentId, {
  allowedTargets: [...],
  maxValuePerTx: 1000n,
  dailyTxLimit: 100,
  cooldownSeconds: 60,
}, ownerSecret);

// Validate a transaction (called by agent before executing)
const result = await client.validateTransaction(agentId, {
  target: "...",
  value: 100n,
  selector: "0xabcd1234",
});
// { allowed: true, proofHash: "0x..." }
```

---

## Build Club Application Fit

Midnight Bastion addresses the Build Club thesis directly:

- **Privacy-first**: All agent operations are ZK-private by default
- **Trust infrastructure**: Enables AI agents to operate with verifiable compliance
- **Technology**: Compact (ZK circuits), TypeScript, Rust — multi-stack
- **Market**: AI agent security is a fast-growing vertical (PayAI, AgentGuard, etc.)
- **Differentiation**: Only Midnight allows compliance proof without data exposure

---

## Roadmap

| Phase | Milestone |
|-------|-----------|
| v0.1.0 | Compact contracts (registry, policy, audit) |
| v0.2.0 | TypeScript SDK + middleware |
| v0.3.0 | React dashboard with Lace wallet |
| v0.4.0 | Selective disclosure UI for compliance reviewers |
| v1.0.0 | Mainnet deployment + Build Club demo |
