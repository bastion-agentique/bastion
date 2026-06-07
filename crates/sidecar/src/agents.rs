use crate::did;
use base64::Engine as _;
use serde::{Deserialize, Serialize};
use solana_sdk::signature::{Keypair, Signer};

/// A tracked agent registered with the sidecar.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackedAgent {
    // ── Core Identity ──
    pub did: String,
    pub authority: String,
    pub agent_pda: String,
    pub name: String,

    // ── Capabilities & Reputation ──
    pub capability_bitmask: u64,
    pub reputation_score: u64,

    // ── On-chain metadata ──
    pub registered_at: i64,
    pub staked_lamports: u64,
    pub stake_unlock_at: i64,

    // ── Delegation ──
    pub parent_did: Option<String>,
    pub delegation_depth: Option<u8>,
    pub child_dids: Vec<String>,
    pub is_delegator: bool,

    // ── Connectivity ──
    pub sidecar_endpoint: Option<String>,
    pub on_chain_verified: bool,

    // ── Physical / Robot Identity ──
    #[serde(default)]
    pub device_type: Option<String>,
    #[serde(default)]
    pub firmware_version: Option<String>,
    #[serde(default)]
    pub last_known_location: Option<(f64, f64)>,
}

/// Request body for agent self-registration.
#[derive(Debug, Deserialize)]
pub struct RegisterAgentRequest {
    pub did: String,
    pub authority_pubkey: String,
    pub sidecar_endpoint: Option<String>,
    #[serde(default)]
    pub device_type: Option<String>,
    #[serde(default)]
    pub firmware_version: Option<String>,
    #[serde(default)]
    pub last_known_location: Option<(f64, f64)>,
}

/// Request body for robot telemetry updates.
#[derive(Debug, Deserialize)]
pub struct TelemetryUpdateRequest {
    pub location: Option<(f64, f64)>,
    pub firmware_version: Option<String>,
    pub battery_level: Option<u8>,
}

/// Response when generating a new DID keypair.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedDID {
    pub did: String,
    pub authority_pubkey: String,
    /// Base64-encoded Ed25519 secret key. Shown once — agent must store it.
    pub secret_key_base64: String,
}

/// Generate a new Ed25519 keypair and return a `did:bastion:solana:{pubkey}` identifier.
pub fn generate_did_keypair() -> GeneratedDID {
    let keypair = Keypair::new();
    let pubkey = keypair.pubkey().to_string();
    let did = format!("did:bastion:solana:{pubkey}");
    let secret_bytes = keypair.to_bytes();
    let secret_key_base64 = base64::engine::general_purpose::STANDARD.encode(secret_bytes);

    GeneratedDID {
        did,
        authority_pubkey: pubkey,
        secret_key_base64,
    }
}

/// Sled-backed persistent registry of Bastion agents, keyed by DID.
#[derive(Clone)]
pub struct AgentStore {
    db: sled::Db,
}

impl AgentStore {
    pub fn new(db_path: &str) -> Result<Self, String> {
        let db = sled::open(db_path).map_err(|e| format!("Failed to open agent store: {e}"))?;
        Ok(Self { db })
    }

    /// Register a new agent. Persists to Sled. Returns the DID on success.
    #[allow(clippy::too_many_arguments)]
    pub fn register_agent(
        &self,
        did: &str,
        authority_pubkey: &str,
        agent_pda: &str,
        name: &str,
        capability_bitmask: u64,
        reputation_score: u64,
        registered_at: i64,
        sidecar_endpoint: Option<String>,
        device_type: Option<String>,
        firmware_version: Option<String>,
        last_known_location: Option<(f64, f64)>,
    ) -> Result<String, String> {
        if self.db.contains_key(did).map_err(|e| e.to_string())? {
            return Err(format!("Agent with DID {did} already registered"));
        }

        let agent = TrackedAgent {
            did: did.to_string(),
            authority: authority_pubkey.to_string(),
            agent_pda: agent_pda.to_string(),
            name: name.to_string(),
            capability_bitmask,
            reputation_score,
            registered_at,
            staked_lamports: 0,
            stake_unlock_at: 0,
            sidecar_endpoint,
            on_chain_verified: true,
            parent_did: None,
            delegation_depth: Some(0),
            child_dids: Vec::new(),
            is_delegator: false,
            device_type,
            firmware_version,
            last_known_location,
        };

        let json = serde_json::to_vec(&agent).map_err(|e| e.to_string())?;
        self.db
            .insert(did.as_bytes(), json)
            .map_err(|e| e.to_string())?;
        self.db.flush().map_err(|e| e.to_string())?;
        Ok(did.to_string())
    }

    /// Update an existing agent's reputation.
    pub fn update_agent(&self, did: &str, reputation_score: u64) -> Result<(), String> {
        let mut agent = self
            .get_agent(did)
            .ok_or(format!("Agent {did} not found"))?;
        agent.reputation_score = reputation_score;
        let json = serde_json::to_vec(&agent).map_err(|e| e.to_string())?;
        self.db
            .insert(did.as_bytes(), json)
            .map_err(|e| e.to_string())?;
        self.db.flush().map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Save a full agent record (for delegation updates, etc.).
    pub fn save_agent(&self, agent: &TrackedAgent) -> Result<(), String> {
        let json = serde_json::to_vec(agent).map_err(|e| e.to_string())?;
        self.db
            .insert(agent.did.as_bytes(), json)
            .map_err(|e| e.to_string())?;
        self.db.flush().map_err(|e| e.to_string())?;
        Ok(())
    }

    /// List all tracked agents.
    pub fn list_agents(&self) -> Result<Vec<TrackedAgent>, String> {
        self.db
            .iter()
            .filter_map(|r| {
                let (_, val) = r.ok()?;
                let agent: TrackedAgent = serde_json::from_slice(&val).ok()?;
                Some(agent)
            })
            .collect::<Vec<_>>()
            .pipe(Ok)
    }

    /// Get a single agent by DID.
    pub fn get_agent(&self, did: &str) -> Option<TrackedAgent> {
        let val = self.db.get(did.as_bytes()).ok()??;
        serde_json::from_slice(&val).ok()
    }

    /// Look up agent by authority pubkey.
    pub fn find_by_authority(&self, authority: &str) -> Option<TrackedAgent> {
        self.db
            .iter()
            .filter_map(|r| {
                let (_, val) = r.ok()?;
                let agent: TrackedAgent = serde_json::from_slice(&val).ok()?;
                if agent.authority == authority {
                    Some(agent)
                } else {
                    None
                }
            })
            .next()
    }

    /// Build a W3C DID document for a registered agent.
    pub fn build_did_document(&self, did: &str) -> Option<did::DidResolveResult> {
        let agent = self.get_agent(did)?;
        let doc = did::build_did_document(
            did,
            &agent.agent_pda,
            agent.capability_bitmask,
            agent.reputation_score,
            &agent.name,
        );
        Some(did::DidResolveResult {
            did_document: doc,
            metadata: did::DidResolutionMetadata {
                content_type: "application/did+ld+json".to_string(),
                retrieved: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs()
                    .to_string(),
            },
        })
    }
}

/// Tiny helper trait to turn iterator collect into Result.
trait Pipe<T> {
    fn pipe<F, R>(self, f: F) -> R
    where
        F: FnOnce(T) -> R;
}

impl<T> Pipe<T> for T {
    fn pipe<F, R>(self, f: F) -> R
    where
        F: FnOnce(T) -> R,
    {
        f(self)
    }
}
