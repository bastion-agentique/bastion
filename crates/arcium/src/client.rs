//! Arcium MXE client trait and implementations.

use async_trait::async_trait;

use crate::types::{ArciumError, MxeConfig, MxeResult};

/// Trait for interacting with an Arcium MXE cluster.
///
/// Implementations handle the communication, proving, and signature
/// verification required to produce an `MxeResult` from a policy
/// evaluation circuit.
#[async_trait]
pub trait ArciumClient: Send + Sync {
    /// Evaluate a transaction against the MXE policy circuit.
    async fn evaluate(
        &self,
        config: &MxeConfig,
        tx_data: &[u8],
    ) -> Result<MxeResult, ArciumError>;
}

/// A no-op client that always returns `FirewallDecision::Pass`.
///
/// Use this when Arcium is not configured or when running in local/dev
/// mode without a live MXE cluster.
pub struct NoopArciumClient;

#[async_trait]
impl ArciumClient for NoopArciumClient {
    async fn evaluate(
        &self,
        _config: &MxeConfig,
        _tx_data: &[u8],
    ) -> Result<MxeResult, ArciumError> {
        Ok(MxeResult {
            decision: bastion_core::FirewallDecision::Pass,
            signature: Vec::new(),
            computation_hash: [0u8; 32],
        })
    }
}
