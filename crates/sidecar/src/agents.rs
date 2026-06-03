use crate::did;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

/// A tracked agent registered with the sidecar.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackedAgent {
    /// The W3C DID identifier, e.g. "did:bastion:solana:{pda_base58}"
    pub did: String,
    /// Base58-encoded Solana pubkey of the agent authority.
    pub authority: String,
    /// Base58-encoded Agent PDA.
    pub agent_pda: String,
    /// Human-readable agent name.
    pub name: String,
    /// On-chain capability bitmask.
    pub capability_bitmask: u64,
    /// On-chain reputation score.
    pub reputation_score: u64,
    /// On-chain registration timestamp.
    pub registered_at: i64,
    /// The agent's own sidecar endpoint URL, if provided.
    pub sidecar_endpoint: Option<String>,
    /// Whether the on-chain Agent PDA has been verified.
    pub on_chain_verified: bool,
}

/// Request body for agent self-registration.
#[derive(Debug, Deserialize)]
pub struct RegisterAgentRequest {
    pub did: String,
    pub authority_pubkey: String,
    pub sidecar_endpoint: Option<String>,
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
            sidecar_endpoint,
            on_chain_verified: true,
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
