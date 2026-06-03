use anyhow::{Result, anyhow};
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;

use crate::simulation::{ReturnData, SimulationResult, compute_simulation_hash};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvmTxParams {
    pub from: String,
    pub to: String,
    #[serde(default)]
    pub value: Option<String>,
    #[serde(default)]
    pub data: Option<String>,
    #[serde(default)]
    pub gas: Option<String>,
    #[serde(default)]
    pub gas_price: Option<String>,
    #[serde(default, rename = "maxFeePerGas")]
    pub max_fee_per_gas: Option<String>,
    #[serde(default, rename = "maxPriorityFeePerGas")]
    pub max_priority_fee_per_gas: Option<String>,
    #[serde(default)]
    pub nonce: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvmSimulateRequest {
    pub transaction: EvmTxParams,
    pub intent: Option<String>,
    pub chain: Option<String>,
    pub agent_id: Option<String>,
}

pub trait EvmSimulate: Send + Sync {
    fn simulate_evm_tx(&self, tx: &EvmTxParams) -> Result<SimulationResult>;
}

pub struct CeloSimulator {
    client: Client,
    rpc_url: String,
}

impl CeloSimulator {
    pub fn new() -> Result<Self> {
        let rpc_url =
            env::var("CELO_RPC_URL").unwrap_or_else(|_| "https://forno.celo.org".to_string());
        Ok(Self {
            client: Client::new(),
            rpc_url,
        })
    }

    pub fn from_rpc_url(rpc_url: impl Into<String>) -> Self {
        Self {
            client: Client::new(),
            rpc_url: rpc_url.into(),
        }
    }

    fn fetch_balance(&self, address: &str) -> Result<u128> {
        let body = serde_json::json!({
            "jsonrpc": "2.0", "id": 1, "method": "eth_getBalance",
            "params": [address, "latest"]
        });
        let response = self
            .client
            .post(&self.rpc_url)
            .json(&body)
            .send()
            .map_err(|e| anyhow!("eth_getBalance request failed: {e}"))?;
        let resp: RpcResponse<String> = response
            .json()
            .map_err(|e| anyhow!("eth_getBalance parse failed: {e}"))?;
        let hex = resp
            .result
            .ok_or_else(|| anyhow!("eth_getBalance returned no result"))?;
        u128::from_str_radix(hex.trim_start_matches("0x"), 16)
            .map_err(|e| anyhow!("Failed to parse balance hex: {e}"))
    }
}

impl EvmSimulate for CeloSimulator {
    fn simulate_evm_tx(&self, tx: &EvmTxParams) -> Result<SimulationResult> {
        let pre_from = self.fetch_balance(&tx.from).unwrap_or(0);
        let pre_to = self.fetch_balance(&tx.to).unwrap_or(0);

        let call_params = serde_json::json!({
            "from": tx.from,
            "to": tx.to,
            "value": tx.value.as_deref().unwrap_or("0x0"),
            "data": tx.data.as_deref().unwrap_or("0x"),
            "gas": tx.gas.as_deref().unwrap_or("0x4C4B40"),
            "gasPrice": tx.gas_price.as_deref().unwrap_or("0x0"),
        });

        let body = serde_json::json!({
            "jsonrpc": "2.0", "id": 1, "method": "eth_call",
            "params": [call_params, "latest"]
        });

        let response = self
            .client
            .post(&self.rpc_url)
            .json(&body)
            .send()
            .map_err(|e| anyhow!("eth_call request failed: {e}"))?;
        let resp: RpcCallResponse = response
            .json()
            .map_err(|e| anyhow!("eth_call parse failed: {e}"))?;

        let mut sim_logs = Vec::new();
        let mut sim_error: Option<serde_json::Value> = None;
        let mut return_data: Option<ReturnData> = None;

        if let Some(ref data) = resp.result {
            if data.is_empty() || data == "0x" {
                sim_logs.push("eth_call returned 0x (empty)".to_string());
            } else {
                sim_logs.push(format!("eth_call succeeded, return data: {data}"));
                return_data = Some(ReturnData {
                    data: data.clone(),
                    encoding: "hex".to_string(),
                    program_id: tx.to.clone(),
                });
            }
        }

        if let Some(ref err) = resp.error {
            sim_error = Some(serde_json::json!({
                "code": err.code,
                "message": err.message.clone(),
            }));
            sim_logs.push(format!(
                "eth_call error: {} (code {})",
                err.message, err.code
            ));
        }

        let post_from = self.fetch_balance(&tx.from).unwrap_or(pre_from);
        let post_to = self.fetch_balance(&tx.to).unwrap_or(pre_to);

        let value_hex = tx.value.as_deref().unwrap_or("0x0");
        let value = u128::from_str_radix(value_hex.trim_start_matches("0x"), 16).unwrap_or(0);

        let mut balance_changes = HashMap::new();
        let from_delta = (post_from as i128) - (pre_from as i128) - (value as i128);
        if from_delta != 0 {
            balance_changes.insert(tx.from.clone(), from_delta as i64);
        }
        let to_delta = (post_to as i128) - (pre_to as i128) + (value as i128);
        if to_delta != 0 {
            balance_changes.insert(tx.to.clone(), to_delta as i64);
        }

        let sim_hash = compute_simulation_hash(&sim_logs, &sim_error);

        Ok(SimulationResult {
            logs: sim_logs,
            units_consumed: None,
            return_data,
            error: sim_error,
            balance_changes,
            simulation_hash: Some(sim_hash),
        })
    }
}

#[derive(Debug, Deserialize)]
struct RpcResponse<T> {
    result: Option<T>,
    #[allow(dead_code)]
    error: Option<RpcErrorBody>,
}

#[derive(Debug, Deserialize)]
struct RpcCallResponse {
    result: Option<String>,
    error: Option<RpcErrorBody>,
}

#[derive(Debug, Deserialize)]
struct RpcErrorBody {
    code: i64,
    message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvmSimulateResponse {
    pub allowed: bool,
    pub decision: String,
    pub reason: Option<String>,
    pub simulation_result: Option<SimulationResult>,
    pub risk_score: Option<u8>,
    pub risk_summary: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_evm_simulator_creation() {
        let sim = CeloSimulator::from_rpc_url("http://localhost:8545");
        assert_eq!(sim.rpc_url, "http://localhost:8545");
    }

    #[test]
    fn test_evm_tx_params_serialization() {
        let tx = EvmTxParams {
            from: "0x1234".to_string(),
            to: "0x5678".to_string(),
            value: Some("0xDE0B6B3A7640000".to_string()),
            data: Some("0x".to_string()),
            gas: None,
            gas_price: None,
            max_fee_per_gas: None,
            max_priority_fee_per_gas: None,
            nonce: None,
        };
        let json = serde_json::to_string(&tx).unwrap();
        assert!(json.contains("0x1234"));
        assert!(json.contains("0xDE0B6B3A7640000"));
    }
}
