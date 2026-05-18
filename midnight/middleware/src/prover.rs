use sha2::{Digest, Sha256};

pub struct ProofResult {
    pub proof_hash: String,
}

/// Generate a ZK compliance proof for an allowed transaction.
///
/// In production, this calls `@midnight-ntwrk/midnight-js` via a Node subprocess
/// to produce a real Compact circuit proof. During development / devnet testing,
/// we return a deterministic mock proof hash.
pub fn generate_compliance_proof(
    agent_id: &str,
    target: &str,
    value: u64,
    selector: &str,
) -> ProofResult {
    // TODO: replace with actual Midnight proof generation
    // Command will be:
    //   node prover.js --agentId <> --target <> --value <> --selector <>
    // which internally calls compact-runtime verifyCompliance circuit

    let mut h = Sha256::new();
    h.update(format!("proof:{agent_id}:{target}:{value}:{selector}").as_bytes());
    let hash = hex::encode(h.finalize());

    ProofResult {
        proof_hash: format!("0x{hash}"),
    }
}

/// Generate a deterministic mock transaction hash for devnet.
pub fn mock_tx_hash(seed: &str) -> String {
    let mut h = Sha256::new();
    h.update(format!("tx:{seed}").as_bytes());
    format!("0x{}", hex::encode(h.finalize()))
}
