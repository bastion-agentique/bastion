# bastion-arcium — Arcium MXE Integration

## Purpose

Provides a client wrapper for Arcium MXE (Multi-party eXecution Environment)
to enable privacy-preserving policy evaluation. Transactions are evaluated inside
a distributed MPC circuit, producing a cryptographically signed decision without
revealing transaction details to individual nodes.

## Architecture

```
┌──────────────────────┐
│   bastion-sidecar    │  (HTTP policy evaluator)
└──────────┬───────────┘
           │ evaluate(config, tx_data)
           ▼
┌──────────────────────┐
│   bastion-arcium     │  (this crate)
│  ┌─────────────────┐ │
│  │   MxeConfig     │ │  cluster_id, mxe_id, timeout, required_nodes
│  │   ArciumClient  │ │  trait + NoopArciumClient impl
│  │   MxeResult     │ │  decision + signature + computation_hash
│  └─────────────────┘ │
└──────────┬───────────┘
           │ Arcis circuit execution
           ▼
┌──────────────────────┐
│   Arcium MXE Cluster │  (external MPC network)
└──────────────────────┘
```

## Key Types

### `MxeConfig`
Configuration for connecting to an MXE cluster.

| Field                | Type   | Description                             |
|----------------------|--------|-----------------------------------------|
| `cluster_id`         | String | Arcium cluster identifier               |
| `mxe_id`             | String | MXE computation identifier              |
| `computation_timeout`| u64    | Max wait time in ms                     |
| `required_nodes`     | u32    | Minimum nodes for consensus             |

### `MxeResult`
Output from MXE computation.

| Field                | Type                 | Description                          |
|----------------------|----------------------|--------------------------------------|
| `decision`           | FirewallDecision     | Pass / Block / PendingHITL          |
| `signature`          | Vec<u8>              | Cryptographic signature              |
| `computation_hash`   | [u8; 32]             | Hash for on-chain verification       |

### `ArciumError`
Error variants: `Timeout`, `InsufficientNodes`, `CircuitError`, `SignatureVerificationFailed`.

### `ArciumClient` trait
```rust
#[async_trait]
pub trait ArciumClient: Send + Sync {
    async fn evaluate(&self, config: &MxeConfig, tx_data: &[u8]) -> Result<MxeResult, ArciumError>;
}
```

### `NoopArciumClient`
Returns `FirewallDecision::Pass` for all inputs. Used when Arcium is not configured.

## Modules (placeholders)

- `circuits/` — Arcis circuit definitions (policy_evaluator)
- `solana/` — On-chain callback integration

## Integration

The sidecar calls `ArciumClient::evaluate()` when `config.toml` specifies an
Arcium cluster. If no cluster is configured, `NoopArciumClient` is used.

## Status

Placeholder crate. Full MXE integration pending Arcium mainnet-alpha SDK.
