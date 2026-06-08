# Bastion Agent Delegation System

> Parent agents spawn sub-agents with delegated authority. Sub-agents inherit a capability subset, have budget limits, and can be revoked. Max delegation depth: 3 levels.

## Overview

Bastion's delegation system enables hierarchical agent management. A **parent agent** can authorize **sub-agents** to operate under its authority with a restricted set of capabilities. This is critical for:

- **Fleet orchestration**: one trading bot spawns sub-bots for individual markets
- **Delegated risk management**: parent sets budget ceiling per sub-agent
- **Compliance**: audit trail traces through delegation chain back to root authority

## Architecture

```
Root Agent (DID: solana:abc...)
  │ capability_bitmask: 0b00000011 (TRANSFER | SWAP)
  │ delegation_depth: 0
  │
  ├── Sub-Agent 1 (DID: solana:def...)
  │     │ capability_bitmask: 0b00000001 (TRANSFER only)
  │     │ delegation_depth: 1
  │     │ delegation_budget: 5 SOL
  │     │
  │     └── Sub-Sub-Agent 1a (DID: solana:ghi...)
  │           delegation_depth: 2
  │           delegation_budget: 1 SOL
  │
  └── Sub-Agent 2 (DID: solana:jkl...)
        capability_bitmask: 0b00000010 (SWAP only)
        delegation_depth: 1
        delegation_budget: 10 SOL
```

## Data Model

### TrackedAgent (`crates/sidecar/src/agents.rs`)

```rust
pub struct TrackedAgent {
    // Core identity
    pub did: String,
    pub authority: String,
    pub agent_pda: String,
    pub name: String,

    // Capabilities
    pub capability_bitmask: u64,
    pub reputation_score: u64,
    pub registered_at: i64,

    // Delegation
    pub parent_did: Option<String>,
    pub delegation_depth: u8,
    pub delegated_capabilities: Vec<String>,
    pub delegation_budget: Option<u64>,
    pub delegation_spent: u64,
    pub delegation_expires_at: Option<i64>,
    pub is_delegator: bool,
    pub child_dids: Vec<String>,

    // Metadata
    pub sidecar_endpoint: Option<String>,
    pub on_chain_verified: bool,
}
```

### DelegationPolicy

```json
{
  "max_depth": 3,
  "capability_inheritance": "subset",
  "allowed_child_capabilities": ["TRANSFER", "SWAP"],
  "max_child_budget_sol": 10,
  "require_parent_approval_above_sol": 5
}
```

### DelegationTree

```json
{
  "agent": { ... },
  "children": [
    {
      "agent": { ... },
      "children": []
    }
  ],
  "delegation_depth": 0,
  "delegation_budget": null,
  "delegation_spent": 0,
  "delegation_expires_at": null
}
```

## API Reference

### Register Agent (with optional parent)

```
POST /agents
X-Api-Key: <key>
Content-Type: application/json
```

**Flat registration:**
```json
{
  "did": "did:bastion:solana:AgentPDA1111111111111111111111111111",
  "authority_pubkey": "11111111111111111111111111111111",
  "sidecar_endpoint": null
}
```

**Delegated registration (as sub-agent):**
```json
{
  "did": "did:bastion:solana:SubAgentPDA2222222222222222222222",
  "authority_pubkey": "22222222222222222222222222222222",
  "parent_did": "did:bastion:solana:ParentAgentPDA1111111",
  "delegation_depth": 1,
  "delegated_capabilities": ["TRANSFER"],
  "delegation_budget_sol": 5,
  "delegation_expires_at": 1719792000
}
```

### Spawn Sub-Agent

```
POST /agents/:did/delegate
X-Api-Key: <key>
```

```json
{
  "child_did": "did:bastion:solana:NewSubAgent3333333333333",
  "child_name": "MarketMonitorBot",
  "delegated_capabilities": ["TRANSFER"],
  "delegation_budget_sol": 5,
  "delegation_expires_at": 1719792000
}
```

### Revoke Delegation

```
DELETE /agents/:did/delegation/:child_did
X-Api-Key: <key>
```

### List Children

```
GET /agents/:did/children
```

Response:
```json
{
  "parent_did": "did:bastion:solana:Parent...",
  "children": [ ... ],
  "depth": 0,
  "child_count": 3
}
```

### Full Delegation Tree

```
GET /agents/:did/tree
```

Returns full `DelegationTree` with nested children.

## SDK Usage

### TypeScript (`@bastion-agentique/sdk`)

```typescript
import { BastionClient, AGENT_CAPABILITIES } from "@bastion-agentique/sdk";

const client = new BastionClient({ connection });

// 1. Register parent agent
await client.registerAgent(
  parentWallet,
  "TradingOrchestrator",
  AGENT_CAPABILITIES.TRANSFER | AGENT_CAPABILITIES.SWAP | AGENT_CAPABILITIES.DELEGATE
);

// 2. Self-register to sidecar
await fetch("https://bastion-agentique.fly.dev//agents", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Api-Key": "your-api-key"
  },
  body: JSON.stringify({
    did: parentDID,
    authority_pubkey: parentAuthority.toBase58(),
    is_delegator: true
  })
});

// 3. Spawn sub-agent
await client.delegateAgent(
  parentWallet,
  "MarketBot-ETH",
  AGENT_CAPABILITIES.TRANSFER,     // restricted: TRANSFER only
  Math.floor(Date.now() / 1000) + 86400  // expires in 24h
);

// 4. Fetch delegation tree
const tree = await client.fetchAgentTree(parentAuthority);
console.log(`Delegation depth: ${tree.delegation_depth}`);
tree.children.forEach(child => {
  console.log(`  Sub-agent: ${child.agent.name}`);
});

// 5. Revoke delegation
await client.revokeDelegation(parentWallet, childAuthority);
```

## Policy Constraints

### Max Depth: 3
```
Root (depth 0) → Sub-agent (depth 1) → Sub-sub-agent (depth 2)
```

Depth 3 is not permitted. Attempting to delegate beyond depth 2 returns `MaxDelegationDepth` error.

### Capability Inheritance
Child capabilities MUST be a **subset** of parent capabilities:
- Parent has `TRANSFER | SWAP | DELEGATE` → Child can have `TRANSFER` or `SWAP` but NOT `STAKE`
- Capability check validates: `child_bitmask & !parent_bitmask == 0`

### Budget Enforcement
- Parent sets `delegation_budget` per child (in lamports)
- Sidecar tracks `delegation_spent` incrementally
- Transaction that would exceed budget is blocked

### Expiry
- Optional `delegation_expires_at` timestamp
- Expired delegations are treated as inactive
- Expiry check happens at policy evaluation time

## Security Considerations

### Authority Verification
- Only the parent agent can revoke its own delegations
- `revoke_delegation` validates `caller_authority == parent.authority`

### Depth Limiting
- Prevents infinite delegation chains
- Hard limit of 3 levels (depth 0-2)

### Revocation Guarantees
- Revoked sub-agents are immediately inactive
- All further delegations under the revoked sub-agent are invalidated
- Audit trail records revocation event

### In-Memory Caveat (MVP)
- `AgentStore` is in-memory only (`RwLock<HashMap>`)
- Agents lost on sidecar restart
- Production deployment should persist to Sled DB

## Future: On-Chain Delegation

The current MVP implements delegation entirely in the sidecar (off-chain). Future on-chain support requires:

1. **Anchor Program Changes:**
   - New `delegate_agent` instruction
   - Delegated Agent PDA seeds: `["agent_delegated", parent_authority, nonce]`
   - On-chain budget tracking and expiry enforcement

2. **Sidecar Sync:**
   - `OnChainClient.fetch_agent()` — read Agent PDA data
   - `AgentStore.sync_from_chain()` — periodic sync of on-chain state
   - `AgentStore.register_agent()` — verify Agent PDA exists on-chain before registering

3. **Policy Engine:**
   - `DelegationConstraint` rule type
   - Budget-aware transaction validation
   - Chain-of-authority walking for policy inheritance

## Deployment Notes

### Current (Sidecar-Only MVP)
- No Anchor program changes required
- In-memory AgentStore
- API key auth on mutating endpoints
- Dashboard: hierarchy view with flat data
- Deploy: `HELIUS_API_KEY=... BASTION_API_KEY=... cargo run --release`

### Future (On-Chain)
- Requires Anchor program rebuild + redeploy
- New Rust structures: `DelegatedAgent`, `DelegationPolicy`
- New SDK methods associated with the on-chain program
- Rebuild: `cargo build-sbf && solana program deploy --program-id ...`

## Staking & Stake-Weighted Policy

### AgentStake PDA

Agents stake SOL to an `AgentStake` PDA for higher transaction limits:
- Seeds: `["agent_stake", authority]`
- 48h minimum before first unstake
- 7-day unstake cooldown (stake still counts during cooldown)
- Max multiplier cap: 10x, floor: 0.1x

### Depth Decay

Stake weight decays with delegation depth:
- Depth 0 (root): 100% stake weight
- Depth 1 (sub-agent): 50% stake weight
- Depth 2 (sub-sub): 25% stake weight
- Formula: `max_delegation = staked * (1 / 2^depth)`

### StakeWeighted Policy

Effective limit: `base_limit * (1 + stake/min_stake * multiplier) * decay^depth`, capped at `base_limit * MAX_STAKE_MULTIPLIER (10)`, floored at `base_limit * 0.1`.

### Instructions

| Instruction | Description |
|------------|-------------|
| `stake_lamports` | Deposit SOL into AgentStake PDA |
| `request_unstake` | Start 7-day cooldown |
| `claim_unstake` | Withdraw SOL after cooldown |
| `slash_stake` | Authority-only: slash misbehaving agent's stake |
