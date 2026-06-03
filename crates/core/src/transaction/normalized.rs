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
    Midnight,
}

/// Transaction type classification.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TxType {
    Transfer,
    Payment,
    Governance,
    Custom,
}

/// A transaction normalized to a chain-agnostic representation.
///
/// Every chain-specific adapter converts its native transaction format
/// into this struct before policy evaluation.
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
