use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Chain-agnostic address representation.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Address(pub String);

impl Address {
    pub fn new(s: impl Into<String>) -> Self {
        Self(s.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    pub fn is_valid(&self) -> bool {
        !self.0.is_empty()
    }
}

impl std::fmt::Display for Address {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Chain-agnostic agent identifier.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct AgentId(pub String);

impl AgentId {
    pub fn new(s: impl Into<String>) -> Self {
        Self(s.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// Supported chain identifiers.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Chain {
    Solana,
    Base,
    Ethereum,
    Polygon,
    Arbitrum,
    Celo,
}

/// Transaction type classification.
///
/// Extended with physical action types for robot/IoT agent support.
/// Transfer/swap are financial operations; the new variants represent
/// physical-world actions that robots and autonomous systems execute.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TxType {
    // ── Financial (existing) ──
    Transfer,
    Payment,
    Governance,
    Custom,

    // ── Physical / Robot (new) ──
    /// Direct actuator control: open/close valves, move motors, trigger relays.
    Actuate,
    /// Read sensor data: temperature, IMU, GPS, battery, camera.
    SensorRead,
    /// Physical navigation: move to coordinates, return to base, dock.
    Navigate,
    /// Robot charging: initiate charge, report energy level, emergency stop.
    Charge,
    /// Firmware update: push signed firmware bundle to device.
    FirmwareUpdate,
}

impl TxType {
    /// Returns true if this type represents a physical-world action
    /// (as opposed to a financial transaction).
    pub fn is_physical(&self) -> bool {
        matches!(
            self,
            Self::Actuate | Self::SensorRead | Self::Navigate | Self::Charge | Self::FirmwareUpdate
        )
    }

    /// Human-readable label for the type.
    pub fn label(&self) -> &'static str {
        match self {
            Self::Transfer => "transfer",
            Self::Payment => "payment",
            Self::Governance => "governance",
            Self::Custom => "custom",
            Self::Actuate => "actuate",
            Self::SensorRead => "sensor_read",
            Self::Navigate => "navigate",
            Self::Charge => "charge",
            Self::FirmwareUpdate => "firmware_update",
        }
    }
}

/// A transaction normalized to a chain-agnostic representation.
///
/// Every chain-specific adapter converts its native transaction format
/// into this struct before policy evaluation.
///
/// Extended with `location` and `device_type` for robot/IoT agents.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NormalizedTransaction {
    /// The agent executing this transaction.
    pub agent_id: AgentId,
    /// Source address.
    pub from: Address,
    /// Destination address.
    pub to: Address,
    /// Transaction value in base units (lamports, wei, etc.).
    pub amount: u64,
    /// Currency identifier (e.g. "SOL", "USDC", "ETH").
    pub currency: String,
    /// Transaction classification.
    pub tx_type: TxType,
    /// Originating chain.
    pub chain: Chain,
    /// Unix timestamp (seconds).
    pub timestamp: u64,
    /// Optional extra fields for chain-specific or protocol-specific data.
    pub metadata: HashMap<String, serde_json::Value>,
    /// Agent's SOL staked for reputation weighting (from AgentStake PDA).
    pub agent_stake: Option<u64>,
    /// Agent's delegation depth in the hierarchy (from Agent PDA).
    pub delegation_depth: Option<u8>,

    // ── Physical / Robot Agent Fields ──
    /// Last known GPS coordinates [latitude, longitude]. None for non-physical agents.
    pub location: Option<(f64, f64)>,
    /// Physical device type (e.g. "drone", "rover", "industrial_arm").
    pub device_type: Option<String>,
}

impl NormalizedTransaction {
    pub fn new(
        agent_id: impl Into<String>,
        from: impl Into<String>,
        to: impl Into<String>,
        amount: u64,
        currency: impl Into<String>,
        tx_type: TxType,
        chain: Chain,
    ) -> Self {
        Self {
            agent_id: AgentId::new(agent_id),
            from: Address::new(from),
            to: Address::new(to),
            amount,
            currency: currency.into(),
            tx_type,
            chain,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
            metadata: HashMap::new(),
            agent_stake: None,
            delegation_depth: None,
            location: None,
            device_type: None,
        }
    }

    pub fn with_metadata(
        mut self,
        key: impl Into<String>,
        value: impl Into<serde_json::Value>,
    ) -> Self {
        self.metadata.insert(key.into(), value.into());
        self
    }

    pub fn with_timestamp(mut self, ts: u64) -> Self {
        self.timestamp = ts;
        self
    }
}
