use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CaseStatus {
    #[serde(rename = "open")]
    Open,
    #[serde(rename = "in_progress")]
    InProgress,
    #[serde(rename = "resolved")]
    Resolved,
    #[serde(rename = "closed")]
    Closed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Case {
    pub id: String,
    pub title: String,
    pub description: String,
    pub status: CaseStatus,
    pub assigned_to: Option<String>,
    pub evidence_hashes: Vec<String>,
    pub created_at: u64,
    pub updated_at: u64,
    pub resolved_at: Option<u64>,
    pub linked_event_ids: Vec<String>,
}

impl Case {
    pub fn new(title: String, description: String, event_ids: Vec<String>) -> Self {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        Self {
            id: uuid::Uuid::new_v4().to_string(),
            title,
            description,
            status: CaseStatus::Open,
            assigned_to: None,
            evidence_hashes: vec![],
            created_at: now,
            updated_at: now,
            resolved_at: None,
            linked_event_ids: event_ids,
        }
    }

    pub fn assign(&mut self, analyst: String) {
        self.assigned_to = Some(analyst);
        self.status = CaseStatus::InProgress;
        self.updated_at = Self::now_secs();
    }

    pub fn resolve(&mut self) {
        let now = Self::now_secs();
        self.status = CaseStatus::Resolved;
        self.resolved_at = Some(now);
        self.updated_at = now;
    }

    pub fn close(&mut self) {
        self.status = CaseStatus::Closed;
        self.updated_at = Self::now_secs();
    }

    pub fn add_evidence(&mut self, tx_hash: String) {
        self.evidence_hashes.push(tx_hash);
        self.updated_at = Self::now_secs();
    }

    fn now_secs() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
    }
}

/// In-memory case store backed by a Vec and serialized to Sled DB.
/// For production, this would use a proper database.
#[derive(Debug)]
pub struct CaseStore {
    cases: Vec<Case>,
}

impl CaseStore {
    pub fn new() -> Self {
        Self { cases: vec![] }
    }

    pub fn create(&mut self, title: String, description: String, event_ids: Vec<String>) -> &Case {
        let case = Case::new(title, description, event_ids);
        self.cases.push(case);
        self.cases.last().unwrap()
    }

    pub fn list(&self) -> &[Case] {
        &self.cases
    }

    pub fn get(&self, id: &str) -> Option<&Case> {
        self.cases.iter().find(|c| c.id == id)
    }

    pub fn get_mut(&mut self, id: &str) -> Option<&mut Case> {
        self.cases.iter_mut().find(|c| c.id == id)
    }
}

impl Default for CaseStore {
    fn default() -> Self {
        Self::new()
    }
}
