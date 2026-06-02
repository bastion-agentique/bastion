use serde::{Deserialize, Serialize};

/// A W3C-compliant DID Document for a Bastion agent.
/// Maps a `did:bastion:*` identifier to verification methods and service endpoints.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DidDocument {
    #[serde(rename = "@context")]
    pub context: Vec<String>,

    /// The DID identifier, e.g. "did:bastion:solana:BaSZuLcwj...Cb"
    pub id: String,

    /// The controller(s) of this DID
    #[serde(default)]
    pub controller: Vec<String>,

    /// Cryptographic verification methods
    #[serde(rename = "verificationMethod")]
    pub verification_method: Vec<VerificationMethod>,

    /// Service endpoints for interacting with the agent
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

/// A DID resolution request.
#[derive(Debug, Deserialize)]
pub struct DidResolveRequest {
    pub did: String,
}

/// A DID resolution result containing the DID document and metadata.
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
/// The DID identifier format is: `did:bastion:solana:{base58_agent_pda}`
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
            id: vm_id.clone(),
            kind: "Ed25519VerificationKey2020".to_string(),
            controller: did_id.to_string(),
            public_key_base58: agent_pda_base58.to_string(),
        }],
        service: vec![
            ServiceEndpoint {
                id: format!("{did_id}#sidecar"),
                kind: "BastionSidecarAPI".to_string(),
                service_endpoint: "http://localhost:3000".to_string(),
            },
            ServiceEndpoint {
                id: format!("{did_id}#agent-metadata"),
                kind: "AgentMetadata".to_string(),
                service_endpoint: serde_json::to_string(&serde_json::json!({
                    "name": agent_name,
                    "capability_bitmask": capability_bitmask,
                    "reputation_score": reputation_score,
                })).unwrap_or_default(),
            },
        ],
    }
}

/// Resolve a `did:bastion:solana:*` identifier by fetching the on-chain agent PDA.
/// Currently returns a mock/stub DID document for demonstration.
pub async fn resolve_did(did: &str) -> Option<DidResolveResult> {
    let parts: Vec<&str> = did.split(':').collect();
    if parts.len() < 4 || parts[0] != "did" || parts[1] != "bastion" {
        return None;
    }

    let chain = parts[2]; // "solana" or "midnight"
    let identifier = parts[3];

    let doc = match chain {
        "solana" => build_did_document(
            did,
            identifier,
            0b00000001, // default: TRANSFER capability
            100,        // default reputation
            "Bastion Agent",
        ),
        "midnight" => {
            // For Midnight, the identifier is a ZK commitment (Field value)
            let vm_id = format!("{did}#midnight-key");
            DidDocument {
                context: vec![
                    "https://www.w3.org/ns/did/v1".to_string(),
                    "https://w3id.org/security/suites/jubjub-2021/v1".to_string(),
                ],
                id: did.to_string(),
                controller: vec![did.to_string()],
                verification_method: vec![
                    VerificationMethod {
                        id: vm_id,
                        kind: "JubjubVerificationKey2021".to_string(),
                        controller: did.to_string(),
                        public_key_base58: identifier.to_string(),
                    },
                ],
                service: vec![
                    ServiceEndpoint {
                        id: format!("{did}#midnight-disclosure"),
                        kind: "MidnightSelectiveDisclosure".to_string(),
                        service_endpoint: "http://localhost:3000/midnight/disclose".to_string(),
                    },
                ],
            }
        }
        _ => return None,
    };

    Some(DidResolveResult {
        did_document: doc,
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
