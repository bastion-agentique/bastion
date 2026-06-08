use serde::{Deserialize, Serialize};

/// A W3C-compliant DID Document for a Bastion agent.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DidDocument {
    #[serde(rename = "@context")]
    pub context: Vec<String>,
    pub id: String,
    #[serde(default)]
    pub controller: Vec<String>,
    #[serde(rename = "verificationMethod")]
    pub verification_method: Vec<VerificationMethod>,
    #[serde(default)]
    pub service: Vec<ServiceEndpoint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationMethod {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub controller: String,
    #[serde(rename = "publicKeyBase58")]
    pub public_key_base58: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceEndpoint {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(rename = "serviceEndpoint")]
    pub service_endpoint: String,
}

#[derive(Debug, Deserialize)]
pub struct DidResolveRequest {
    pub did: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DidResolveResult {
    #[serde(rename = "didDocument")]
    pub did_document: DidDocument,
    #[serde(rename = "didResolutionMetadata")]
    pub metadata: DidResolutionMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DidResolutionMetadata {
    #[serde(rename = "contentType")]
    pub content_type: String,
    pub retrieved: String,
}

/// Build a DID document for a Solana agent from its on-chain PDA data.
pub fn build_did_document(
    did_id: &str,
    agent_pda_base58: &str,
    capability_bitmask: u64,
    reputation_score: u64,
    agent_name: &str,
) -> DidDocument {
    let vm_id = format!("{did_id}#keys-1");

    DidDocument {
        context: vec![
            "https://www.w3.org/ns/did/v1".to_string(),
            "https://w3id.org/security/suites/ed25519-2020/v1".to_string(),
        ],
        id: did_id.to_string(),
        controller: vec![did_id.to_string()],
        verification_method: vec![VerificationMethod {
            id: vm_id,
            kind: "Ed25519VerificationKey2020".to_string(),
            controller: did_id.to_string(),
            public_key_base58: agent_pda_base58.to_string(),
        }],
        service: vec![
            ServiceEndpoint {
                id: format!("{did_id}#sidecar"),
                kind: "BastionSidecarAPI".to_string(),
                service_endpoint: "https://bastion-agentique.fly.dev/".to_string(),
            },
            ServiceEndpoint {
                id: format!("{did_id}#agent-metadata"),
                kind: "AgentMetadata".to_string(),
                service_endpoint: serde_json::to_string(&serde_json::json!({
                    "name": agent_name,
                    "capability_bitmask": capability_bitmask,
                    "reputation_score": reputation_score,
                }))
                .unwrap_or_default(),
            },
        ],
    }
}

/// Resolve a `did:bastion:solana:*` identifier by looking up the AgentStore.
/// Falls back to a stub document for unknown DIDs.
pub async fn resolve_did(
    did: &str,
    agent_store: &crate::agents::AgentStore,
) -> Option<DidResolveResult> {
    let parts: Vec<&str> = did.split(':').collect();
    if parts.len() < 4 || parts[0] != "did" || parts[1] != "bastion" {
        return None;
    }

    let chain = parts[2];

    match chain {
        "solana" => {
            // Try the agent store first (real registered agents)
            if let Some(result) = agent_store.build_did_document(did) {
                return Some(result);
            }
            // Fallback: return stub document for unregistered DIDs
            let identifier = parts[3];
            Some(DidResolveResult {
                did_document: build_did_document(did, identifier, 0b00000001, 100, "Bastion Agent"),
                metadata: DidResolutionMetadata {
                    content_type: "application/did+ld+json".to_string(),
                    retrieved: std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs()
                        .to_string(),
                },
            })
        }
        "midnight" => {
            let identifier = parts[3];
            let vm_id = format!("{did}#midnight-key");
            Some(DidResolveResult {
                did_document: DidDocument {
                    context: vec![
                        "https://www.w3.org/ns/did/v1".to_string(),
                        "https://w3id.org/security/suites/jubjub-2021/v1".to_string(),
                    ],
                    id: did.to_string(),
                    controller: vec![did.to_string()],
                    verification_method: vec![VerificationMethod {
                        id: vm_id,
                        kind: "JubjubVerificationKey2021".to_string(),
                        controller: did.to_string(),
                        public_key_base58: identifier.to_string(),
                    }],
                    service: vec![ServiceEndpoint {
                        id: format!("{did}#midnight-disclosure"),
                        kind: "MidnightSelectiveDisclosure".to_string(),
                        service_endpoint: "https://bastion-agentique.fly.dev/midnight/disclose"
                            .to_string(),
                    }],
                },
                metadata: DidResolutionMetadata {
                    content_type: "application/did+ld+json".to_string(),
                    retrieved: std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs()
                        .to_string(),
                },
            })
        }
        _ => None,
    }
}
