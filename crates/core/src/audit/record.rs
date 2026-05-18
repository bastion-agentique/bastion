use crate::decision::FirewallDecision;
use crate::transaction::{Address, AgentId, Chain, NormalizedTransaction};
use serde::{Deserialize, Serialize};

/// A chain-agnostic audit record produced after every firewall evaluation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditRecord {
    /// When the audit record was created (Unix timestamp, seconds).
    pub timestamp: u64,
    /// The agent that attempted the transaction.
    pub agent_id: AgentId,
    /// The chain the transaction originated on.
    pub chain: Chain,
    /// Source address.
    pub from: Address,
    /// Destination address.
    pub to: Address,
    /// Transaction value in base units.
    pub amount: u64,
    /// Currency identifier.
    pub currency: String,
    /// The firewall decision.
    pub decision: FirewallDecision,
    /// Hash of the original transaction payload (for correlation).
    pub payload_hash: String,
    /// Optional extra metadata.
    pub metadata: std::collections::HashMap<String, serde_json::Value>,
}

impl AuditRecord {
    pub fn from_transaction(
        tx: &NormalizedTransaction,
        decision: FirewallDecision,
        payload_hash: impl Into<String>,
    ) -> Self {
        Self {
            timestamp: tx.timestamp,
            agent_id: tx.agent_id.clone(),
            chain: tx.chain,
            from: tx.from.clone(),
            to: tx.to.clone(),
            amount: tx.amount,
            currency: tx.currency.clone(),
            decision,
            payload_hash: payload_hash.into(),
            metadata: tx.metadata.clone(),
        }
    }
}
