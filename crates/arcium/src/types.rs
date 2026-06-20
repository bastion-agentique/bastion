//! Core types for Arcium MXE integration.

use bastion_core::FirewallDecision;
use serde::{Deserialize, Serialize};

/// Configuration for connecting to an Arcium MXE cluster.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MxeConfig {
    /// The Arcium cluster identifier.
    pub cluster_id: String,
    /// The MXE computation identifier.
    pub mxe_id: String,
    /// Maximum time in milliseconds to wait for MXE computation.
    pub computation_timeout: u64,
    /// Minimum number of nodes required for consensus.
    pub required_nodes: u32,
}

/// Result returned after MXE computation.
#[derive(Debug, Clone)]
pub struct MxeResult {
    /// The firewall decision produced by the MXE.
    pub decision: FirewallDecision,
    /// Cryptographic signature over the computation output.
    pub signature: Vec<u8>,
    /// Hash of the circuit computation for on-chain verification.
    pub computation_hash: [u8; 32],
}

/// Errors specific to Arcium MXE operations.
#[derive(Debug, thiserror::Error)]
pub enum ArciumError {
    /// MXE computation timed out.
    #[error("MXE computation timed out after {0}ms")]
    Timeout(u64),

    /// Not enough nodes responded for consensus.
    #[error("Insufficient nodes: need {required}, have {available}")]
    InsufficientNodes {
        /// Number of nodes required.
        required: u32,
        /// Number of nodes that responded.
        available: u32,
    },

    /// Circuit execution failed.
    #[error("Circuit execution failed: {0}")]
    CircuitError(String),

    /// Signature verification failed.
    #[error("Signature verification failed")]
    SignatureVerificationFailed,
}
