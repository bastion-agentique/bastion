use serde::{Deserialize, Serialize};

/// A threat severity level matching the correlation alert output.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub enum Severity {
    #[serde(rename = "info")]
    Info,
    #[serde(rename = "low")]
    Low,
    #[serde(rename = "medium")]
    Medium,
    #[serde(rename = "high")]
    High,
    #[serde(rename = "critical")]
    Critical,
}

/// A single condition within a correlation rule.
/// A condition matches when an event's field equals a specific value.
/// For example: `classification = "authentication"` or `source = "aws-cloudtrail"`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleCondition {
    /// The field name to match on the SecurityEvent (e.g. "classification", "source", "principal")
    pub field: String,

    /// The required value for the field to match
    pub value: String,
}

/// A correlation rule that detects threat patterns across multiple events within a time window.
///
/// Example YAML rule:
/// ```yaml
/// name: "Brute force followed by large transfer"
/// description: "Multiple failed auth events followed by a high-value transfer"
/// conditions:
///   - field: "classification"
///     value: "authentication"
///   - field: "success"
///     value: "false"
/// min_occurrences: 3
/// then_condition:
///   - field: "classification"
///     value: "transaction"
///   - field: "value"
///     value: ">5000000000"
/// window_seconds: 60
/// severity: "high"
/// mitre_id: "T1110.001"
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorrelationRule {
    /// Human-readable name for the rule
    pub name: String,

    /// Description of what the rule detects
    pub description: String,

    /// Conditions that must match against the lead-up events
    pub conditions: Vec<RuleCondition>,

    /// Minimum number of events that must match the conditions
    #[serde(default = "default_min_occurrences")]
    pub min_occurrences: u32,

    /// Condition that the triggering event must match
    /// If empty, the same conditions as the lead-up events apply
    #[serde(default)]
    pub then_condition: Vec<RuleCondition>,

    /// Time window in seconds for all events to occur
    pub window_seconds: u64,

    /// Severity assigned to the alert when this rule triggers
    #[serde(default = "default_severity")]
    pub severity: Severity,

    /// Optional MITRE ATT&CK technique ID for standardized threat reporting
    #[serde(default)]
    pub mitre_id: Option<String>,
}

fn default_min_occurrences() -> u32 {
    2
}

fn default_severity() -> Severity {
    Severity::Medium
}

impl CorrelationRule {
    /// Standard SIEM rules shipped with Bastion.
    pub fn builtin_rules() -> Vec<Self> {
        vec![
            Self {
                name: "Brute force followed by large transfer".into(),
                description: "Multiple failed authentication events followed by a high-value Solana transfer within 60 seconds".into(),
                conditions: vec![
                    RuleCondition { field: "classification".into(), value: "authentication".into() },
                    RuleCondition { field: "success".into(), value: "false".into() },
                ],
                min_occurrences: 3,
                then_condition: vec![
                    RuleCondition { field: "classification".into(), value: "transaction".into() },
                    RuleCondition { field: "value".into(), value: ">5000000000".into() },
                ],
                window_seconds: 60,
                severity: Severity::High,
                mitre_id: Some("T1110.001".into()),
            },
            Self {
                name: "Program upgrade after admin key rotation".into(),
                description: "A program upgrade transaction immediately following an admin authority key rotation within 300 seconds".into(),
                conditions: vec![
                    RuleCondition { field: "classification".into(), value: "configuration".into() },
                    RuleCondition { field: "description".into(), value: "admin_key_rotation".into() },
                ],
                min_occurrences: 1,
                then_condition: vec![
                    RuleCondition { field: "classification".into(), value: "configuration".into() },
                    RuleCondition { field: "description".into(), value: "program_upgrade".into() },
                ],
                window_seconds: 300,
                severity: Severity::Critical,
                mitre_id: Some("T1098".into()),
            },
            Self {
                name: "Rapid API abuse from single principal".into(),
                description: "More than 100 events from the same principal within 10 seconds across multiple classifications".into(),
                conditions: vec![
                    RuleCondition { field: "severity".into(), value: "high".into() },
                ],
                min_occurrences: 100,
                then_condition: vec![],
                window_seconds: 10,
                severity: Severity::High,
                mitre_id: Some("T1499".into()),
            },
            Self {
                name: "Contract upgrade via proxy".into(),
                description: "A proxy contract implementation address change detected".into(),
                conditions: vec![],
                min_occurrences: 1,
                then_condition: vec![
                    RuleCondition { field: "classification".into(), value: "configuration".into() },
                    RuleCondition { field: "description".into(), value: "proxy_upgrade".into() },
                ],
                window_seconds: 0,
                severity: Severity::High,
                mitre_id: Some("T1574".into()),
            },
            Self {
                name: "Liquidity removal from DEX pool".into(),
                description: "Large LP token burn without corresponding swap, indicating liquidity removal".into(),
                conditions: vec![],
                min_occurrences: 1,
                then_condition: vec![
                    RuleCondition { field: "classification".into(), value: "transaction".into() },
                    RuleCondition { field: "description".into(), value: "liquidity_removal".into() },
                ],
                window_seconds: 0,
                severity: Severity::High,
                mitre_id: Some("T1648".into()),
            },
            Self {
                name: "Oracle manipulation pattern".into(),
                description: "Transaction detected with off-chain oracle price deviation exceeding threshold".into(),
                conditions: vec![],
                min_occurrences: 1,
                then_condition: vec![
                    RuleCondition { field: "classification".into(), value: "transaction".into() },
                    RuleCondition { field: "description".into(), value: "oracle_manipulation".into() },
                ],
                window_seconds: 0,
                severity: Severity::Critical,
                mitre_id: Some("T1496".into()),
            },
            Self {
                name: "Multiple blocked transactions from same agent".into(),
                description: "An AI agent has 5 or more blocked transactions within a 120 second window".into(),
                conditions: vec![
                    RuleCondition { field: "classification".into(), value: "transaction".into() },
                    RuleCondition { field: "success".into(), value: "false".into() },
                ],
                min_occurrences: 5,
                then_condition: vec![],
                window_seconds: 120,
                severity: Severity::Medium,
                mitre_id: Some("T1068".into()),
            },
            Self {
                name: "Mint authority change detected".into(),
                description: "A transaction attempting to modify SPL token mint authority".into(),
                conditions: vec![],
                min_occurrences: 1,
                then_condition: vec![
                    RuleCondition { field: "classification".into(), value: "configuration".into() },
                    RuleCondition { field: "description".into(), value: "mint_authority_change".into() },
                ],
                window_seconds: 0,
                severity: Severity::Critical,
                mitre_id: Some("T1548".into()),
            },
            Self {
                name: "Freeze authority change detected".into(),
                description: "A transaction attempting to modify SPL token freeze authority".into(),
                conditions: vec![],
                min_occurrences: 1,
                then_condition: vec![
                    RuleCondition { field: "classification".into(), value: "configuration".into() },
                    RuleCondition { field: "description".into(), value: "freeze_authority_change".into() },
                ],
                window_seconds: 0,
                severity: Severity::High,
                mitre_id: Some("T1531".into()),
            },
            Self {
                name: "Risk labeled address interaction".into(),
                description: "Any transaction involving an address flagged by GrondOSINT risk database".into(),
                conditions: vec![],
                min_occurrences: 1,
                then_condition: vec![
                    RuleCondition { field: "classification".into(), value: "transaction".into() },
                    RuleCondition { field: "severity".into(), value: "high".into() },
                ],
                window_seconds: 0,
                severity: Severity::High,
                mitre_id: Some("T1204".into()),
            },
        ]
    }
}
