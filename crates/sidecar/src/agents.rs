use crate::did;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

/// A tracked agent registered with the sidecar.
///
/// Extended for robot/IoT fleet support: physical device identity fields
/// (device_type, firmware_version, last_known_location) enable the firewall
/// to track and enforce policies on autonomous robots with DID-based identity.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackedAgent {
    // ── Core Identity ──
    /// The W3C DID identifier, e.g. "did:bastion:solana:{pda_base58}"
    pub did: String,
    /// Base58-encoded Solana pubkey of the agent authority.
    pub authority: String,
    /// Base58-encoded Agent PDA.
    pub agent_pda: String,
    /// Human-readable agent name.
    pub name: String,

    // ── Capabilities & Reputation ──
    /// On-chain capability bitmask.
    pub capability_bitmask: u64,
    /// On-chain reputation score.
    pub reputation_score: u64,

    // ── On-chain metadata ──
    /// On-chain registration timestamp.
    pub registered_at: i64,
    /// SOL staked for reputation weighting.
    pub staked_lamports: u64,
    /// Earliest timestamp when stake can be claimed (0 if no pending unstake).
    pub stake_unlock_at: i64,

    // ── Delegation ──
    /// DID of the parent agent (None for root agents).
    pub parent_did: Option<String>,
    /// Delegation depth in the hierarchy (0 for root).
    pub delegation_depth: Option<u8>,
    /// DIDs of direct children agents.
    pub child_dids: Vec<String>,
    /// Whether this agent can spawn sub-agents.
    pub is_delegator: bool,

    // ── Connectivity ──
    /// The agent's own sidecar endpoint URL, if provided.
    pub sidecar_endpoint: Option<String>,
    /// Whether the on-chain Agent PDA has been verified.
    pub on_chain_verified: bool,

    // ── Physical / Robot Identity ──
    /// Physical device type (e.g. "drone", "rover", "industrial_arm", "agv", "none" for pure-software agents).
    #[serde(default)]
    pub device_type: Option<String>,
    /// Firmware or software version (e.g. "v1.4.2", "commit-sha").
    #[serde(default)]
    pub firmware_version: Option<String>,
    /// Last known GPS coordinates as [latitude, longitude], or None if unknown.
    #[serde(default)]
    pub last_known_location: Option<(f64, f64)>,
}

/// Request body for agent self-registration.
#[derive(Debug, Deserialize)]
pub struct RegisterAgentRequest {
    pub did: String,
    pub authority_pubkey: String,
    pub sidecar_endpoint: Option<String>,
    /// Physical device type for robot agents (e.g. "drone", "rover", "agv").
    #[serde(default)]
    pub device_type: Option<String>,
    /// Firmware or software version string.
    #[serde(default)]
    pub firmware_version: Option<String>,
    /// Last known GPS location [lat, lon].
    #[serde(default)]
    pub last_known_location: Option<(f64, f64)>,
}

/// Request body for robot telemetry updates.
#[derive(Debug, Deserialize)]
pub struct TelemetryUpdateRequest {
    /// Last known GPS coordinates [lat, lon].
    pub location: Option<(f64, f64)>,
    /// Current firmware version.
    pub firmware_version: Option<String>,
    /// Current battery level 0-100.
    pub battery_level: Option<u8>,
}

/// In-memory registry of Bastion agents, keyed by DID.
#[derive(Clone, Default)]
pub struct AgentStore {
    agents: Arc<RwLock<HashMap<String, TrackedAgent>>>,
}

impl AgentStore {
    pub fn new() -> Self {
        Self {
            agents: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Register a new agent. Caller should verify the Agent PDA exists on-chain
    /// before calling this. Returns the DID on success.
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
        let mut agents = self.agents.write().map_err(|e| e.to_string())?;
        if agents.contains_key(did) {
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

        agents.insert(did.to_string(), agent);
        Ok(did.to_string())
    }

    /// Update an existing agent's reputation and capabilities from on-chain data.
    pub fn update_agent(&self, did: &str, reputation_score: u64) -> Result<(), String> {
        let mut agents = self.agents.write().map_err(|e| e.to_string())?;
        if let Some(agent) = agents.get_mut(did) {
            agent.reputation_score = reputation_score;
            Ok(())
        } else {
            Err(format!("Agent {did} not found"))
        }
    }

    /// List all tracked agents.
    pub fn list_agents(&self) -> Result<Vec<TrackedAgent>, String> {
        let agents = self.agents.read().map_err(|e| e.to_string())?;
        Ok(agents.values().cloned().collect())
    }

    /// Get a single agent by DID.
    pub fn get_agent(&self, did: &str) -> Option<TrackedAgent> {
        let agents = self.agents.read().ok()?;
        agents.get(did).cloned()
    }

    /// Look up agent by authority pubkey.
    pub fn find_by_authority(&self, authority: &str) -> Option<TrackedAgent> {
        let agents = self.agents.read().ok()?;
        agents.values().find(|a| a.authority == authority).cloned()
    }

    /// Get direct write access to the agents map for delegation updates.
    pub fn agents_write(&self) -> Result<std::sync::RwLockWriteGuard<'_, HashMap<String, TrackedAgent>>, String> {
        self.agents.write().map_err(|e| e.to_string())
    }

    /// Build a W3C DID document for a registered agent using live on-chain data.
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
