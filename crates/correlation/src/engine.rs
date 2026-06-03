use crate::buffer::EventBuffer;
use crate::rules::{CorrelationRule, Severity};
use bastion_core::event::SecurityEvent;
use serde::{Deserialize, Serialize};

/// An alert produced when a correlation rule matches a pattern of events.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorrelationAlert {
    /// Unique alert identifier
    pub id: String,

    /// Timestamp when the alert was generated
    pub timestamp: u64,

    /// Name of the rule that triggered
    pub rule_name: String,

    /// Human-readable description of the triggered rule
    pub rule_description: String,

    /// Severity of the alert
    pub severity: Severity,

    /// IDs of the contributing events that matched the rule
    pub event_ids: Vec<String>,

    /// MITRE ATT&CK technique ID if mapped
    #[serde(default)]
    pub mitre_id: Option<String>,

    /// Whether this alert has been acknowledged by an analyst
    #[serde(default)]
    pub acknowledged: bool,
}

impl CorrelationAlert {
    pub fn new(rule: &CorrelationRule, event_ids: Vec<String>) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
            rule_name: rule.name.clone(),
            rule_description: rule.description.clone(),
            severity: rule.severity,
            event_ids,
            mitre_id: rule.mitre_id.clone(),
            acknowledged: false,
        }
    }
}

/// The correlation engine that processes buffered events against rules.
pub struct CorrelationEngine {
    buffer: EventBuffer,
    rules: Vec<CorrelationRule>,
    alerts: Vec<CorrelationAlert>,
}

impl CorrelationEngine {
    pub fn new(capacity: usize, window_seconds: u64, rules: Vec<CorrelationRule>) -> Self {
        Self {
            buffer: EventBuffer::new(capacity, window_seconds),
            rules,
            alerts: Vec::with_capacity(256),
        }
    }

    /// Feed a new event and run all correlation rules against the buffer.
    pub async fn ingest(&mut self, event: SecurityEvent) -> Vec<CorrelationAlert> {
        self.buffer.push(event);
        let mut new_alerts = Vec::new();

        for rule in &self.rules {
            if let Some(alert) = self.evaluate_rule(rule) {
                new_alerts.push(alert);
            }
        }

        self.alerts.extend(new_alerts.iter().cloned());
        new_alerts
    }

    /// Evaluate a single correlation rule against the current buffer.
    fn evaluate_rule(&self, rule: &CorrelationRule) -> Option<CorrelationAlert> {
        let events: Vec<&SecurityEvent> = self.buffer.events().iter().collect();

        if events.is_empty() {
            return None;
        }

        // Check if the most recent event matches the then_condition (trigger)
        let trigger = events.last().unwrap();
        if !rule.then_condition.is_empty() {
            let trigger_matches = rule.then_condition.iter().all(|cond| {
                matches_condition(trigger, cond)
            });
            if !trigger_matches {
                return None;
            }
        }

        // Look back through the window for matching lead-up events
        let now = trigger.timestamp;
        let cutoff = now.saturating_sub(rule.window_seconds);

        let mut matching_event_ids = Vec::new();

        for event in events.iter().rev().skip(1) {
            if event.timestamp < cutoff {
                break;
            }

            let all_match = rule.conditions.iter().all(|cond| matches_condition(event, cond));
            if all_match {
                matching_event_ids.push(event.id.clone());
            }
        }

        if matching_event_ids.len() as u32 >= rule.min_occurrences {
            matching_event_ids.push(trigger.id.clone());
            Some(CorrelationAlert::new(rule, matching_event_ids))
        } else if rule.then_condition.is_empty() && !matching_event_ids.is_empty() {
            // If no then_condition, the trigger itself counts
            let total = matching_event_ids.len() + 1;
            if total as u32 >= rule.min_occurrences {
                matching_event_ids.push(trigger.id.clone());
                Some(CorrelationAlert::new(rule, matching_event_ids))
            } else {
                None
            }
        } else {
            None
        }
    }

    /// Return a reference to all alerts generated so far.
    pub fn alerts(&self) -> &[CorrelationAlert] {
        &self.alerts
    }

    /// Acknowledge an alert by ID.
    pub fn acknowledge(&mut self, alert_id: &str) -> bool {
        if let Some(alert) = self.alerts.iter_mut().find(|a| a.id == alert_id) {
            alert.acknowledged = true;
            true
        } else {
            false
        }
    }

    /// Get the current buffer.
    pub fn buffer(&self) -> &EventBuffer {
        &self.buffer
    }
}

fn matches_condition(event: &SecurityEvent, condition: &crate::rules::RuleCondition) -> bool {
    let field_value = match condition.field.as_str() {
        "classification" => &event.classification,
        "source" => &event.source,
        "principal" => event.principal.as_deref().unwrap_or(""),
        "target" => event.target.as_deref().unwrap_or(""),
        "description" => event.description.as_deref().unwrap_or(""),
        "severity" => &event.severity,
        "success" => {
            return event.success == Some(condition.value == "true");
        }
        _ => "",
    };

    let cond_val = condition.value.as_str();

    // Support value comparisons like ">5000000000"
    if let Some(threshold_str) = cond_val.strip_prefix('>') {
        if let (Some(event_val), Ok(threshold)) = (event.value, threshold_str.parse::<u64>()) {
            return event_val > threshold;
        }
        return false;
    }
    if let Some(threshold_str) = cond_val.strip_prefix('<') {
        if let (Some(event_val), Ok(threshold)) = (event.value, threshold_str.parse::<u64>()) {
            return event_val < threshold;
        }
        return false;
    }

    field_value == cond_val
}
