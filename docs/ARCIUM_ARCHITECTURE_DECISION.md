# ADR: Arcium Integration Architecture

## Status: Proposed

## Context

Bastion needs to integrate Arcium MXEs for confidential policy evaluation. The question is how: as a Chain enum variant, as a RiskOracle, or as a PolicyEvaluator wrapper.

## Decision

Option B: ArciumPolicyEvaluator wrapping PolicyEvaluator.

## Options Considered

### Option A: Chain::Arcium
Add Arcium as a Chain enum variant alongside Solana, Base, Ethereum.

Pros: Simple, follows existing pattern.
Cons: Arcium is not a blockchain. It is a computation network. Misleading abstraction. NormalizedTransaction fields (from/to/amount/currency) do not fit encrypted circuit inputs.

### Option B: ArciumPolicyEvaluator (Recommended)
Wrap PolicyEvaluator with Arcium client. If Arcium configured and transaction is Solana, evaluate through MXE. If Arcium unavailable, fall back to local evaluation.

Pros: Clean separation. No pollution of Chain enum. Preserves existing behavior. Future-proof for more MXE evaluators.
Cons: More boilerplate than a simple enum variant.

### Option C: Arcium as RiskOracle
Implement RiskOracle trait for Arcium.

Pros: Plugs into existing PolicyEvaluator<R: RiskOracle> trait.
Cons: RiskOracle is for address risk scoring, not full policy evaluation. API mismatch.

## Decision Rationale

1. Arcium is computation infrastructure, not a blockchain. Chain enum is wrong abstraction.
2. Innermost evaluation loop (PolicyEvaluator) should not know about Arcium.
3. Wrapping pattern preserves existing behavior when Arcium is absent.
4. Future-proof: can add more MXE-based evaluators without touching Chain enum.

## Implementation

```rust
pub struct ArciumPolicyEvaluator<R: RiskOracle> {
    inner: PolicyEvaluator<R>,
    arcium: Option<ArciumClient>,
}
```

The evaluate method:
  If arcium is Some and tx.chain == Chain::Solana:
    Run evaluation through Arcium MXE
    If Arcium returns result: use it
    If Arcium fails and fallback_to_local: delegate to inner
  Else:
    Delegate to inner (existing behavior)
