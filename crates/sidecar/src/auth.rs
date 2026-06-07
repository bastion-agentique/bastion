use axum::{
    Json,
    body::Body,
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use base64::Engine as _;
use serde::{Deserialize, Serialize};
use serde_json::json;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::Signature;
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

/// A pending authentication nonce.
#[derive(Debug, Clone)]
struct NonceEntry {
    /// The challenge string the agent must sign.
    nonce: String,
    /// When this nonce expires.
    expires_at: Instant,
}

/// Thread-safe nonce store for challenge-response auth.
#[derive(Clone, Default)]
pub struct NonceStore {
    nonces: Arc<RwLock<HashMap<String, NonceEntry>>>,
}

impl NonceStore {
    pub fn new() -> Self {
        Self {
            nonces: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Generate and store a nonce for a given DID. Returns the nonce string.
    pub async fn generate(&self, did: &str) -> String {
        let nonce = format!("bastion-auth:{}:{}", did, uuid::Uuid::new_v4());
        let entry = NonceEntry {
            nonce: nonce.clone(),
            expires_at: Instant::now() + Duration::from_secs(60),
        };
        self.nonces.write().await.insert(did.to_string(), entry);
        nonce
    }

    /// Consume and validate a nonce for a DID. Returns true if valid (one-time use).
    pub async fn consume(&self, did: &str, nonce: &str) -> bool {
        let mut nonces = self.nonces.write().await;
        #[allow(clippy::collapsible_if)]
        if let Some(entry) = nonces.get(did) {
            if entry.nonce == nonce && Instant::now() < entry.expires_at {
                nonces.remove(did);
                return true;
            }
        }
        false
    }

    /// Cleanup expired nonces (call periodically).
    pub async fn cleanup(&self) {
        let now = Instant::now();
        self.nonces
            .write()
            .await
            .retain(|_, entry| now < entry.expires_at);
    }
}

/// Request to initiate DID authentication (get a challenge nonce).
#[derive(Debug, Deserialize)]
pub struct AuthNonceRequest {
    pub did: String,
}

/// Response with the challenge nonce.
#[derive(Debug, Serialize)]
pub struct AuthNonceResponse {
    pub nonce: String,
    pub expires_in_seconds: u64,
}

/// Request to authenticate with a DID signature.
#[derive(Debug, Deserialize)]
pub struct AuthVerifyRequest {
    pub did: String,
    pub nonce: String,
    /// Base64-encoded Ed25519 signature of the nonce.
    pub signature: String,
}

/// DID-based authentication middleware.
///
/// Flow:
/// 1. Agent calls `POST /auth/nonce` with `{ "did": "..." }` → gets nonce
/// 2. Agent signs the nonce with its Ed25519 authority key
/// 3. Agent sends requests with headers:
///    - `X-DID: did:bastion:solana:...`
///    - `X-DID-Nonce: <the-nonce>`
///    - `X-DID-Signature: <base64-encoded-signature>`
///
/// Falls back to API key auth if `BASTION_API_KEY` is set.
pub async fn require_did_auth(req: Request<Body>, next: Next) -> Response {
    // Check for DID auth headers first
    let did = req.headers().get("X-DID").and_then(|v| v.to_str().ok());
    let nonce = req
        .headers()
        .get("X-DID-Nonce")
        .and_then(|v| v.to_str().ok());
    let signature = req
        .headers()
        .get("X-DID-Signature")
        .and_then(|v| v.to_str().ok());

    if let (Some(did), Some(nonce), Some(sig_b64)) = (did, nonce, signature) {
        // DID-based auth: verify signature
        #[allow(clippy::collapsible_if)]
        if let Some(auth_state) = req.extensions().get::<DidAuthState>().cloned() {
            if verify_did_signature(did, nonce, sig_b64, &auth_state).await {
                return next.run(req).await;
            }
        }

        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": "Invalid DID authentication" })),
        )
            .into_response();
    }

    // Fallback: API key auth (legacy)
    let expected = match std::env::var("BASTION_API_KEY") {
        Ok(k) if !k.is_empty() => k,
        _ => return next.run(req).await,
    };

    let provided = req
        .headers()
        .get("X-API-Key")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if provided != expected {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": "Invalid or missing X-API-Key header" })),
        )
            .into_response();
    }

    next.run(req).await
}

/// Shared state for DID auth verification.
#[derive(Clone)]
pub struct DidAuthState {
    pub nonce_store: NonceStore,
    pub agent_store: Arc<crate::agents::AgentStore>,
}

async fn verify_did_signature(did: &str, nonce: &str, sig_b64: &str, state: &DidAuthState) -> bool {
    // 1. Consume the nonce (one-time use, not expired)
    if !state.nonce_store.consume(did, nonce).await {
        return false;
    }

    // 2. Look up the agent by DID
    let agent = match state.agent_store.get_agent(did) {
        Some(a) => a,
        None => return false,
    };

    // 3. Parse the authority public key
    let pubkey = match Pubkey::from_str(&agent.authority) {
        Ok(pk) => pk,
        Err(_) => return false,
    };

    // 4. Decode the signature
    let sig_bytes = match base64::engine::general_purpose::STANDARD.decode(sig_b64) {
        Ok(b) => b,
        Err(_) => return false,
    };
    let signature = match Signature::try_from(sig_bytes.as_slice()) {
        Ok(s) => s,
        Err(_) => return false,
    };

    // 5. Verify the signature against the nonce
    signature.verify(pubkey.as_ref(), nonce.as_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn nonce_lifecycle() {
        let store = NonceStore::new();
        let nonce = store.generate("did:bastion:solana:test").await;
        assert!(store.consume("did:bastion:solana:test", &nonce).await);
        // Second use should fail (one-time)
        assert!(!store.consume("did:bastion:solana:test", &nonce).await);
    }

    #[tokio::test]
    async fn nonce_expiry() {
        let store = NonceStore::new();
        let did = "did:bastion:solana:test";
        {
            let mut nonces = store.nonces.write().await;
            nonces.insert(
                did.to_string(),
                NonceEntry {
                    nonce: "expired-nonce".to_string(),
                    expires_at: Instant::now() - Duration::from_secs(1),
                },
            );
        }
        assert!(!store.consume(did, "expired-nonce").await);
    }
}
