use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::Arc};
use tower_http::cors::CorsLayer;
use tracing::info;
use tracing_subscriber::EnvFilter;

mod policy;
mod audit;
mod prover;

use policy::{PolicyEngine, PolicyConfig};
use audit::AuditLogger;
use prover::ProofResult;

// ─────────────────────────────────────────────────────────────────────────────
// App State
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct AppState {
    pub policy: Arc<PolicyEngine>,
    pub audit: Arc<AuditLogger>,
    pub network: String,
    pub middleware_url: String,
}

// ─────────────────────────────────────────────────────────────────────────────
// Request / Response Types
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct RegisterAgentRequest {
    pub agent_id: String,
    pub commitment: String,
    pub name: String,
    pub metadata_uri: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RegisterAgentResponse {
    pub agent_id: String,
    pub commitment: String,
    pub tx_hash: String,
}

#[derive(Debug, Deserialize)]
pub struct SetPolicyRequest {
    pub agent_id: String,
    pub policy_commitment: String,
    pub policy: PolicyConfig,
}

#[derive(Debug, Serialize)]
pub struct SetPolicyResponse {
    pub agent_id: String,
    pub policy_commitment: String,
    pub version: u32,
    pub tx_hash: String,
}

#[derive(Debug, Deserialize)]
pub struct ValidateRequest {
    pub agent_id: String,
    pub target: String,
    pub value: String,
    pub selector: String,
    pub call_data: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ValidateResponse {
    pub allowed: bool,
    pub reason: Option<String>,
    pub proof_hash: Option<String>,
    pub audit_entry_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AuditQuery {
    pub from: Option<u64>,
    pub to: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub network: String,
    pub version: String,
}

// ─────────────────────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────────────────────

async fn health(State(state): State<AppState>) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
        network: state.network.clone(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

async fn register_agent(
    State(state): State<AppState>,
    Json(req): Json<RegisterAgentRequest>,
) -> Result<Json<RegisterAgentResponse>, (StatusCode, Json<serde_json::Value>)> {
    info!(agent_id = %req.agent_id, "Registering agent");

    // In production, this submits the registerAgent circuit call to Midnight
    // For now, we store locally and return a mock tx hash
    let tx_hash = prover::mock_tx_hash(&req.agent_id);

    Ok(Json(RegisterAgentResponse {
        agent_id: req.agent_id,
        commitment: req.commitment,
        tx_hash,
    }))
}

async fn set_policy(
    State(state): State<AppState>,
    Json(req): Json<SetPolicyRequest>,
) -> Result<Json<SetPolicyResponse>, (StatusCode, Json<serde_json::Value>)> {
    info!(agent_id = %req.agent_id, "Setting policy");

    let version = state.policy.set_policy(req.agent_id.clone(), req.policy.clone());
    let tx_hash = prover::mock_tx_hash(&format!("policy:{}", req.agent_id));

    Ok(Json(SetPolicyResponse {
        agent_id: req.agent_id,
        policy_commitment: req.policy_commitment,
        version,
        tx_hash,
    }))
}

async fn remove_policy(
    State(state): State<AppState>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let agent_id = body["agent_id"].as_str().unwrap_or("").to_string();
    state.policy.remove_policy(&agent_id);
    Ok(Json(serde_json::json!({ "tx_hash": prover::mock_tx_hash(&agent_id) })))
}

async fn validate_transaction(
    State(state): State<AppState>,
    Json(req): Json<ValidateRequest>,
) -> Result<Json<ValidateResponse>, (StatusCode, Json<serde_json::Value>)> {
    let value: u64 = req.value.parse().unwrap_or(0);

    let check = state.policy.check_transaction(
        &req.agent_id,
        &req.target,
        value,
        &req.selector,
    );

    let (allowed, reason) = match check {
        Ok(()) => (true, None),
        Err(e) => (false, Some(e.to_string())),
    };

    // Generate ZK proof of compliance (or block proof)
    let proof_result = if allowed {
        Some(prover::generate_compliance_proof(
            &req.agent_id,
            &req.target,
            value,
            &req.selector,
        ))
    } else {
        None
    };

    // Log audit entry
    let entry_id = state.audit.log_entry(
        &req.agent_id,
        &req.target,
        value,
        &req.selector,
        allowed,
        proof_result.as_ref().map(|p| p.proof_hash.as_str()).unwrap_or(""),
    );

    Ok(Json(ValidateResponse {
        allowed,
        reason,
        proof_hash: proof_result.map(|p| p.proof_hash),
        audit_entry_id: Some(entry_id),
    }))
}

async fn get_audit_log(
    State(state): State<AppState>,
    Path(agent_id): Path<String>,
    Query(params): Query<AuditQuery>,
) -> Json<serde_json::Value> {
    let entries = state.audit.get_entries(&agent_id, params.from, params.to);
    Json(serde_json::json!(entries))
}

async fn get_agent_status(
    State(state): State<AppState>,
    Path(agent_id): Path<String>,
) -> Json<serde_json::Value> {
    let entry_count = state.audit.get_agent_entry_count(&agent_id);
    let has_policy = state.policy.has_policy(&agent_id);
    Json(serde_json::json!({
        "agent_id": agent_id,
        "is_active": has_policy,
        "entry_count": entry_count,
    }))
}

async fn pause(State(_state): State<AppState>) -> Json<serde_json::Value> {
    // In production: submit pause circuit to Midnight
    Json(serde_json::json!({ "tx_hash": prover::mock_tx_hash("pause") }))
}

async fn resume(State(_state): State<AppState>) -> Json<serde_json::Value> {
    // In production: submit resume circuit to Midnight
    Json(serde_json::json!({ "tx_hash": prover::mock_tx_hash("resume") }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenv::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("midnight_bastion=info".parse()?))
        .init();

    let network = std::env::var("MIDNIGHT_NETWORK").unwrap_or_else(|_| "testnet".to_string());
    let port = std::env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    let db_path = std::env::var("DB_PATH").unwrap_or_else(|_| "bastion.db".to_string());

    let policy = Arc::new(PolicyEngine::new(&db_path)?);
    let audit = Arc::new(AuditLogger::new(&db_path)?);

    let state = AppState {
        policy,
        audit,
        network: network.clone(),
        middleware_url: format!("http://0.0.0.0:{port}"),
    };

    let app = Router::new()
        .route("/health", get(health))
        .route("/register", post(register_agent))
        .route("/policy", post(set_policy))
        .route("/policy/remove", post(remove_policy))
        .route("/validate", post(validate_transaction))
        .route("/audit/:agent_id", get(get_audit_log))
        .route("/agent/:agent_id/status", get(get_agent_status))
        .route("/pause", post(pause))
        .route("/resume", post(resume))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = format!("0.0.0.0:{port}");
    info!(addr = %addr, network = %network, "Midnight Bastion middleware starting");

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
