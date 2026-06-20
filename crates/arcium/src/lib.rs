//! Arcium MXE integration for Bastion.
//!
//! Provides the `ArciumClient` trait and types for confidential policy
//! evaluation via Arcium's Multi-party Computation eXecution Environments.

#![deny(missing_docs)]

pub mod circuits;
pub mod client;
pub mod solana;
pub mod types;

pub use client::{ArciumClient, NoopArciumClient};
pub use types::{ArciumError, MxeConfig, MxeResult};
