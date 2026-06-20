# Bastion Audit Anchor Program Spec

Program ID: `A29V5MUVs73y7XBHHxPpPcAW7h4gGHupbDdwYSwA2n9D`
Cluster: Solana devnet
Anchor version: 0.30.1
Solana SDK: 1.18

## Instructions

### 1. initialize(authority: Pubkey)

Creates the master `AuditState` PDA.

**Accounts:**
| Account | Signer | Writable | Description |
|---------|--------|----------|-------------|
| authority | Yes | No | Program authority |
| audit_state | No | Yes | PDA seeded with `b"audit_state"` |

**PDA Seeds:** `["audit_state"]`
**PDA Size:** 65 bytes (8 discriminator + 32 authority + 8 counter + 8 allowed + 8 blocked + 1 paused)
**Constraints:** audit_state must not already exist.

### 2. log_audit(decision: u8, simulation_hash: [u8;32], reasoning: String)

Records an immutable audit entry.

**Accounts:**
| Account | Signer | Writable | Description |
|---------|--------|----------|-------------|
| agent_authority | Yes | No | Agent signing the audit |
| audit_state | No | Yes | Master state |
| audit_entry | No | Yes | PDA seeded with `[audit_state.key, counter.to_le_bytes()]` |

**PDA Seeds:** `[audit_state.key().as_ref(), &audit_state.counter.to_le_bytes()]`
**Constraints:** Protocol must not be paused. Counter increments after write.
**Events:** None (audit entry itself is the record).

### 3. register_agent(name: String, capability_bitmask: u64)

Registers a new agent on-chain.

**Accounts:**
| Account | Signer | Writable | Description |
|---------|--------|----------|-------------|
| authority | Yes | No | Agent authority key |
| agent | No | Yes | PDA seeded with `[b"agent", authority.key]` |
| audit_state | No | No | Read-only reference |

**PDA Seeds:** `["agent", authority.key().as_ref()]`
**PDA Size:** ~120 bytes (8 + 32 + 32 + 4+len + 8 + 8)

**Events:** `AgentRegistered { authority, name, capability_bitmask }`

### 4. update_agent_reputation(delta: i64)

Adjusts agent reputation score.

**Accounts:**
| Account | Signer | Writable | Description |
|---------|--------|----------|-------------|
| authority | Yes | No | Agent authority |
| agent | No | Yes | Agent PDA |

**Constraints:** New score must be in [0, 100]. Clamps otherwise.
**Events:** `ReputationUpdated { authority, new_score, delta }`
**Errors:** `InvalidReputation` if delta pushes score outside bounds.

### 5. set_policy(allowed_programs: Vec<Pubkey>, max_sol: u64, rate_limit: u64)

Sets or overwrites the on-chain policy.

**Accounts:**
| Account | Signer | Writable | Description |
|---------|--------|----------|-------------|
| authority | Yes | No | Program authority |
| policy | No | Yes | PDA seeded with `[b"policy"]` |

**PDA Seeds:** `["policy"]`

### 6. emergency_pause

Pauses all agent transactions.

**Accounts:**
| Account | Signer | Writable | Description |
|---------|--------|----------|-------------|
| authority | Yes | No | Program authority |
| audit_state | No | Yes | Master state |

**Constraints:** Must not already be paused.
**Errors:** `AlreadyPaused`
**Events:** `ProtocolPaused { authority }`

### 7. emergency_resume

Resumes operations.

**Accounts:**
| Account | Signer | Writable | Description |
|---------|--------|----------|-------------|
| authority | Yes | No | Program authority |
| audit_state | No | Yes | Master state |

**Constraints:** Must currently be paused.
**Errors:** `NotPaused`
**Events:** `ProtocolResumed { authority }`

## Accounts

### AuditState
```rust
pub struct AuditState {
    pub authority: Pubkey,      // 32 bytes
    pub counter: u64,           // 8 bytes
    pub allowed_count: u64,     // 8 bytes
    pub blocked_count: u64,     // 8 bytes
    pub is_paused: bool,        // 1 byte
}
```

### AuditEntry
```rust
pub struct AuditEntry {
    pub agent: Pubkey,          // 32 bytes
    pub decision: u8,           // 1 byte (0=Pass, 1=Block, 2=PendingHITL)
    pub simulation_hash: [u8;32], // 32 bytes
    pub reasoning: String,      // 4 + len bytes
    pub timestamp: u64,         // 8 bytes
}
```

### Agent
```rust
pub struct Agent {
    pub authority: Pubkey,      // 32 bytes
    pub name: String,           // 4 + len bytes
    pub capability_bitmask: u64, // 8 bytes
    pub reputation_score: u64,  // 8 bytes
}
```

### Policy
```rust
pub struct Policy {
    pub allowed_programs: Vec<Pubkey>,  // 4 + len * 32
    pub max_sol: u64,                   // 8 bytes
    pub rate_limit: u64,                // 8 bytes
}
```

## Errors

| Error | Code | Meaning |
|-------|------|---------|
| InvalidReputation | 6000 | Reputation delta pushes score outside [0, 100] |
| NotPaused | 6001 | Tried to resume while not paused |
| IsPaused | 6002 | Tried to execute while paused |
| AlreadyPaused | 6003 | Tried to pause while already paused |
| Unauthorized | 6004 | Signer != authority |

## Events

| Event | Fields |
|-------|--------|
| AgentRegistered | authority: Pubkey, name: String, capability_bitmask: u64 |
| ReputationUpdated | authority: Pubkey, new_score: u64, delta: i64 |
| ProtocolPaused | authority: Pubkey |
| ProtocolResumed | authority: Pubkey |
