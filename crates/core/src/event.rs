use serde::{Deserialize, Serialize};

/// A normalized security event from any source, not just blockchain transactions.
/// This generalizes the existing `NormalizedTransaction` for SIEM universal ingestion.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityEvent {
    /// Unique event identifier (UUID v4 or hash of source + timestamp)
    pub id: String,

    /// Unix timestamp in seconds when the event occurred at the source
    pub timestamp: u64,

    /// Identifies the originating system or data source
    /// Examples: "aws-cloudtrail", "github-webhook", "solana-rpc", "syslog", "ojk-financial-stream"
    pub source: String,

    /// Classification tag from a controlled vocabulary
    /// Valid values: "authentication", "authorization", "transaction", "configuration", "network", "audit", "unknown"
    pub classification: String,

    /// Optional human-readable description of the event
    #[serde(default)]
    pub description: Option<String>,

    /// The principal that initiated the event (user, agent, service account, or address)
    #[serde(default)]
    pub principal: Option<String>,

    /// The target of the event (resource, contract address, endpoint)
    #[serde(default)]
    pub target: Option<String>,

    /// Arbitrary key-value payload containing source-specific data
    #[serde(default)]
    pub payload: serde_json::Value,

    /// Optional numeric value associated with the event (e.g. transaction amount, API quota consumed)
    #[serde(default)]
    pub value: Option<u64>,

    /// Optional outcome indicator, true = success / allowed, false = failure / blocked
    #[serde(default)]
    pub success: Option<bool>,

    /// Severity level computed by the source or ingestion layer
    /// Valid values: "info", "low", "medium", "high", "critical"
    #[serde(default = "default_severity")]
    pub severity: String,

    /// Chain identifier for blockchain events, None for non-blockchain events
    #[serde(default)]
    pub chain: Option<String>,
}

fn default_severity() -> String {
    "info".to_string()
}

impl SecurityEvent {
    /// Create a minimal event from a source and classification.
    pub fn new(source: impl Into<String>, classification: impl Into<String>) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
            source: source.into(),
            classification: classification.into(),
            description: None,
            principal: None,
            target: None,
            payload: serde_json::Value::Null,
            value: None,
            success: None,
            severity: "info".to_string(),
            chain: None,
        }
    }

    /// Set the principal (who initiated the event).
    pub fn with_principal(mut self, principal: impl Into<String>) -> Self {
        self.principal = Some(principal.into());
        self
    }

    /// Set the target (what was acted upon).
    pub fn with_target(mut self, target: impl Into<String>) -> Self {
        self.target = Some(target.into());
        self
    }

    /// Set the outcome indicator.
    pub fn with_success(mut self, success: bool) -> Self {
        self.success = Some(success);
        self
    }

    /// Set the severity.
    pub fn with_severity(mut self, severity: impl Into<String>) -> Self {
        self.severity = severity.into();
        self
    }

    /// Attach typed payload data.
    pub fn with_payload(mut self, payload: serde_json::Value) -> Self {
        self.payload = payload;
        self
    }

    /// Set the chain identifier for blockchain events.
    pub fn with_chain(mut self, chain: impl Into<String>) -> Self {
        self.chain = Some(chain.into());
        self
    }
}
