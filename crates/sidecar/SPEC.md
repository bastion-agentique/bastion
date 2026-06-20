# Sidecar Simulation Spec

## /simulate Flow

```
POST /simulate { transaction: base64, intent?: string }
  |
  1. Decode base64 -> bincode -> solana_sdk::Transaction
  2. Check circuit breaker (is_paused? -> 503)
  3. Classify intent from transaction data (transfer/swap/stake/unknown)
  4. Policy check (allowlist, rate limit per agent, SOL caps)
  5. Simulate via Helius/Alchemy simulateTransaction RPC
  6. Post-simulation checks (parallel):
     NoErrorCheck        -> simulation.error must be None
     MaxUnitsCheck       -> units_consumed <= max_units
     MaxBalanceDrainCheck-> |balance_change| <= max_drain
     FlashLoanCheck      -> detect flash loan patterns in logs
     HighSlippageCheck   -> detect high slippage in swap logs
  7. Log audit entry (sled DB)
  8. Optionally write on-chain audit (Anchor program CPI)
  9. Return FirewallDecision { Pass | Block | PendingHITL }
```

## Post-Simulation Checks

| Check | Condition | Block Reason |
|-------|-----------|--------------|
| NoErrorCheck | simulation.error is None | "Transaction simulation failed: {error}" |
| MaxUnitsCheck | units_consumed <= max_units | "Exceeds max compute units" |
| MaxBalanceDrainCheck | |balance_change| <= max_drain | "Exceeds max balance drain" |
| FlashLoanCheck | no flash loan pattern in logs | "Flash loan pattern detected" |
| HighSlippageCheck | slippage <= threshold | "High slippage detected" |

## Chain Routing

| Input chain | Chain variant | Simulation source |
|-------------|---------------|-------------------|
| "solana" or None | Chain::Solana | Helius/Alchemy simulateTransaction |
| "base" | Chain::Base | CeloSimulator (reuse EVM) |
| "ethereum" | Chain::Ethereum | CeloSimulator |
| "polygon" | Chain::Polygon | CeloSimulator |
| "arbitrum" | Chain::Arbitrum | CeloSimulator |
| "celo" | Chain::Celo | CeloSimulator eth_call |

## Existing Test Coverage

| Test File | Lines | Tests | Coverage |
|-----------|-------|-------|----------|
| api_integration.rs | 1212 | 20+ | Full REST API |
| transaction_battery.rs | 814 | 15 | Transaction scenarios |
| policy_engine_suite.rs | 258 | 8 | Policy rules |
| simulation_checks.rs | 157 | 12 | Post-sim checks |
| core_adapter.rs (inline) | 90 | 5 | v2 evaluate + chain routing |

## Test Coverage Gaps

| Gap | Priority | New Test |
|-----|----------|----------|
| EVM simulation | Medium | test_simulate_evm_base, test_simulate_evm_celo |
| All chain routing | Medium | test_chain_routing_all_variants |
| Circuit breaker + simulate | Medium | test_circuit_breaker_blocks_simulate |
| Intent classification edges | Medium | test_intent_classification_edge_cases |
| Concurrent rate limits | Low | test_concurrent_simulate_rate_limits |
