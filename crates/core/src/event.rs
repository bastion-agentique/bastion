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

/// Physical telemetry event from a robot or IoT device.
///
/// Extends the `SecurityEvent` model with device-specific fields:
/// battery level, firmware version, sensor readings, and GPS coordinates.
/// Ingested via `POST /ingest` with `source: "robot-telemetry"` and
/// `classification: "physical"`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhysicalTelemetryEvent {
    /// Agent DID for the physical device.
    pub agent_did: String,

    /// Battery level 0-100 (percentage).
    pub battery_level: Option<u8>,

    /// Current firmware version string.
    pub firmware_version: Option<String>,

    /// Last known GPS coordinates [latitude, longitude].
    pub location: Option<(f64, f64)>,

    /// Sensor data as key-value pairs (e.g. {"temperature": 42.5, "imu_roll": 12.3}).
    #[serde(default)]
    pub sensor_data: Option<serde_json::Value>,

    /// Timestamp of the telemetry reading.
    pub timestamp: u64,
}

impl PhysicalTelemetryEvent {
    /// Convert to a `SecurityEvent` for ingestion into the audit trail.
    pub fn to_security_event(&self) -> SecurityEvent {
        let mut payload = serde_json::Map::new();
        if let Some((lat, lon)) = &self.location {
            payload.insert("latitude".into(), serde_json::Value::Number(
                serde_json::Number::from_f64(*lat).unwrap_or(serde_json::Number::from(0))
            ));
            payload.insert("longitude".into(), serde_json::Value::Number(
                serde_json::Number::from_f64(*lon).unwrap_or(serde_json::Number::from(0))
            ));
        }
        if let Some(battery) = self.battery_level {
            payload.insert("battery_level".into(), serde_json::Value::Number(
                serde_json::Number::from(battery)
            ));
        }
        if let Some(fw) = &self.firmware_version {
            payload.insert("firmware_version".into(), serde_json::Value::String(fw.clone()));
        }
        if let Some(sensors) = &self.sensor_data {
            payload.insert("sensor_data".into(), sensors.clone());
        }

        SecurityEvent {
            id: uuid::Uuid::new_v4().to_string(),
            timestamp: self.timestamp,
            source: "robot-telemetry".to_string(),
            classification: "physical".to_string(),
            description: Some(format!("Telemetry from robot agent {}", self.agent_did)),
            principal: Some(self.agent_did.clone()),
            target: None,
            payload: serde_json::Value::Object(payload),
            value: self.battery_level.map(|b| b as u64),
            success: Some(true),
            severity: if self.battery_level.unwrap_or(100) < 20 { "high".to_string() } else { "info".to_string() },
            chain: None,
        }
    }
}
