use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    middleware,
    response::{
        IntoResponse,
        sse::{Event, KeepAlive, Sse},
    },
    routing::{get, post},
};
use base64::Engine as _;
use futures::stream::Stream;
use std::collections::HashMap;
use std::convert::Infallible;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{RwLock, broadcast};
use tokio_stream::StreamExt;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;
use uuid::Uuid;

pub mod agents;
pub mod audit;
mod auth;
pub mod cases;
pub mod core_adapter;
pub mod did;
pub mod grond_oracle;
pub mod ingestion;
pub mod logger;
pub mod policy;
pub mod program_client;
pub mod prompt_safety;
pub mod simulation;
pub mod simulation_evm;

use audit::{
    AuditEntry, AuditLogger, AuditResult, Decision, TransactionDetails, current_timestamp,
    hash_transaction_payload,
};
use grond_oracle::GrondOracle;
use policy::{
    FlashLoanPatternCheck, HighSlippageCheck, IntentClassification, MaxUnitsCheck, NoErrorCheck,
    Policy, PolicyEngine, SimulationCheck, classify_intent,
};
use program_client::OnChainClient;
use simulation::{Simulate, SimulationResult};
use simulation_evm::{CeloSimulator, EvmSimulate, EvmSimulateRequest, EvmSimulateResponse};

#[derive(Clone, serde::Serialize)]
struct PendingApproval {
    #[serde(serialize_with = "serialize_tx")]
    transaction: solana_sdk::transaction::Transaction,
    simulation_result: SimulationResult,
    intent: Option<String>,
}

fn serialize_tx<S>(
    tx: &solana_sdk::transaction::Transaction,
    serializer: S,
) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    let bytes = bincode::serialize(tx).map_err(serde::ser::Error::custom)?;
    serializer.serialize_str(&base64::engine::general_purpose::STANDARD.encode(bytes))
}

#[derive(Clone)]
struct AppState {
    policy_engine: Arc<RwLock<PolicyEngine>>,
    simulator: Arc<dyn Simulate + Send + Sync>,
    logger: Arc<AuditLogger>,
    on_chain: Arc<OnChainClient>,
    pending_approvals: Arc<RwLock<HashMap<String, PendingApproval>>>,
    grond_oracle: GrondOracle,
    celo_simulator: Option<Arc<CeloSimulator>>,
    alchemy_sim: Option<Arc<crate::simulation::AlchemySimulator>>,
    event_tx: broadcast::Sender<String>,
    started_at: std::time::Instant,
    case_store: Arc<RwLock<cases::CaseStore>>,
    correlation_engine: Option<Arc<RwLock<bastion_correlation::engine::CorrelationEngine>>>,
    did_cache: Arc<RwLock<HashMap<String, did::DidResolveResult>>>,
    agent_store: Arc<agents::AgentStore>,
}

fn emit_event(tx: &broadcast::Sender<String>, event_type: &str, json_payload: &str) {
    let msg = format!("event: {event_type}\ndata: {json_payload}\n\n");
    let _ = tx.send(msg);
}

#[derive(serde::Deserialize)]
struct SimulateRequest {
    transaction: String,
    intent: Option<String>,
}

#[derive(serde::Deserialize)]
struct UpdatePolicyRequest {
    allowed_programs: Vec<String>,
}

#[derive(serde::Deserialize)]
struct FullPolicyUpdateRequest {
    #[serde(default)]
    max_sol_per_tx: Option<u64>,
    #[serde(default)]
    max_balance_drain_lamports: Option<u64>,
    #[serde(default)]
    rate_limit_per_minute: Option<u32>,
    #[serde(default)]
    allowed_programs: Option<Vec<String>>,
    #[serde(default)]
    blocked_addresses: Option<Vec<String>>,
    #[serde(default)]
    simulation_checks_enabled: Option<bool>,
    #[serde(default)]
    blockint_flash_loan_check: Option<bool>,
    #[serde(default)]
    blockint_high_slippage_check: Option<bool>,
    #[serde(default)]
    blockint_mint_authority_blocked: Option<bool>,
    #[serde(default)]
    blockint_freeze_authority_blocked: Option<bool>,
    #[serde(default)]
    blockint_max_slippage_bps: Option<u64>,
    #[serde(default)]
    blockint_risk_labeled_addresses: Option<Vec<String>>,
}

#[derive(serde::Serialize)]
struct PolicyResponse {
    allowed_programs: Vec<String>,
}

#[derive(serde::Serialize)]
struct FullPolicyResponse {
    max_sol_per_tx: Option<u64>,
    max_balance_drain_lamports: Option<u64>,
    rate_limit_per_minute: Option<u32>,
    allowed_programs: Vec<String>,
    blocked_addresses: Vec<String>,
    simulation_checks_enabled: bool,
    blockint_flash_loan_check: bool,
    blockint_high_slippage_check: bool,
    blockint_mint_authority_blocked: bool,
    blockint_freeze_authority_blocked: bool,
    blockint_max_slippage_bps: u64,
    blockint_risk_labeled_addresses: Vec<String>,
}

#[derive(serde::Serialize)]
struct PaginatedLogsResponse {
    total: usize,
    offset: usize,
    limit: usize,
    entries: Vec<AuditEntry>,
}

#[derive(serde::Serialize)]
struct HealthResponse {
    status: &'static str,
    uptime_seconds: u64,
    db_healthy: bool,
    db_size_bytes: u64,
}

#[derive(serde::Serialize)]
struct ClearResponse {
    cleared: u64,
}

#[derive(serde::Serialize)]
struct DeleteResponse {
    deleted: bool,
}

#[derive(serde::Deserialize)]
struct LogsQuery {
    limit: Option<usize>,
    offset: Option<usize>,
    transaction_id: Option<String>,
    signature: Option<String>,
    result: Option<AuditResult>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
enum OverrideAction {
    Allow,
    Reject,
}

#[derive(serde::Deserialize)]
struct OverrideRequest {
    block_id: String,
    action: OverrideAction,
}

#[derive(serde::Serialize)]
struct ErrorResponse {
    error: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    block_id: Option<String>,
}

async fn hello() -> &'static str {
    "Hello, world!"
}

async fn update_policy(
    State(state): State<AppState>,
    Json(request): Json<UpdatePolicyRequest>,
) -> Json<PolicyResponse> {
    let mut policy_engine = state.policy_engine.write().await;
    policy_engine.update_allowed_programs(request.allowed_programs);
    Json(PolicyResponse {
        allowed_programs: policy_engine.allowed_programs(),
    })
}

async fn get_policy(State(state): State<AppState>) -> Json<FullPolicyResponse> {
    let policy_engine = state.policy_engine.read().await;
    let snapshot = policy_engine.policy_snapshot();
    let blockint = policy_engine.blockint_rules();
    Json(FullPolicyResponse {
        max_sol_per_tx: snapshot.max_sol_per_tx,
        max_balance_drain_lamports: snapshot.max_balance_drain_lamports,
        rate_limit_per_minute: snapshot.rate_limit_per_minute,
        allowed_programs: snapshot.allowed_programs,
        blocked_addresses: snapshot.blocked_addresses,
        simulation_checks_enabled: snapshot.simulation_checks_enabled,
        blockint_flash_loan_check: blockint.flash_loan_ratio_threshold.is_some(),
        blockint_high_slippage_check: blockint.max_slippage_bps.is_some(),
        blockint_mint_authority_blocked: blockint.mint_authority_changes_blocked,
        blockint_freeze_authority_blocked: blockint.freeze_authority_changes_blocked,
        blockint_max_slippage_bps: blockint.max_slippage_bps.unwrap_or(500),
        blockint_risk_labeled_addresses: blockint.risk_labeled_addresses.clone(),
    })
}

fn build_audit_entry(
    transaction_signature: Option<String>,
    decision: Decision,
    result: AuditResult,
    reasoning: String,
    simulation_result: Option<SimulationResult>,
    intent: Option<String>,
    transaction_details: Option<TransactionDetails>,
) -> AuditEntry {
    let simulation_logs = simulation_result
        .as_ref()
        .map(|result| result.logs.clone())
        .unwrap_or_default();
    let transaction_id = transaction_signature.clone().or_else(|| {
        transaction_details
            .as_ref()
            .and_then(|details| details.request_payload_base64.as_ref())
            .map(|payload| hash_transaction_payload(payload))
    });

    AuditEntry {
        timestamp: current_timestamp(),
        transaction_id,
        transaction_signature,
        decision,
        simulation_result,
        intent,
        result,
        reasoning,
        simulation_logs,
        transaction_details,
    }
}

async fn health(State(state): State<AppState>) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        uptime_seconds: state.started_at.elapsed().as_secs(),
        db_healthy: state.logger.is_healthy(),
        db_size_bytes: state.logger.size_on_disk(),
    })
}

async fn update_full_policy(
    State(state): State<AppState>,
    Json(request): Json<FullPolicyUpdateRequest>,
) -> Json<FullPolicyResponse> {
    let mut policy_engine = state.policy_engine.write().await;
    policy_engine.update_policy(
        request.max_sol_per_tx,
        request.max_balance_drain_lamports,
        request.rate_limit_per_minute,
        request.allowed_programs,
        request.blocked_addresses,
        request.simulation_checks_enabled,
    );
    let mut blockint = policy_engine.blockint_rules().clone();
    if let Some(v) = request.blockint_flash_loan_check {
        blockint.flash_loan_ratio_threshold = if v { Some(100.0) } else { None };
    }
    if let Some(v) = request.blockint_high_slippage_check {
        if v {
            blockint.max_slippage_bps = Some(blockint.max_slippage_bps.unwrap_or(500));
        } else {
            blockint.max_slippage_bps = None;
        }
    }
    if let Some(v) = request.blockint_mint_authority_blocked {
        blockint.mint_authority_changes_blocked = v;
    }
    if let Some(v) = request.blockint_freeze_authority_blocked {
        blockint.freeze_authority_changes_blocked = v;
    }
    if let Some(v) = request.blockint_max_slippage_bps {
        blockint.max_slippage_bps = Some(v);
    }
    if let Some(v) = request.blockint_risk_labeled_addresses {
        blockint.risk_labeled_addresses = v;
    }
    policy_engine.update_blockint_rules(blockint);
    let snapshot = policy_engine.policy_snapshot();
    let blockint = policy_engine.blockint_rules();
    Json(FullPolicyResponse {
        max_sol_per_tx: snapshot.max_sol_per_tx,
        max_balance_drain_lamports: snapshot.max_balance_drain_lamports,
        rate_limit_per_minute: snapshot.rate_limit_per_minute,
        allowed_programs: snapshot.allowed_programs,
        blocked_addresses: snapshot.blocked_addresses,
        simulation_checks_enabled: snapshot.simulation_checks_enabled,
        blockint_flash_loan_check: blockint.flash_loan_ratio_threshold.is_some(),
        blockint_high_slippage_check: blockint.max_slippage_bps.is_some(),
        blockint_mint_authority_blocked: blockint.mint_authority_changes_blocked,
        blockint_freeze_authority_blocked: blockint.freeze_authority_changes_blocked,
        blockint_max_slippage_bps: blockint.max_slippage_bps.unwrap_or(500),
        blockint_risk_labeled_addresses: blockint.risk_labeled_addresses.clone(),
    })
}

async fn export_policy_toml(State(state): State<AppState>) -> impl IntoResponse {
    let policy_engine = state.policy_engine.read().await;
    let snapshot = policy_engine.policy_snapshot();
    match toml::to_string_pretty(&snapshot) {
        Ok(toml_str) => (
            StatusCode::OK,
            [("content-type", "application/toml")],
            toml_str,
        )
            .into_response(),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Failed to serialize policy: {err}"),
                block_id: None,
            }),
        )
            .into_response(),
    }
}

async fn get_audit_stats(State(state): State<AppState>) -> impl IntoResponse {
    match state.logger.count(None) {
        Ok(stats) => Json(stats).into_response(),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Failed to compute audit stats: {err}"),
                block_id: None,
            }),
        )
            .into_response(),
    }
}

async fn clear_audit_logs(State(state): State<AppState>) -> impl IntoResponse {
    match state.logger.clear() {
        Ok(cleared) => Json(ClearResponse { cleared }).into_response(),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Failed to clear audit logs: {err}"),
                block_id: None,
            }),
        )
            .into_response(),
    }
}

async fn delete_audit_log(State(state): State<AppState>, Path(id): Path<u64>) -> impl IntoResponse {
    match state.logger.delete_by_id(id) {
        Ok(true) => Json(DeleteResponse { deleted: true }).into_response(),
        Ok(false) => (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("Audit log entry {id} not found"),
                block_id: None,
            }),
        )
            .into_response(),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Failed to delete audit log: {err}"),
                block_id: None,
            }),
        )
            .into_response(),
    }
}

async fn simulate(
    State(state): State<AppState>,
    Json(request): Json<SimulateRequest>,
) -> impl IntoResponse {
    let intent = request.intent.clone();
    let request_payload = request.transaction.clone();
    let request_details = TransactionDetails::from_request_payload(request_payload.clone());

    let tx_bytes = match base64::engine::general_purpose::STANDARD.decode(&request.transaction) {
        Ok(bytes) => bytes,
        Err(err) => {
            let reason = format!("Invalid base64 transaction: {err}");
            let entry = AuditEntry {
                transaction_signature: None,
                ..build_audit_entry(
                    None,
                    Decision::Blocked(reason.clone()),
                    AuditResult::Blocked,
                    reason.clone(),
                    None,
                    intent.clone(),
                    Some(request_details.clone()),
                )
            };
            let _ = state.logger.log(entry);
            return (
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: reason,
                    block_id: None,
                }),
            )
                .into_response();
        }
    };

    let tx: solana_sdk::transaction::Transaction = match bincode::deserialize(&tx_bytes) {
        Ok(tx) => tx,
        Err(err) => {
            let reason = format!("Invalid transaction payload: {err}");
            let entry = AuditEntry {
                transaction_signature: None,
                ..build_audit_entry(
                    None,
                    Decision::Blocked(reason.clone()),
                    AuditResult::Blocked,
                    reason.clone(),
                    None,
                    intent.clone(),
                    Some(request_details.clone()),
                )
            };
            let _ = state.logger.log(entry);
            return (
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: reason,
                    block_id: None,
                }),
            )
                .into_response();
        }
    };

    let tx_details = TransactionDetails::from_transaction_request(request_payload, &tx);
    let signature = tx_details.signature.clone();

    {
        let engine = state.policy_engine.read().await;
        if let Err(err) = engine.check_circuit_breaker() {
            let entry = AuditEntry {
                ..build_audit_entry(
                    signature.clone(),
                    Decision::Blocked(err.clone()),
                    AuditResult::Blocked,
                    err.clone(),
                    None,
                    intent.clone(),
                    Some(tx_details.clone()),
                )
            };
            let _ = state.logger.log(entry);
            return (
                StatusCode::FORBIDDEN,
                Json(ErrorResponse {
                    error: err,
                    block_id: None,
                }),
            )
                .into_response();
        }
    }

    if let Some(ref intent_str) = intent {
        let classification = classify_intent(&Some(intent_str.clone()));
        if let IntentClassification::Malicious(pattern) = classification {
            let err = format!(
                "Intent classified as malicious: detected '{}' pattern",
                pattern
            );
            let entry = AuditEntry {
                ..build_audit_entry(
                    signature.clone(),
                    Decision::Blocked(err.clone()),
                    AuditResult::Blocked,
                    err.clone(),
                    None,
                    intent.clone(),
                    Some(tx_details.clone()),
                )
            };
            let _ = state.logger.log(entry);
            return (
                StatusCode::FORBIDDEN,
                Json(ErrorResponse {
                    error: err,
                    block_id: None,
                }),
            )
                .into_response();
        }
    }

    let policy_check = {
        let engine = state.policy_engine.read().await;
        engine.check_transaction(&tx)
    };

    if let Err(err) = policy_check {
        let entry = AuditEntry {
            ..build_audit_entry(
                signature.clone(),
                Decision::Blocked(err.clone()),
                AuditResult::Blocked,
                err.clone(),
                None,
                intent.clone(),
                Some(tx_details.clone()),
            )
        };
        let _ = state.logger.log(entry);

        emit_event(
            &state.event_tx,
            "AuditRecorded",
            &serde_json::json!({
                "decision": "Allowed",
                "reason": "All policy and simulation checks passed",
                "timestamp": current_timestamp()
            })
            .to_string(),
        );

        return (
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: err,
                block_id: None,
            }),
        )
            .into_response();
    }

    let simulator = state.simulator.clone();
    let tx_clone = tx.clone();
    let spawn_result =
        tokio::task::spawn_blocking(move || simulator.simulate_transaction(&tx_clone)).await;

    let res = match spawn_result {
        Ok(r) => r,
        Err(err) => {
            let reason = format!("Simulation task failed: {err}");
            let entry = AuditEntry {
                ..build_audit_entry(
                    signature.clone(),
                    Decision::Blocked(reason.clone()),
                    AuditResult::Blocked,
                    reason.clone(),
                    None,
                    intent.clone(),
                    Some(tx_details.clone()),
                )
            };
            let _ = state.logger.log(entry);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: reason,
                    block_id: None,
                }),
            )
                .into_response();
        }
    };

    let result = match res {
        Ok(r) => r,
        Err(err) => {
            let reason = format!("Simulation failed: {err}");
            let entry = AuditEntry {
                ..build_audit_entry(
                    signature.clone(),
                    Decision::Blocked(reason.clone()),
                    AuditResult::Blocked,
                    reason.clone(),
                    None,
                    intent.clone(),
                    Some(tx_details.clone()),
                )
            };
            let _ = state.logger.log(entry);
            return (
                StatusCode::BAD_GATEWAY,
                Json(ErrorResponse {
                    error: reason,
                    block_id: None,
                }),
            )
                .into_response();
        }
    };

    let simulation_checks_enabled = {
        let engine = state.policy_engine.read().await;
        engine.simulation_checks_enabled()
    };

    if simulation_checks_enabled {
        let max_balance_drain = {
            let engine = state.policy_engine.read().await;
            engine.max_balance_drain_lamports()
        };

        let mut checks: Vec<Box<dyn SimulationCheck>> = if let Some(limit) = max_balance_drain {
            vec![
                Box::new(NoErrorCheck),
                Box::new(MaxUnitsCheck),
                Box::new(policy::MaxBalanceDrainCheck { limit }),
            ]
        } else {
            vec![Box::new(NoErrorCheck), Box::new(MaxUnitsCheck)]
        };

        let blockint_rules = state.policy_engine.read().await.blockint_rules().clone();
        if blockint_rules.flash_loan_ratio_threshold.is_some() {
            checks.push(Box::new(FlashLoanPatternCheck));
        }
        if let Some(max_bps) = blockint_rules.max_slippage_bps {
            checks.push(Box::new(HighSlippageCheck {
                max_slippage_bps: max_bps,
            }));
        }

        for check in checks {
            if let Err(err) = check.check(&result) {
                let block_id = Uuid::new_v4().to_string();

                let entry = AuditEntry {
                    ..build_audit_entry(
                        signature.clone(),
                        Decision::PendingApproval(block_id.clone()),
                        AuditResult::Blocked,
                        err.clone(),
                        Some(result.clone()),
                        intent.clone(),
                        Some(tx_details.clone()),
                    )
                };
                let _ = state.logger.log(entry);

                let mut pending_approvals = state.pending_approvals.write().await;
                pending_approvals.insert(
                    block_id.clone(),
                    PendingApproval {
                        transaction: tx,
                        simulation_result: result.clone(),
                        intent,
                    },
                );

                return (
                    StatusCode::FORBIDDEN,
                    Json(ErrorResponse {
                        error: err,
                        block_id: Some(block_id),
                    }),
                )
                    .into_response();
            }
        }
    }

    let entry = AuditEntry {
        ..build_audit_entry(
            signature.clone(),
            Decision::Allowed,
            AuditResult::Allowed,
            "All policy and simulation checks passed".to_string(),
            Some(result.clone()),
            intent.clone(),
            Some(tx_details),
        )
    };
    let _ = state.logger.log(entry);

    if state.on_chain.is_enabled() {
        let on_chain = state.on_chain.clone();
        let decision: u8 = 0;
        let sim_hash: [u8; 32] = result.simulation_hash.unwrap_or([0u8; 32]);
        let reasoning = "All policy and simulation checks passed".to_string();
        tokio::spawn(async move {
            if let Err(e) = on_chain
                .log_audit(decision, sim_hash, &reasoning, None)
                .await
            {
                eprintln!("[bastion] On-chain audit log failed: {e}");
            } else {
                eprintln!("[bastion] On-chain audit logged successfully");
            }
        });
    }

    Json(result).into_response()
}

async fn get_logs(
    State(state): State<AppState>,
    Query(query): Query<LogsQuery>,
) -> impl IntoResponse {
    let LogsQuery {
        limit,
        offset,
        transaction_id,
        signature,
        result,
    } = query;

    let offset = offset.unwrap_or(0);
    let limit = limit.unwrap_or(100);

    let total =
        match state
            .logger
            .count_filtered(transaction_id.as_deref(), signature.as_deref(), result)
        {
            Ok(t) => t,
            Err(err) => {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ErrorResponse {
                        error: format!("Failed to count logs: {err}"),
                        block_id: None,
                    }),
                )
                    .into_response();
            }
        };

    match state.logger.get_logs_filtered(
        transaction_id.as_deref(),
        signature.as_deref(),
        result,
        offset,
        limit,
    ) {
        Ok(entries) => Json(PaginatedLogsResponse {
            total,
            offset,
            limit,
            entries,
        })
        .into_response(),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Failed to retrieve logs: {err}"),
                block_id: None,
            }),
        )
            .into_response(),
    }
}

async fn get_logs_by_transaction_id(
    State(state): State<AppState>,
    Path(transaction_id): Path<String>,
) -> impl IntoResponse {
    match state.logger.get_logs_by_transaction_id(&transaction_id) {
        Ok(logs) => Json(logs).into_response(),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Failed to retrieve logs: {err}"),
                block_id: None,
            }),
        )
            .into_response(),
    }
}

async fn get_logs_by_signature(
    State(state): State<AppState>,
    Path(signature): Path<String>,
) -> impl IntoResponse {
    match state.logger.get_logs_by_signature(&signature) {
        Ok(logs) => Json(logs).into_response(),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Failed to retrieve logs: {err}"),
                block_id: None,
            }),
        )
            .into_response(),
    }
}

async fn get_pending(State(state): State<AppState>) -> impl IntoResponse {
    let pending = state.pending_approvals.read().await;
    Json(pending.clone()).into_response()
}

async fn override_block(
    State(state): State<AppState>,
    Json(request): Json<OverrideRequest>,
) -> impl IntoResponse {
    let mut pending_approvals = state.pending_approvals.write().await;
    let pending = match pending_approvals.remove(&request.block_id) {
        Some(p) => p,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: "Block ID not found".to_string(),
                    block_id: None,
                }),
            )
                .into_response();
        }
    };

    let tx_details = TransactionDetails::from_transaction(&pending.transaction);
    let signature = tx_details.signature.clone();

    match request.action {
        OverrideAction::Allow => {
            let reason = format!(
                "Approved by human override for block_id={}",
                request.block_id
            );
            let entry = AuditEntry {
                ..build_audit_entry(
                    signature,
                    Decision::Allowed,
                    AuditResult::Allowed,
                    reason,
                    Some(pending.simulation_result.clone()),
                    pending.intent,
                    Some(tx_details),
                )
            };
            let _ = state.logger.log(entry);
            Json(pending.simulation_result).into_response()
        }
        OverrideAction::Reject => {
            let reason = "Rejected by human override".to_string();
            let entry = AuditEntry {
                ..build_audit_entry(
                    signature,
                    Decision::Blocked(reason.clone()),
                    AuditResult::Blocked,
                    reason.clone(),
                    Some(pending.simulation_result),
                    pending.intent,
                    Some(tx_details),
                )
            };
            let _ = state.logger.log(entry);
            (
                StatusCode::FORBIDDEN,
                Json(ErrorResponse {
                    error: reason,
                    block_id: None,
                }),
            )
                .into_response()
        }
    }
}

#[derive(serde::Serialize)]
struct CircuitBreakerStatus {
    engaged: bool,
}

async fn get_circuit_breaker_status(State(state): State<AppState>) -> Json<CircuitBreakerStatus> {
    let engaged = state
        .policy_engine
        .read()
        .await
        .is_circuit_breaker_engaged();
    Json(CircuitBreakerStatus { engaged })
}

async fn engage_circuit_breaker(State(state): State<AppState>) -> Json<CircuitBreakerStatus> {
    state.policy_engine.write().await.engage_circuit_breaker();
    if state.on_chain.is_enabled() {
        let on_chain = state.on_chain.clone();
        tokio::spawn(async move {
            if let Err(e) = on_chain.emergency_pause().await {
                eprintln!("[bastion] On-chain pause failed: {e}");
            }
        });
    }
    let _ = state.logger.log(AuditEntry {
        timestamp: current_timestamp(),
        transaction_id: None,
        transaction_signature: None,
        decision: Decision::Blocked("circuit_breaker_engaged".into()),
        simulation_result: None,
        intent: None,
        result: AuditResult::Blocked,
        reasoning: "Circuit breaker engaged — all transactions paused".into(),
        simulation_logs: vec![],
        transaction_details: None,
    });
    Json(CircuitBreakerStatus { engaged: true })
}

async fn disengage_circuit_breaker(State(state): State<AppState>) -> Json<CircuitBreakerStatus> {
    state
        .policy_engine
        .write()
        .await
        .disengage_circuit_breaker();
    if state.on_chain.is_enabled() {
        let on_chain = state.on_chain.clone();
        tokio::spawn(async move {
            if let Err(e) = on_chain.emergency_resume().await {
                eprintln!("[bastion] On-chain resume failed: {e}");
            }
        });
    }
    let _ = state.logger.log(AuditEntry {
        timestamp: current_timestamp(),
        transaction_id: None,
        transaction_signature: None,
        decision: Decision::Allowed,
        simulation_result: None,
        intent: None,
        result: AuditResult::Allowed,
        reasoning: "Circuit breaker disengaged — transactions resumed".into(),
        simulation_logs: vec![],
        transaction_details: None,
    });
    Json(CircuitBreakerStatus { engaged: false })
}

async fn events_handler(
    State(state): State<AppState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let rx = state.event_tx.subscribe();
    let stream = tokio_stream::wrappers::BroadcastStream::new(rx)
        .filter_map(|result| result.ok())
        .map(|msg| {
            let (event_name, data) = parse_sse_message(&msg);
            Ok(Event::default().event(event_name).data(data))
        });

    Sse::new(stream).keep_alive(KeepAlive::new().interval(Duration::from_secs(15)))
}

fn parse_sse_message(msg: &str) -> (&str, &str) {
    if let Some((event, data)) = msg
        .strip_prefix("event: ")
        .and_then(|rest| rest.split_once("\ndata: "))
    {
        return (event, data);
    }
    ("message", msg)
}

async fn evaluate_v2(
    State(state): State<AppState>,
    Json(req): Json<core_adapter::EvaluateRequest>,
) -> Json<core_adapter::EvaluateResponse> {
    let grond = if state.grond_oracle.is_enabled() {
        Some(state.grond_oracle.clone())
    } else {
        None
    };
    Json(core_adapter::evaluate_core(req, grond).await)
}

async fn simulate_evm_handler(
    State(state): State<AppState>,
    Json(req): Json<EvmSimulateRequest>,
) -> impl IntoResponse {
    let sim = match &state.celo_simulator {
        Some(s) => s.clone(),
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({
                    "error": "EVM simulation not configured. Set CELO_RPC_URL to enable."
                })),
            )
                .into_response();
        }
    };

    let chain = req.chain.as_deref().unwrap_or("celo");
    let agent_id = req.agent_id.clone();
    let intent = req.intent.clone();

    let simulation_result = match sim.simulate_evm_tx(&req.transaction) {
        Ok(r) => r,
        Err(err) => {
            let entry = AuditEntry {
                ..build_audit_entry(
                    None,
                    Decision::Blocked(format!("EVM simulation failed: {err}")),
                    AuditResult::Blocked,
                    format!("EVM simulation failed: {err}"),
                    None,
                    intent.clone(),
                    None,
                )
            };
            let _ = state.logger.log(entry);
            return (
                StatusCode::BAD_GATEWAY,
                Json(EvmSimulateResponse {
                    allowed: false,
                    decision: "blocked".to_string(),
                    reason: Some(format!("Simulation failed: {err}")),
                    simulation_result: None,
                    risk_score: None,
                    risk_summary: None,
                }),
            )
                .into_response();
        }
    };

    let has_error = simulation_result.error.is_some();
    let decision = if has_error { "blocked" } else { "passed" };

    let transaction_id = agent_id.as_deref().map(|id| {
        hash_transaction_payload(&format!(
            "{}:{}:{}:{}",
            id,
            req.transaction.from,
            req.transaction.to,
            simulation_result
                .simulation_hash
                .unwrap_or([0u8; 32])
                .iter()
                .map(|b| format!("{:02x}", b))
                .collect::<String>()
        ))
    });

    let entry = AuditEntry {
        ..build_audit_entry(
            transaction_id.clone(),
            if has_error {
                Decision::Blocked("Simulation returned error".to_string())
            } else {
                Decision::Allowed
            },
            if has_error {
                AuditResult::Blocked
            } else {
                AuditResult::Allowed
            },
            format!("EVM simulation on chain={chain}, agent={agent_id:?}, intent={intent:?}"),
            Some(simulation_result.clone()),
            intent.clone(),
            None,
        )
    };
    let _ = state.logger.log(entry);

    Json(EvmSimulateResponse {
        allowed: !has_error,
        decision: decision.to_string(),
        reason: if has_error {
            simulation_result.error.as_ref().map(|e| format!("{:?}", e))
        } else {
            Some("EVM simulation passed all checks".to_string())
        },
        simulation_result: Some(simulation_result),
        risk_score: None,
        risk_summary: None,
    })
    .into_response()
}

// ── Case Management Handlers ──

#[derive(serde::Serialize)]
struct CaseListResponse {
    cases: Vec<cases::Case>,
    total: usize,
}

#[derive(serde::Deserialize)]
struct CreateCaseRequest {
    title: String,
    description: Option<String>,
    event_ids: Option<Vec<String>>,
}

#[derive(serde::Deserialize)]
struct PatchCaseRequest {
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    assigned_to: Option<String>,
}

#[derive(serde::Deserialize)]
struct AddEvidenceRequest {
    tx_hash: String,
}

async fn get_cases(State(state): State<AppState>) -> Json<CaseListResponse> {
    let store = state.case_store.read().await;
    let cases = store.list().to_vec();
    let total = cases.len();
    Json(CaseListResponse { cases, total })
}

async fn post_case(
    State(state): State<AppState>,
    Json(req): Json<CreateCaseRequest>,
) -> Json<cases::Case> {
    let sanitized_title = prompt_safety::sanitize_input(&req.title);
    let sanitized_desc = req
        .description
        .as_deref()
        .map(prompt_safety::sanitize_input)
        .unwrap_or_default();

    let mut store = state.case_store.write().await;
    let case = store.create(
        sanitized_title,
        sanitized_desc,
        req.event_ids.unwrap_or_default(),
    );
    Json(case.clone())
}

async fn patch_case(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<PatchCaseRequest>,
) -> Result<Json<cases::Case>, axum::http::StatusCode> {
    let mut store = state.case_store.write().await;

    let case = store
        .get_mut(&id)
        .ok_or(axum::http::StatusCode::NOT_FOUND)?;

    if let Some(status) = &req.status {
        match status.as_str() {
            "in_progress" => case.resolve(),
            "resolved" => {
                if let Some(analyst) = &req.assigned_to {
                    let sanitized = prompt_safety::sanitize_input(analyst);
                    case.assign(sanitized);
                }
                case.resolve();
            }
            "closed" => case.close(),
            _ => return Err(axum::http::StatusCode::BAD_REQUEST),
        }
    }

    if let Some(analyst) = &req.assigned_to {
        let sanitized = prompt_safety::sanitize_input(analyst);
        case.assign(sanitized);
    }

    Ok(Json(case.clone()))
}

async fn post_case_evidence(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<AddEvidenceRequest>,
) -> Result<Json<cases::Case>, axum::http::StatusCode> {
    let mut store = state.case_store.write().await;
    let case = store
        .get_mut(&id)
        .ok_or(axum::http::StatusCode::NOT_FOUND)?;
    case.add_evidence(req.tx_hash);
    Ok(Json(case.clone()))
}

// ── DID Resolution Handler ──

#[derive(serde::Deserialize)]
struct DidPath {
    did: String,
}

async fn resolve_did_handler(
    State(state): State<AppState>,
    Path(params): Path<DidPath>,
) -> Result<Json<did::DidResolveResult>, axum::http::StatusCode> {
    let full_did = format!("did:bastion:{}", params.did);

    // Check cache first
    {
        let cache = state.did_cache.read().await;
        if let Some(result) = cache.get(&full_did) {
            return Ok(Json(result.clone()));
        }
    }

    // Try AgentStore first (registered agents with verified on-chain data)
    if let Some(result) = state.agent_store.build_did_document(&full_did) {
        let mut cache = state.did_cache.write().await;
        cache.insert(full_did, result.clone());
        return Ok(Json(result));
    }

    // Fall back to generic resolver
    let result = did::resolve_did(&full_did)
        .await
        .ok_or(axum::http::StatusCode::NOT_FOUND)?;

    let mut cache = state.did_cache.write().await;
    cache.insert(full_did, result.clone());

    Ok(Json(result))
}

// ── Agent Registry Handlers ──

#[derive(serde::Serialize)]
struct AgentListResponse {
    agents: Vec<agents::TrackedAgent>,
    total: usize,
}

#[derive(serde::Deserialize)]
struct AgentAuditQuery {
    limit: Option<usize>,
    offset: Option<usize>,
}

async fn get_agents(
    State(state): State<AppState>,
) -> Json<AgentListResponse> {
    let agents = state.agent_store.list_agents().unwrap_or_default();
    let total = agents.len();
    Json(AgentListResponse { agents, total })
}

async fn get_agent(
    State(state): State<AppState>,
    Path(did): Path<String>,
) -> Result<Json<agents::TrackedAgent>, axum::http::StatusCode> {
    state
        .agent_store
        .get_agent(&did)
        .map(Json)
        .ok_or(axum::http::StatusCode::NOT_FOUND)
}

async fn register_agent_handler(
    State(state): State<AppState>,
    Json(req): Json<agents::RegisterAgentRequest>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    // Derive the Agent PDA from the DID
    let parts: Vec<&str> = req.did.split(':').collect();
    if parts.len() < 4 || parts[0] != "did" || parts[1] != "bastion" {
        return Err((
            axum::http::StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "Invalid DID format. Expected did:bastion:solana:{pda_base58}"})),
        ));
    }

    let agent_pda = parts[3]; // The last part is the base58-encoded PDA
    let chain = parts[2];

    // For Solana: fetch the Agent PDA to verify it exists
    // (In production this would do an on-chain RPC call; for MVP we trust the registration)
    let name = format!("Agent-{}", &agent_pda[..8]);
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    match state.agent_store.register_agent(
        &req.did,
        &req.authority_pubkey,
        agent_pda,
        &name,
        0,      // default capability (TRANSFER)
        100,    // default reputation
        now,
        req.sidecar_endpoint,
    ) {
        Ok(did) => {
            crate::emit_event(
                &state.event_tx,
                "AgentRegistered",
                &serde_json::json!({
                    "did": did,
                    "authority": req.authority_pubkey,
                    "chain": chain,
                    "timestamp": now,
                })
                .to_string(),
            );
            Ok(Json(serde_json::json!({
                "status": "registered",
                "did": did,
                "agent_pda": agent_pda,
            })))
        }
        Err(e) => Err((
            axum::http::StatusCode::CONFLICT,
            Json(serde_json::json!({"error": e})),
        )),
    }
}

async fn get_agent_audit(
    State(state): State<AppState>,
    Path(did): Path<String>,
    Query(query): Query<AgentAuditQuery>,
) -> Result<Json<serde_json::Value>, axum::http::StatusCode> {
    let agent = state
        .agent_store
        .get_agent(&did)
        .ok_or(axum::http::StatusCode::NOT_FOUND)?;

    let limit = query.limit.unwrap_or(50);
    let offset = query.offset.unwrap_or(0);

    // Fetch audit entries filtered by the agent's authority
    let entries = state
        .logger
        .get_logs_filtered(
            Some(&agent.authority),
            None,
            None,
            offset,
            limit,
        )
        .unwrap_or_default();

    let total = state
        .logger
        .count_filtered(Some(&agent.authority), None, None)
        .unwrap_or(0);

    Ok(Json(serde_json::json!({
        "did": did,
        "total": total,
        "offset": offset,
        "limit": limit,
        "entries": entries,
    })))
}

// ── Alchemy Token Balances Handler ──

#[derive(serde::Deserialize)]
struct TokenBalancesQuery {
    address: String,
}

async fn get_token_balances(
    State(state): State<AppState>,
    Query(q): Query<TokenBalancesQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let sim = state
        .alchemy_sim
        .as_ref()
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)?;
    sim.fetch_token_balances(&q.address)
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

// ── SSE Event Stream Handler ──

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct SseAgentEvent {
    agent_id: String,
    timestamp: u64,
    decision: String,
    intent: String,
    tx_signature: String,
    simulation_hash: Option<String>,
}

#[allow(dead_code)]
async fn sse_events_handler(
    State(state): State<AppState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let mut rx = state.event_tx.subscribe();

    let stream = async_stream::stream! {
        yield Ok(Event::default().data(r#"{"type":"ping"}"#));

        loop {
            match rx.recv().await {
                Ok(msg) => {
                    if let Ok(event) = serde_json::from_str::<SseAgentEvent>(&msg) {
                        yield Ok(Event::default().json_data(event).unwrap_or_default());
                    }
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(_n)) => {
                    continue;
                }
                Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                    break;
                }
            }
        }
    };

    Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("ping"),
    )
}

pub fn build_app(
    policy: Policy,
    simulator: Arc<dyn Simulate + Send + Sync>,
    logger: Arc<AuditLogger>,
    on_chain: OnChainClient,
    grond_oracle: GrondOracle,
    celo_simulator: Option<Arc<CeloSimulator>>,
    alchemy_sim: Option<Arc<crate::simulation::AlchemySimulator>>,
) -> Router {
    let (event_tx, _) = broadcast::channel(256);

    // Periodic audit log flush (every 10 seconds)
    let flush_logger = logger.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(10)).await;
            if let Err(e) = flush_logger.flush() {
                eprintln!("[bastion] audit log flush failed: {e}");
            }
        }
    });

    let app_state = AppState {
        policy_engine: Arc::new(RwLock::new(PolicyEngine::new(policy))),
        simulator,
        logger,
        on_chain: Arc::new(on_chain),
        pending_approvals: Arc::new(RwLock::new(HashMap::new())),
        grond_oracle,
        celo_simulator,
        alchemy_sim,
        event_tx,
        started_at: std::time::Instant::now(),
        case_store: Arc::new(RwLock::new(cases::CaseStore::new())),
        correlation_engine: None,
        did_cache: Arc::new(RwLock::new(HashMap::new())),
        agent_store: Arc::new(agents::AgentStore::new()),
    };

    Router::new()
        // === Protected routes (auth required) ===
        .route("/audit/stats", get(get_audit_stats))
        .route("/audit/logs/clear", post(clear_audit_logs))
        .route("/audit/logs/:id", axum::routing::delete(delete_audit_log))
        .route("/override", post(override_block))
        .route(
            "/policy",
            get(get_policy).post(update_policy).put(update_policy),
        )
        .route(
            "/policy/allowed-programs",
            post(update_policy).put(update_policy),
        )
        .route(
            "/policy/full",
            post(update_full_policy).put(update_full_policy),
        )
        .route("/policy/export", get(export_policy_toml))
        .route("/circuit-breaker/status", get(get_circuit_breaker_status))
        .route("/circuit-breaker/engage", post(engage_circuit_breaker))
        .route(
            "/circuit-breaker/disengage",
            post(disengage_circuit_breaker),
        )
        .route("/ingest", post(ingestion::ingest_event))
        .route("/cases", get(get_cases).post(post_case))
        .route("/cases/:id", axum::routing::patch(patch_case))
        .route("/cases/:id/evidence", post(post_case_evidence))
        .route("/agents", post(register_agent_handler))
        .route_layer(middleware::from_fn(auth::require_api_key))
        // === Unprotected routes ===
        .route("/", get(hello))
        .route("/health", get(health))
        .route("/events", get(events_handler))
        .route("/api/v2/evaluate", post(evaluate_v2))
        .route("/api/v2/simulate-evm", post(simulate_evm_handler))
        .route("/simulate", post(simulate))
        .route("/agents", get(get_agents))
        .route("/agents/:did", get(get_agent))
        .route("/agents/:did/audit", get(get_agent_audit))
        .route("/logs", get(get_logs))
        .route("/logs/tx/:transaction_id", get(get_logs_by_transaction_id))
        .route("/logs/signature/:signature", get(get_logs_by_signature))
        .route("/audit/logs", get(get_logs))
        .route(
            "/audit/logs/tx/:transaction_id",
            get(get_logs_by_transaction_id),
        )
        .route(
            "/audit/logs/signature/:signature",
            get(get_logs_by_signature),
        )
        .route("/pending", get(get_pending))
        .route("/did/resolve/:did", get(resolve_did_handler))
        .route("/token-balances", get(get_token_balances))
        .nest_service("/dashboard", ServeDir::new("static"))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(vec![
                    "content-type".parse().unwrap(),
                    "authorization".parse().unwrap(),
                    "x-api-key".parse().unwrap(),
                    "x-payment".parse().unwrap(),
                    "x-payment-chain".parse().unwrap(),
                ]),
        )
        .with_state(app_state)
}
