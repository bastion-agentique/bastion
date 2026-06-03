# Bastion Audit Log

> Structured event schema for tracking agent lifecycle and delegation events through the Bastion audit trail.

## Event Schema

Every audit event in Bastion follows this schema:

```json
{
  "timestamp": "2026-06-04T12:00:00Z",
  "event_type": "agent_registered",
  "actor_did": "did:bastion:solana:ActorPDA...",
  "actor_authority": "Base58Pubkey...",
  "parent_did": null,
  "child_did": null,
  "metadata": {},
  "transaction_signature": null,
  "result": "ALLOWED"
}
```

## Event Types

### Agent Lifecycle

| Event Type | Trigger | Metadata |
|------------|---------|----------|
| `agent_registered` | Agent self-registers via POST /agents | `{ name, capability_bitmask, sidecar_endpoint }` |
| `agent_verified` | On-chain Agent PDA verified | `{ agent_pda, verified_at }` |
| `agent_deactivated` | Agent deactivated by admin | `{ reason }` |

### Delegation Lifecycle

| Event Type | Trigger | Metadata |
|------------|---------|----------|
| `delegation_created` | Parent spawns sub-agent | `{ parent_did, child_did, delegated_capabilities, budget, expires_at }` |
| `delegation_revoked` | Parent revokes sub-agent | `{ parent_did, child_did, revoked_by }` |
| `delegation_expired` | Delegation reaches expiry timestamp | `{ parent_did, child_did, expired_at }` |
| `delegation_budget_exceeded` | Sub-agent exceeds budget | `{ parent_did, child_did, budget, spent, exceeded_by }` |

### Transaction Lifecycle

| Event Type | Trigger | Metadata |
|------------|---------|----------|
| `transaction_simulated` | Agent sends tx to /simulate | `{ transaction_id, intent, simulation_result }` |
| `transaction_allowed` | Tx passes all policy checks | `{ transaction_id, policy_rules_passed }` |
| `transaction_blocked` | Tx fails policy check | `{ transaction_id, policy_rule_violated, block_id }` |
| `transaction_overridden` | HITL override approves/rejects | `{ block_id, action, overridden_by }` |

### Sub-Agent Transaction

```json
{
  "timestamp": "2026-06-04T12:00:00Z",
  "event_type": "sub_agent_transaction",
  "actor_did": "did:bastion:solana:SubAgentPDA...",
  "actor_authority": "SubAgentPubkey...",
  "parent_did": "did:bastion:solana:ParentAgentPDA...",
  "metadata": {
    "transaction_id": "tx-abc-123",
    "amount": 500000000,
    "currency": "SOL",
    "budget_remaining": 4500000000,
    "delegation_depth": 1,
    "policy_rules_applied": ["AmountLimit", "TxTypeAllowlist"]
  },
  "transaction_signature": "5i7KcH...abc",
  "result": "ALLOWED"
}
```

### Policy Violation

```json
{
  "timestamp": "2026-06-04T12:01:00Z",
  "event_type": "policy_violation",
  "actor_did": "did:bastion:solana:SubAgentPDA...",
  "actor_authority": "SubAgentPubkey...",
  "parent_did": "did:bastion:solana:ParentAgentPDA...",
  "metadata": {
    "transaction_id": "tx-def-456",
    "violation": "DelegationBudgetExceeded",
    "budget": 5000000000,
    "spent": 4800000000,
    "attempted": 1000000000,
    "block_id": "uuid-for-override"
  },
  "transaction_signature": null,
  "result": "BLOCKED"
}
```

### Circuit Breaker

| Event Type | Trigger | Metadata |
|------------|---------|----------|
| `circuit_breaker_engaged` | Admin pauses protocol | `{ paused_by, paused_at }` |
| `circuit_breaker_disengaged` | Admin resumes protocol | `{ resumed_by, resumed_at, pause_duration_seconds }` |

## Audit Trail Query

### Filter by Agent DID
```
GET /agents/:did/audit?limit=50&offset=0
```

Returns audit entries where `actor_did` or `actor_authority` matches the agent.

### Filter by Delegation Chain
```
GET /logs?transaction_id=<parent_authority>&result=ALL
```

Walk the chain: parent → children → grandchildren.

### Filter by Event Type
```
GET /logs?event_type=delegation_revoked&limit=100
```

## Storage

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Local | Sled DB | Fast query, local dashboard |
| On-chain | Anchor PDA | Immutable, verifiable |

## Integrity

- Each audit entry is JSON-serialized before storage
- Sled DB flushed every 10 seconds (background task)
- On-chain entries use EIP-712 typed data for EVM, raw PDA storage for Solana
- No cryptographic chaining between entries (MVP)
- Future: Merkle tree of entries for tamper-evidence

## Example: Full Delegation Lifecycle

```
T+0s   [agent_registered]      RootBot registered with DID: solana:root
T+10s  [agent_registered]      SubBot-ETH registered as child of RootBot
T+10s  [delegation_created]    RootBot spawned SubBot-ETH (TRANSFER, 5 SOL budget)
T+30s  [sub_agent_transaction] SubBot-ETH transferred 0.1 SOL → ALLOWED
T+31s  [sub_agent_transaction] SubBot-ETH transferred 0.5 SOL → ALLOWED
...
T+3600s [delegation_budget_exceeded] SubBot-ETH attempted 5.5 SOL transfer → BLOCKED
T+3601s [transaction_blocked]   Budget violation, block_id: uuid-789
T+3602s [delegation_revoked]    RootBot revoked SubBot-ETH delegation
T+3602s [agent_deactivated]     SubBot-ETH deactivated
```
