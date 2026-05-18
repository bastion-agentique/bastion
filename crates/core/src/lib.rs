//! Bastion Core — chain-agnostic types and policy engine.
//!
//! This crate provides the shared foundation for all chain-specific
//! Bastion implementations:
//!
//! - `NormalizedTransaction`: chain-agnostic transaction representation
//! - `FirewallDecision`: the outcome of a policy evaluation
//! - `PolicyEvaluator`: core evaluation loop
//! - `RiskOracle`: trait for address risk scoring providers
//! - `AuditRecord`: chain-agnostic audit event

pub mod audit;
pub mod decision;
pub mod policy;
pub mod risk;
pub mod transaction;

pub use audit::AuditRecord;
pub use decision::FirewallDecision;
pub use policy::{PolicyEvaluator, PolicyRule, PolicySet};
pub use risk::{RiskOracle, RiskOracleError, RiskScore, WebacyClient};
pub use transaction::{Address, AgentId, Chain, NormalizedTransaction, TxType};
