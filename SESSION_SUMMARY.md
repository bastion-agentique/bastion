# Bastion Execution Plan — Session Summary

**Date**: May 22, 2026  
**Goal**: Four additions to make Bastion the definitive security infrastructure layer for AI agents

## Architecture Decisions

- **MCP server**: Separate private repo (`bastion-mcp`), not integrated into monorepo
- **Dashboard real-time**: SSE (Server-Sent Events) streaming, not polling
- **Arcium MXE integration**: Confidentiality engine (MPC circuits) for compliance verification
- **Execution order**: Phase 1 (Celo deploy) → Phases 2+3 parallel → Phase 4. Phase 5 independent
- **Celo testnet**: Celo Sepolia (chainId 11142220) replaced Alfajores

## Deployer Key

- Address: `0x40320e012e8F6b668ea4583873D0901Dff92D5eb`
- Stored in `evm/.env` (gitignored)
- Fund via: https://faucet.celo.org/celo-sepolia

## Completed Work

### Phase 1: Celo Deployment & EVM Readiness

1. **EVM contracts verified**: 54 tests pass across 4 test suites
   - `BastionAudit.sol` (129 lines) — EIP-712 immutable audit trail
   - `BastionPolicy.sol` (163 lines) — Per-agent policy engine
   - `BastionFirewall.sol` (157 lines) — ERC-7579 validator module
   - `BastionRegistry.sol` (156 lines) — Agent + target directory
   - `BastionERC8004Registry.sol` (345 lines) — ERC-8004 identity registry (22 tests)
   - `BastionSidecar.sol` (98 lines) — On-chain oracle for sidecar

2. **Celo RPC configured**: 
   - `evm/.env` — PRIVATE_KEY, CELO_RPC_URL, CELO_SEPOLIA_RPC_URL
   - `evm/foundry.toml` — celo, celo_testnet, celo_sepolia endpoints

3. **EVM simulation adapter**: `crates/sidecar/src/simulation_evm.rs`
   - `CeloSimulator` implements `EvmSimulate` trait
   - Uses `eth_call` against Celo RPC via `reqwest::blocking::Client`
   - Tracks pre/post balance changes, builds `SimulationResult`
   - New endpoint: `POST /api/v2/simulate-evm`

4. **EVM viem hooks**: `apps/web/src/hooks/useBastionEVM.ts`
   - Replaced stubs with real `usePublicClient`/`useWriteContract` calls
   - Contracts: `BastionAudit`, `BastionPolicy`, `BastionFirewall`
   - Event-based audit log reading via `getLogs`
   - Contract ABIs extracted to `apps/web/src/abi/`

### Phase 4: SSE Streaming Infrastructure

5. **SSE endpoint**: `crates/sidecar/src/lib.rs`
   - `GET /events` streaming endpoint
   - `tokio::sync::broadcast` channel (capacity 256)
   - `tokio_stream::wrappers::BroadcastStream` for async stream
   - 15-second keep-alive heartbeat
   - `emit_event()` helper for `AuditRecorded`, `HITLPending`, `HITLResolved` events

6. **SSE client hook**: `apps/web/src/hooks/useBastionEvents.ts`
   - React hook connecting to `/events` endpoint
   - Auto-reconnect on connection loss (3s backoff)
   - Event type dispatch: `AuditRecorded`, `HITLPending`, `HITLResolved`, `CircuitBreakerChanged`
   - 500-event history buffer

### Phase 2: MCP Server

7. **MCP server scaffolded**: `bastion-mcp/packages/mcp-server/`
   - `@modelcontextprotocol/sdk` v1.9 with Zod schemas
   - 4 MCP tools:
     - `bastion_evaluate_transaction` — Evaluate tx before signing (Pass/Block/PendingHITL)
     - `bastion_get_audit_log` — Retrieve on-chain audit trail
     - `bastion_get_policy` — Get active security policy
     - `bastion_override_block` — HITL: approve/reject blocked tx
   - 2 prompts: `bastion_verify_transaction`, `bastion_audit_history`
   - Stdio transport (compatible with Claude Desktop, Cursor, etc.)
   - HTTP client to sidecar (`src/client.ts`)
   - Compiles cleanly. Ready for `npm run build` + MCP client config

## File Changes Summary

### New Files
- `evm/.env` — Deployer key + RPC endpoints
- `crates/sidecar/src/simulation_evm.rs` (225 lines) — Celo EVM simulator
- `apps/web/src/hooks/useBastionEvents.ts` (95 lines) — SSE client hook
- `apps/web/src/abi/BastionAudit.ts` — Audit contract ABI
- `apps/web/src/abi/BastionPolicy.ts` — Policy contract ABI
- `apps/web/src/abi/BastionFirewall.ts` — Firewall contract ABI
- `apps/web/src/abi/BastionRegistry.ts` — Registry contract ABI
- `apps/web/src/abi/BastionERC8004Registry.ts` — ERC-8004 registry ABI
- `bastion-mcp/packages/mcp-server/package.json`
- `bastion-mcp/packages/mcp-server/tsconfig.json`
- `bastion-mcp/packages/mcp-server/src/index.ts` — MCP server entry point
- `bastion-mcp/packages/mcp-server/src/client.ts` — Sidecar HTTP client
- `bastion-mcp/packages/mcp-server/README.md`

### Modified Files
- `evm/foundry.toml` — Added `celo_sepolia` RPC endpoint
- `crates/sidecar/src/lib.rs` — Added SSE endpoint, EVM simulator integration, broadcast channel, event emission
- `crates/sidecar/src/main.rs` — Wired CeloSimulator creation from env, added to build_app
- `crates/sidecar/Cargo.toml` — Added `tokio-stream` (sync feature) and `futures`
- `crates/sidecar/tests/api_integration.rs` — Updated build_app call signature
- `crates/sidecar/tests/transaction_battery.rs` — Updated build_app call signature
- `apps/web/src/hooks/useBastionEVM.ts` — Full rewrite with real viem hooks

## Pending Work

### Blocked
- **Celo Sepolia deployment** — Deployer needs testnet CELO from faucet
- **Celo mainnet deployment** — After testnet success

### Remaining
- Dashboard HITL override queue UI (approve/reject buttons, real-time SSE integration)
- Dashboard editable policy configuration UI
- Dashboard audit log search filters (agent, chain, risk score, date range)
- GrondOSINT multi-source pipeline (Tavily, Shodan, social signals with explainable reasoning)
- Arcium MXE integration: MPC circuit compliance verification + integration guide

## Key Code Locations

### Sidecar Rust
- SSE endpoint handler: `crates/sidecar/src/lib.rs:922-940`
- EVM simulator: `crates/sidecar/src/simulation_evm.rs:42-167`
- Core chain adapter: `crates/sidecar/src/core_adapter.rs:40-66`
- AppState with broadcast: `crates/sidecar/src/lib.rs:58-69`

### EVM Contracts
- ERC-8004 identity: `evm/src/BastionERC8004Registry.sol:1-345`
- Audit trail: `evm/src/BastionAudit.sol:1-129`
- Deploy script: `evm/script/DeployBastion.s.sol:1-62`

### MCP Server
- MCP entry point: `bastion-mcp/packages/mcp-server/src/index.ts`
- Sidecar client: `bastion-mcp/packages/mcp-server/src/client.ts`

### Frontend
- EVM hooks: `apps/web/src/hooks/useBastionEVM.ts`
- SSE hooks: `apps/web/src/hooks/useBastionEvents.ts`
- Solana hooks (reference): `apps/web/src/hooks/useBastionProgram.ts`
