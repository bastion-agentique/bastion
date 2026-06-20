# Arcium Sidecar Integration Spec

## Flow

```
POST /simulate { transaction, intent }
  |
  1. Decode + classify (existing)
  2. Policy check (existing)
  3. Arcium MXE evaluation (NEW, optional):
     If ARCIUM_MXE_ID configured:
       Encrypt tx + policy -> send to Arcium cluster
       Wait for MxeResult (timeout: configurable, default 5s)
       Verify collective signature
       Use MxeResult.decision as FirewallDecision
       Log MxeResult.computation_hash to audit
     If not configured: skip (existing behavior)
  4. Post-simulation checks (existing, skip if Arcium returned Block)
  5. Audit + return
```

## Configuration

```toml
[arcium]
enabled = false
mxe_id = ""
cluster_id = ""
timeout_seconds = 5
required_honest_nodes = 1
fallback_to_local = true
```

## Environment Variables

ARCIUM_CLUSTER_ID=mainnet-alpha
ARCIUM_MXE_ID=<mxe-address>
ARCIUM_TIMEOUT_SECONDS=5

## Code Changes Required

| File | Change |
|------|--------|
| Cargo.toml (workspace) | Add crates/arcium member |
| crates/sidecar/Cargo.toml | Add arcium dependency |
| crates/sidecar/src/lib.rs | Add ArciumClient to AppState |
| crates/sidecar/src/simulation.rs | Add ArciumEvaluator alongside Simulate trait |
| crates/core/src/policy/evaluator.rs | Accept optional ArciumClient |
| config.toml | Add [arcium] section |
| crates/sidecar/src/config.rs | Parse arcium config |

## Fallback Behavior

When Arcium is unavailable or times out:
  If fallback_to_local = true: use local PolicyEvaluator (existing behavior)
  If fallback_to_local = false: return Block with reason "Arcium unavailable"
