use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::RwLock;
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyConfig {
    pub allowed_target_ids: Vec<String>,
    pub allowed_selectors: Vec<String>,
    pub max_value_per_tx: u64,
    pub daily_tx_limit: u32,
    pub cooldown_seconds: u64,
    pub max_gas_per_tx: Option<u64>,
}

#[derive(Debug, Clone)]
struct PolicyState {
    config: PolicyConfig,
    version: u32,
    tx_count: u32,
    window_start: u64,
    last_tx: u64,
}

#[derive(Debug, Error)]
pub enum PolicyError {
    #[error("PolicyNotSet")]
    PolicyNotSet,
    #[error("PolicyInactive")]
    PolicyInactive,
    #[error("TargetNotAllowed")]
    TargetNotAllowed,
    #[error("ValueExceedsLimit")]
    ValueExceedsLimit,
    #[error("DailyTxLimitExceeded")]
    DailyTxLimitExceeded,
    #[error("CooldownNotElapsed")]
    CooldownNotElapsed,
}

pub struct PolicyEngine {
    policies: RwLock<HashMap<String, PolicyState>>,
}

impl PolicyEngine {
    pub fn new(_db_path: &str) -> anyhow::Result<Self> {
        Ok(Self {
            policies: RwLock::new(HashMap::new()),
        })
    }

    pub fn set_policy(&self, agent_id: String, config: PolicyConfig) -> u32 {
        let mut policies = self.policies.write().unwrap();
        let version = policies
            .get(&agent_id)
            .map(|p| p.version + 1)
            .unwrap_or(0);

        let now = unix_now();
        policies.insert(
            agent_id,
            PolicyState {
                config,
                version,
                tx_count: 0,
                window_start: now,
                last_tx: 0,
            },
        );
        version
    }

    pub fn remove_policy(&self, agent_id: &str) {
        self.policies.write().unwrap().remove(agent_id);
    }

    pub fn has_policy(&self, agent_id: &str) -> bool {
        self.policies.read().unwrap().contains_key(agent_id)
    }

    pub fn check_transaction(
        &self,
        agent_id: &str,
        target: &str,
        value: u64,
        selector: &str,
    ) -> Result<(), PolicyError> {
        let mut policies = self.policies.write().unwrap();
        let state = policies.get_mut(agent_id).ok_or(PolicyError::PolicyNotSet)?;

        let now = unix_now();
        let config = &state.config;

        // Check target allowlist (target must appear in allowed_target_ids)
        // In production, target is hashed to match committed IDs
        let target_hash = format!("{:x}", md5_hash(target));
        if !config.allowed_target_ids.is_empty()
            && !config
                .allowed_target_ids
                .iter()
                .any(|t| t == target || t == &target_hash)
        {
            return Err(PolicyError::TargetNotAllowed);
        }

        // Check selector allowlist
        if !config.allowed_selectors.is_empty()
            && !config.allowed_selectors.iter().any(|s| s == selector)
        {
            return Err(PolicyError::TargetNotAllowed);
        }

        // Check value limit
        if value > config.max_value_per_tx {
            return Err(PolicyError::ValueExceedsLimit);
        }

        // Reset daily window if expired
        if now >= state.window_start + 86_400 {
            state.tx_count = 0;
            state.window_start = now;
        }

        // Check daily limit
        if state.tx_count >= config.daily_tx_limit {
            return Err(PolicyError::DailyTxLimitExceeded);
        }

        // Check cooldown
        if state.last_tx > 0 && now < state.last_tx + config.cooldown_seconds {
            return Err(PolicyError::CooldownNotElapsed);
        }

        // All checks passed — update state
        state.tx_count += 1;
        state.last_tx = now;

        Ok(())
    }
}

fn unix_now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn md5_hash(s: &str) -> u64 {
    use std::hash::{Hash, Hasher};
    let mut h = std::collections::hash_map::DefaultHasher::new();
    s.hash(&mut h);
    std::hash::Hasher::finish(&h)
}
