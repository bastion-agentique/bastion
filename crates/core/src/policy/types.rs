use crate::transaction::Address;
use serde::{Deserialize, Serialize};

/// A single policy rule that gates agent transactions.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PolicyRule {
    /// Cap the maximum value per single transaction.
    AmountLimit {
        max_per_transaction: u64,
        max_per_24h: Option<u64>,
        currency: String,
    },
    /// Restrict which destination addresses an agent may interact with.
    Destination {
        allowlist: Vec<Address>,
        blocklist: Vec<Address>,
    },
    /// Limit transaction frequency.
    Frequency { max_transactions_per_hour: u32 },
    /// Require human approval for transactions above a threshold.
    HITL {
        trigger_above: u64,
        timeout_seconds: u64,
    },
    /// Require a minimum reputation score for high-value transactions.
    Reputation {
        minimum_score: u8,
        elevated_limit_multiplier: Option<f64>,
    },
    /// Restrict which transaction types are allowed.
    TxTypeAllowlist { allowed: Vec<String> },
    /// Weight transaction limits based on SOL staked. Higher stake = higher limits.
    /// Effective limit = min(base * (1 + stake/min_stake * multiplier) * decay^depth, base * max_multiplier), floor base * 0.1.
    StakeWeighted {
        base_limit: u64,
        min_stake: u64,
        stake_multiplier: f64,
        depth_decay_factor: f64,
    },

    // ── Robot / Physical Agent Policy Rules ──

    /// Restrict agent to operate within a geographic boundary.
    /// lat_min/lon_min/lat_max/lon_max define a bounding box (degrees).
    Geofence {
        lat_min: f64,
        lon_min: f64,
        lat_max: f64,
        lon_max: f64,
    },

    /// Limit the physical speed of a robot's navigation action (meters/second).
    SpeedLimit {
        max_speed_mps: f64,
    },

    /// Cap the energy budget per session or per time window.
    EnergyBudget {
        /// Maximum energy in Joules per 24h window.
        max_joules_24h: u64,
    },

    /// Restrict operating hours (UTC).
    /// min_hour and max_hour are 0-23 UTC.
    OperatingHours {
        min_hour: u8,
        max_hour: u8,
    },
}

impl PolicyRule {
    pub fn rule_name(&self) -> &'static str {
        match self {
            Self::AmountLimit { .. } => "amount_limit",
            Self::Destination { .. } => "destination",
            Self::Frequency { .. } => "frequency",
            Self::HITL { .. } => "hitl",
            Self::Reputation { .. } => "reputation",
            Self::TxTypeAllowlist { .. } => "tx_type_allowlist",
            Self::StakeWeighted { .. } => "stake_weighted",
            Self::Geofence { .. } => "geofence",
            Self::SpeedLimit { .. } => "speed_limit",
            Self::EnergyBudget { .. } => "energy_budget",
            Self::OperatingHours { .. } => "operating_hours",
        }
    }
}
