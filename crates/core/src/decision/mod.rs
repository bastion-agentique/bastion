use serde::{Deserialize, Serialize};

/// The outcome of a firewall policy evaluation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum FirewallDecision {
    /// Transaction is allowed to proceed.
    Pass,
    /// Transaction is blocked due to a policy violation.
    Block {
        /// Human-readable reason for the block.
        reason: String,
        /// The policy rule that triggered the block (if identifiable).
        policy_id: Option<String>,
    },
    /// Transaction is held pending human-in-the-loop approval.
    PendingHITL {
        /// Unique approval request ID.
        approval_id: String,
        /// The policy or rule that triggered the HITL gate.
        reason: String,
    },
}

impl FirewallDecision {
    pub fn is_allowed(&self) -> bool {
        matches!(self, Self::Pass)
    }

    pub fn is_blocked(&self) -> bool {
        matches!(self, Self::Block { .. })
    }

    pub fn is_pending_hitl(&self) -> bool {
        matches!(self, Self::PendingHITL { .. })
    }
}
