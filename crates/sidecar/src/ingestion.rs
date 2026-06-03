use axum::{Json, extract::State};
use bastion_core::event::SecurityEvent;
use serde::{Deserialize, Serialize};

use crate::AppState;

/// A request body for the universal ingestion endpoint.
#[derive(Debug, Deserialize)]
pub struct IngestRequest {
    /// The source system identifier (e.g. "aws-cloudtrail", "syslog")
    pub source: String,

    /// Classification tag (e.g. "authentication", "transaction", "configuration")
    pub classification: String,

    /// Optional human-readable event description
    pub description: Option<String>,

    /// Optional principal identifier (user, agent, address)
    pub principal: Option<String>,

    /// Optional target identifier (resource, endpoint, contract)
    pub target: Option<String>,

    /// Arbitrary JSON payload specific to the source
    #[serde(default)]
    pub payload: serde_json::Value,

    /// Optional numeric value associated with the event
    pub value: Option<u64>,

    /// Optional success/failure indicator
    pub success: Option<bool>,

    /// Optional severity override
    #[serde(default = "default_severity")]
    pub severity: String,

    /// Optional chain identifier for blockchain events
    pub chain: Option<String>,
}

fn default_severity() -> String {
    "info".to_string()
}

#[derive(Debug, Serialize)]
pub struct IngestResponse {
    pub event_id: String,
    pub ingested: bool,
}

/// POST /ingest
///
/// Accepts a universal security event from any source (AWS CloudTrail, syslog,
/// GitHub webhooks, Slack audit logs, OJK financial event streams, or raw
/// blockchain transactions) and normalizes it into the SecurityEvent type.
///
/// The event is then written to the Sled audit log and routed to the
/// correlation engine if configured.
pub(crate) async fn ingest_event(
    State(state): State<AppState>,
    Json(request): Json<IngestRequest>,
) -> Json<IngestResponse> {
    let event = SecurityEvent {
        id: uuid::Uuid::new_v4().to_string(),
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
        source: request.source,
        classification: request.classification,
        description: request.description,
        principal: request.principal,
        target: request.target,
        payload: request.payload,
        value: request.value,
        success: request.success,
        severity: request.severity,
        chain: request.chain,
    };

    let event_id = event.id.clone();

    // Write to the audit logger
    {
        let logger = state.logger.clone();
        let entry = crate::audit::AuditEntry {
            timestamp: event.timestamp,
            transaction_id: Some(event.id.clone()),
            transaction_signature: None,
            decision: crate::audit::Decision::Allowed,
            simulation_result: None,
            intent: Some(format!(
                "[{}] {}",
                event.source,
                event.description.as_deref().unwrap_or("ingested event")
            )),
            result: crate::audit::AuditResult::Allowed,
            reasoning: format!("Ingested from {}", event.source),
            simulation_logs: vec![],
            transaction_details: Some(crate::audit::TransactionDetails {
                request_payload_base64: None,
                signature: None,
                program_ids: vec![],
                account_keys: vec![
                    event.principal.clone().unwrap_or_default(),
                    event.target.clone().unwrap_or_default(),
                ],
            }),
        };
        let _ = logger.log(entry);
    }

    // Route to correlation engine if available
    if let Some(engine) = &state.correlation_engine {
        let mut engine = engine.write().await;
        let _alerts = engine.ingest(event).await;
    }

    Json(IngestResponse {
        event_id,
        ingested: true,
    })
}

/// Parse a CEF (Common Event Format) string into a SecurityEvent.
///
/// CEF format: CEF:Version|Device Vendor|Device Product|Device Version|Signature ID|Name|Severity|Extension
///
/// Example: "CEF:0|AWS|CloudTrail|1.0|ConsoleLogin|User Login|3|src=192.168.1.1 dst=console.aws.amazon.com suser=admin"
pub fn parse_cef(cef_string: &str) -> Option<SecurityEvent> {
    let without_prefix = cef_string.strip_prefix("CEF:")?;
    let parts: Vec<&str> = without_prefix.splitn(8, '|').collect();

    if parts.len() < 8 {
        return None;
    }

    let device_vendor = parts[1];
    let device_product = parts[2];
    let signature_id = parts[4];
    let name = parts[5];
    let severity_str = parts[6];

    let severity = match severity_str {
        "0" | "1" | "2" => "low",
        "3" | "4" | "5" | "6" => "medium",
        "7" | "8" => "high",
        "9" | "10" => "critical",
        _ => "info",
    };

    let source = format!(
        "{}-{}",
        device_vendor.to_lowercase(),
        device_product.to_lowercase()
    );

    Some(SecurityEvent {
        id: uuid::Uuid::new_v4().to_string(),
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
        source,
        classification: "unknown".to_string(),
        description: Some(name.to_string()),
        principal: None,
        target: None,
        payload: serde_json::json!({
            "cef_raw": cef_string,
            "device_vendor": device_vendor,
            "device_product": device_product,
            "signature_id": signature_id,
            "severity_original": severity_str,
        }),
        value: None,
        success: None,
        severity: severity.to_string(),
        chain: None,
    })
}

/// Parse a JSON CloudTrail event into a SecurityEvent.
pub fn parse_cloudtrail_event(json: &serde_json::Value) -> Option<SecurityEvent> {
    let event_name = json.get("eventName")?.as_str()?;
    let event_source = json.get("eventSource")?.as_str()?;
    let user_identity = json
        .get("userIdentity")?
        .get("arn")?
        .as_str()
        .unwrap_or("unknown");
    let event_time = json.get("eventTime")?.as_str()?;

    let timestamp = chrono::DateTime::parse_from_rfc3339(event_time)
        .map(|dt: chrono::DateTime<chrono::FixedOffset>| dt.timestamp() as u64)
        .unwrap_or_else(|_| {
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs()
        });

    Some(SecurityEvent {
        id: json
            .get("eventID")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
        timestamp,
        source: format!("{}-{}", event_source, event_name.to_lowercase()),
        classification: "configuration".to_string(),
        description: Some(event_name.to_string()),
        principal: Some(user_identity.to_string()),
        target: json
            .get("awsRegion")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        payload: json.clone(),
        value: None,
        success: None,
        severity: "info".to_string(),
        chain: None,
    })
}
