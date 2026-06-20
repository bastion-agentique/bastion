//! Arcium-backed policy evaluator wrapper.
//!
//! Wraps `PolicyEvaluator` with an optional Arcium MXE client.
//! For Solana transactions, evaluates through Arcium if configured.
//! Falls back to local evaluation on Arcium failure.

use bastion_core::{
    FirewallDecision, NormalizedTransaction, PolicyEvaluator, PolicySet, RiskOracle,
    transaction::Chain,
};

use crate::client::ArciumClient;
use crate::types::{ArciumError, MxeConfig};

/// A policy evaluator that optionally delegates to Arcium MXE.
///
/// For Solana transactions, runs evaluation through Arcium if configured.
/// Falls back to local `PolicyEvaluator` on Arcium failure when fallback
/// is enabled.
pub struct ArcumPolicyEvaluator<C: ArciumClient, R: RiskOracle> {
    local: PolicyEvaluator<R>,
    arcium: Option<C>,
    config: MxeConfig,
    fallback: bool,
}

impl<C: ArciumClient, R: RiskOracle> ArcumPolicyEvaluator<C, R> {
    /// Create a new evaluator with an Arcium client.
    pub fn new(arcium: C, config: MxeConfig) -> Self {
        Self {
            local: PolicyEvaluator::new(),
            arcium: Some(arcium),
            config,
            fallback: true,
        }
    }

    /// Create a new evaluator with an Arcium client and risk oracle.
    pub fn with_oracle(arcium: C, config: MxeConfig, oracle: R) -> Self {
        Self {
            local: PolicyEvaluator::with_oracle(oracle),
            arcium: Some(arcium),
            config,
            fallback: true,
        }
    }

    /// Set whether to fall back to local evaluation on Arcium failure.
    pub fn with_fallback(mut self, fallback: bool) -> Self {
        self.fallback = fallback;
        self
    }

    /// Evaluate a transaction against the policy set.
    ///
    /// For Solana transactions with Arcium configured:
    /// 1. Sends to Arcium MXE
    /// 2. If Arcium returns a result, uses it
    /// 3. If Arcium fails and fallback is enabled, uses local evaluation
    /// 4. If Arcium fails and fallback is disabled, returns Block
    ///
    /// For non-Solana transactions: uses local evaluation directly.
    pub async fn evaluate(
        &self,
        tx: &NormalizedTransaction,
        policy: &PolicySet,
    ) -> FirewallDecision {
        // Only use Arcium for Solana transactions
        if tx.chain != Chain::Solana {
            return self.local.evaluate(tx, policy).await;
        }

        // If no Arcium client, use local evaluation
        let Some(arcium) = &self.arcium else {
            return self.local.evaluate(tx, policy).await;
        };

        // Try Arcium evaluation
        let tx_data = match serde_json::to_vec(tx) {
            Ok(data) => data,
            Err(_) => return self.local.evaluate(tx, policy).await,
        };

        match arcium.evaluate(&self.config, &tx_data).await {
            Ok(result) => result.decision,
            Err(ArciumError::Timeout(_)) | Err(ArciumError::InsufficientNodes { .. }) => {
                if self.fallback {
                    tracing::warn!("Arcium evaluation failed, falling back to local");
                    self.local.evaluate(tx, policy).await
                } else {
                    tracing::error!("Arcium evaluation failed, no fallback enabled");
                    FirewallDecision::Block {
                        reason: "Arcium unavailable".into(),
                        policy_id: None,
                    }
                }
            }
            Err(err) => {
                tracing::error!("Arcium error: {err}");
                if self.fallback {
                    self.local.evaluate(tx, policy).await
                } else {
                    FirewallDecision::Block {
                        reason: format!("Arcium error: {err}"),
                        policy_id: None,
                    }
                }
            }
        }
    }
}
