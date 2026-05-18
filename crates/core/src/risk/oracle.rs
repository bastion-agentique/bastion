use crate::transaction::Address;
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Risk score for an address. 0 = safe, 100 = high risk.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct RiskScore(pub u8);

impl RiskScore {
    pub fn new(score: u8) -> Self {
        Self(score.min(100))
    }

    pub fn is_low_risk(&self) -> bool {
        self.0 <= 25
    }

    pub fn is_medium_risk(&self) -> bool {
        self.0 > 25 && self.0 <= 60
    }

    pub fn is_high_risk(&self) -> bool {
        self.0 > 60
    }

    pub fn value(&self) -> u8 {
        self.0
    }
}

/// Error type for risk oracle operations.
#[derive(Debug, Error)]
pub enum RiskOracleError {
    #[error("provider error: {0}")]
    ProviderError(String),
    #[error("timeout")]
    Timeout,
    #[error("rate limited")]
    RateLimited,
}

/// Trait for risk scoring providers.
///
/// Implementations include Webacy, Chainalysis, OpenSanctions,
/// and the internal ML anomaly model (Phase 4).
#[async_trait::async_trait]
pub trait RiskOracle: Send + Sync {
    /// Returns a risk score for the given address.
    async fn score(&self, address: &Address) -> Result<RiskScore, RiskOracleError>;

    /// Human-readable name of this oracle provider.
    fn provider_name(&self) -> &str;
}
