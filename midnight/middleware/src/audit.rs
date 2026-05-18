use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntryRecord {
    pub entry_id: String,
    pub agent_id_hash: String,
    pub target_hash: String,
    pub value: u64,
    pub selector: String,
    pub allowed: bool,
    pub proof_hash: String,
    pub timestamp: u64,
    pub commitment: String,
}

pub struct AuditLogger {
    // In production: backed by Midnight on-chain commitments
    // Here: local sled DB for devnet testing
    entries: RwLock<HashMap<String, AuditEntryRecord>>,
    agent_entries: RwLock<HashMap<String, Vec<String>>>,
}

impl AuditLogger {
    pub fn new(_db_path: &str) -> anyhow::Result<Self> {
        Ok(Self {
            entries: RwLock::new(HashMap::new()),
            agent_entries: RwLock::new(HashMap::new()),
        })
    }

    pub fn log_entry(
        &self,
        agent_id: &str,
        target: &str,
        value: u64,
        selector: &str,
        allowed: bool,
        proof_hash: &str,
    ) -> String {
        let timestamp = unix_now();
        let count = self.get_agent_entry_count(agent_id);

        let entry_id = derive_entry_id(agent_id, target, selector, timestamp, count as u64);
        let commitment = derive_commitment(agent_id, target, value, selector, allowed, &entry_id);
        let agent_id_hash = sha256_hex(agent_id);
        let target_hash = sha256_hex(target);

        let record = AuditEntryRecord {
            entry_id: entry_id.clone(),
            agent_id_hash,
            target_hash,
            value,
            selector: selector.to_string(),
            allowed,
            proof_hash: proof_hash.to_string(),
            timestamp,
            commitment,
        };

        {
            let mut entries = self.entries.write().unwrap();
            entries.insert(entry_id.clone(), record);
        }
        {
            let mut agent_entries = self.agent_entries.write().unwrap();
            agent_entries
                .entry(agent_id.to_string())
                .or_default()
                .push(entry_id.clone());
        }

        entry_id
    }

    pub fn get_entries(
        &self,
        agent_id: &str,
        from: Option<u64>,
        to: Option<u64>,
    ) -> Vec<serde_json::Value> {
        let agent_entries = self.agent_entries.read().unwrap();
        let entries = self.entries.read().unwrap();

        let ids = match agent_entries.get(agent_id) {
            Some(ids) => ids.clone(),
            None => return vec![],
        };

        ids.iter()
            .filter_map(|id| entries.get(id))
            .filter(|e| {
                from.map_or(true, |f| e.timestamp >= f)
                    && to.map_or(true, |t| e.timestamp <= t)
            })
            .map(|e| {
                // Return only public data (commitment + decision)
                serde_json::json!({
                    "entry_id": e.entry_id,
                    "allowed": e.allowed,
                    "timestamp": e.timestamp,
                    "commitment": e.commitment,
                })
            })
            .collect()
    }

    pub fn get_agent_entry_count(&self, agent_id: &str) -> usize {
        self.agent_entries
            .read()
            .unwrap()
            .get(agent_id)
            .map_or(0, |v| v.len())
    }
}

fn derive_entry_id(agent_id: &str, target: &str, selector: &str, timestamp: u64, count: u64) -> String {
    let data = format!("{agent_id}|{target}|{selector}|{timestamp}|{count}");
    sha256_hex(&data)
}

fn derive_commitment(
    agent_id: &str,
    target: &str,
    value: u64,
    selector: &str,
    allowed: bool,
    nonce: &str,
) -> String {
    let data = format!("{agent_id}|{target}|{value}|{selector}|{allowed}|{nonce}");
    sha256_hex(&data)
}

pub fn sha256_hex(s: &str) -> String {
    let mut h = Sha256::new();
    h.update(s.as_bytes());
    hex::encode(h.finalize())
}

fn unix_now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
