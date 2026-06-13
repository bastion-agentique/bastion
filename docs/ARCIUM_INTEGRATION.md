# Bastion + Arcium Integration

> Confidential computation for AI agent policy evaluation on Solana.

## Overview

Arcium is the Confidential Supercomputer on Solana, enabling trustless computation over fully confidential data powered by MPC. Integrating Arcium with Bastion enables:

1. **Confidential policy evaluation**, agents never see the policy rules they're being evaluated against
2. **Private agent identity**, ZK proofs of authorization without revealing which agent
3. **Sealed audit entries**, on-chain audit trail that's verifiable but only readable by authorized parties

## Architecture

```
Agent → Sidecar → Arcium MPC Circuit → FirewallDecision
                      ↑                       ↓
            (encrypted policy)         (encrypted result)
                      ↑                       ↓
            Policy stored on-chain      Result recorded on-chain
```

## Integration Points

| Bastion Component | Arcium Feature | Benefit |
|---|---|---|
| **Policy evaluation** | Arcis circuit | Policy rules are encrypted, agents only see the binary allow/block decision |
| **Agent identity** | X25519 key exchange | Agent proves authorization with Rescue cipher encryption |
| **Multi-agent operations** | Secret sharing | Fleet coordinates without revealing individual positions |
| **Audit trail** | Sealed computation | Audit entries are verifiable but only readable by authorized parties |
| **Risk oracle** | Confidential scoring | Address risk evaluated without exposing the scoring model |

## Implementation Plan

### Phase 1: Arcium Toolchain Setup

```bash
# Install Arcium SDK
curl -sSL https://arcup.helium-3.com | bash
arcup install

# Create new Arcium project
arcup new confidential-policy --type solana
cd confidential-policy
```

### Phase 2: Arcis Confidential Policy Circuit

Create `crates/arcium/circuits/policy_evaluator.rs`:

```rust
use arcium::{Enc, Mxe, Shared};

#[derive(Enc)]
pub struct ConfidentialTx {
    pub amount: Shared<u64>,
    pub destination: Shared<[u8; 32]>,
    pub tx_type: Shared<u8>,
}

#[derive(Enc)]
pub struct ConfidentialPolicy {
    pub max_per_tx: Shared<u64>,
    pub rate_limit: Shared<u32>,
    pub allowed_destinations: Shared<Vec<[u8; 32]>>,
}

/// Evaluate a transaction against a policy, confidentially.
/// Returns 0 (Pass) or 1 (Block).
pub fn evaluate_confidential(
    tx: ConfidentialTx,
    policy: ConfidentialPolicy,
) -> Shared<u8> {
    // Amount check
    if tx.amount > policy.max_per_tx {
        return Shared::from(1u8); // Block
    }
    
    // Destination check
    let mut found = Shared::from(false);
    for dest in policy.allowed_destinations.iter() {
        if tx.destination.eq(dest) {
            found = Shared::from(true);
        }
    }
    if !found {
        return Shared::from(1u8); // Block
    }
    
    Shared::from(0u8) // Pass
}
```

### Phase 3: Solana Program Integration

Create `crates/arcium/programs/bastion_arcium.rs`:

```rust
use anchor_lang::prelude::*;
use arcium_client::MxeClient;

#[program]
pub mod bastion_arcium {
    use super::*;

    /// Submit a transaction for confidential policy evaluation.
    pub fn evaluate_confidential(
        ctx: Context<EvaluateConfidential>,
        encrypted_tx: Vec<u8>,
    ) -> Result<()> {
        let mxe = ctx.accounts.mxe.load()?;
        let result = mxe.evaluate(&encrypted_tx)?;
        
        emit!(ConfidentialEvaluation {
            result: result.decode_to_u8(),
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }
}
```

## Dependencies

```toml
[dependencies]
arcium-sdk = "0.1"
@arcium-hq/client = "^1.0"
@arcium-hq/reader = "^1.0"
```

## Security Considerations

| Threat | Mitigation |
|--------|-----------|
| Circuit extraction | Arcium's MPC ensures no single node sees full circuit |
| Policy leakage via timing | Fixed-time operations in Arcis circuits |
| Replay attacks | Nonce embedded in encrypted input |
| Side-channel attacks | MPC by design prevents single-party observation |
| Collusion between Arx nodes | Cerberus security model (dishonest majority) |

## Current Status

- [ ] Arcium toolchain installed
- [ ] Hello World circuit built
- [ ] Confidential policy evaluation circuit
- [ ] Solana program integration
- [ ] Sidecar CPI integration
- [ ] Dashboard confidential policy UI

## References

- [Arcium Documentation](https://docs.arcium.com)
- [Arcium SKILL.md for AI Agents](https://docs.arcium.com/skill.md)
- [Arcis Framework](https://docs.arcium.com/developers/arcis.md)
- [Solana Program Integration](https://docs.arcium.com/developers/program.md)
