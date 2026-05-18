use crate::policy::types::PolicyRule;
use serde::{Deserialize, Serialize};

/// A composable, ordered collection of policy rules applied to an agent.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PolicySet {
    pub rules: Vec<PolicyRule>,
}

impl PolicySet {
    pub fn new() -> Self {
        Self { rules: Vec::new() }
    }

    pub fn with_rule(mut self, rule: PolicyRule) -> Self {
        self.rules.push(rule);
        self
    }

    pub fn add(&mut self, rule: PolicyRule) {
        self.rules.push(rule);
    }

    pub fn is_empty(&self) -> bool {
        self.rules.is_empty()
    }

    pub fn len(&self) -> usize {
        self.rules.len()
    }
}
