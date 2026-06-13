# Changelog

All notable changes to Bastion will be documented in this file.

## [0.5.2], 2026-06-11

### Added
- **SDK: simulateEvm() method**, `POST /api/v2/simulate-evm` for EVM transaction simulation
- **SDK: events() method**, SSE stream for real-time audit events via `BastionEventStream`
- **Web2 API firewall crate** (`crates/web2-firewall`), proxy engine, policy rules, OpenAPI parser, provider adapters (OpenAI, Stripe, Slack, GitHub)
- **Web2 SDK** (`@bastion-agentique/web2-sdk` v0.1.0), BastionWeb2Client with TDD (9 tests)
- **Web2 agent skill**, `web2-api-firewall-administrator` for proxy policy configuration
- **docs/WEB2_EXPANSION_PLAN.md**, phased rollout, pricing, GTM, repo positioning rule
- **SDK tests**, jest infrastructure, 6 tests for BastionSidecar
- **EVM types**, EvmTxParams, EvmSimulateRequest, EvmSimulateResponse, SseEvent

### Changed
- **SDK: extracted BastionSidecar** to `sidecar.ts` for clean test isolation
- **AGENTS.md**, added Web2 stack, web2-firewall crate, updated architecture diagram
- **SPEC.md**, rewritten for current capabilities (blockchain + Web2 + SIEM)
- **ARCHITECTURE.md**, added Web2 API proxy flow, SIEM ingestion flow, complete repo structure
- **README.md**, added Web2 SDK badge, alpha disclaimer, updated tech stack and features
- **Landing page**, added Web2 proxy mention and alpha disclaimer
- **/integrate page**, added Web2 SDK install block, Proxy card, alpha disclaimer
- **All .md files**, added alpha testing disclaimer

### Fixed
- **Issue #10**, `updatePolicy` confirmed using `POST /policy/full`, missing methods added

## [0.3.0], 2026-06-04

### Added
- **Agent delegation system**: Parent agents spawn sub-agents with delegated authority
- `POST /agents/:did/delegate` endpoint for spawning sub-agents
- `DELETE /agents/:did/delegation/:child_did` endpoint for revoking delegations
- `GET /agents/:did/children`, list sub-agents of a parent
- `GET /agents/:did/tree`, full delegation tree
- AgentList page `/agents`, browse all registered agents with filters
- AgentDetail delegation UI: parent link, sub-agents list, budget progress, revoke button
- Dashboard hierarchy mode: parent/child clustering, delegation depth indicator
- SDK: `delegateAgent()`, `revokeDelegation()`, `fetchAgentTree()`, `fetchAgentChildren()`
- Documentation: `DELEGATION_SYSTEM.md`, `DEV_LOG.md`, `AUDIT_LOG.md`, `CHANGELOG.md`

### Changed
- Integrate page: added agent registration section with curl/SDK examples
- QuickStartSection: added delegation code example
- ApiReference: added delegation endpoints
- Dashboard: hierarchy view toggle, agent count breakdown
- README.md: added delegation features and documentation section
- ARCHITECTURE.md: added delegation data flow and AgentStore tree structure
- chains.ts: Celo → EVM (under development), Solana is primary target

### Fixed
- Navbar spacing: `pt-[72px]` → `pt-32` for clean content separation
- Active Agents stat: now shows real `trackedAgents.length` with fallback
- Registered Agents section: always visible with empty state message
- Agent Health donut: derived from real agent reputation scores
- Source Chain donut: derived from DID chain prefix data
- Overview tab: added architecture summary and approval actions
- Cases tab: added agent-linked structure

---

## [0.2.0], 2026-06-03

### Added
- Security audit remediation across entire monorepo
- API key authentication middleware (`BASTION_API_KEY` env var)
- Protected routes: `/override`, `/circuit-breaker/*`, `/policy/*`, `/audit/logs/clear`
- Auth bypass when `BASTION_API_KEY` is not set (development convenience)
- `X-Api-Key` header required for all mutating endpoints in production
- Circuit breaker audit logging (engage/disengage events)
- `@solana/web3.js` upgraded to `^1.98.0` (supply chain fix)
- `.env.example` templates for sidecar and dashboard
- `.env` files git-ignored (never commit secrets)

### Changed
- Solana program: authority constraints on `SetPolicy`, `UpdateReputation`, `LogAudit`
- Solana program: space calculation fix (`size_of` → manual constants for String/Vec)
- Solana program: `emergency_pause` idempotency guard, removed dead `owner` field
- Core: 24h volume accumulator windowed reset with `Instant` tracking
- Core: `check_amount` now validates currency match before comparison
- Core: GrondOracle errors now return `Err` (fail-closed) instead of `Ok(0)` (fail-open)
- Core: `Address::is_valid()` validation, reputation check blocks on missing oracle
- Sidecar: removed per-entry `fsync()` from audit log, added periodic background flush
- Sidecar: fixed `program_client.rs` `total_audits` byte offset (corrected after owner removal)
- Sidecar: removed duplicate `/events` route, fixed SSE event decision broadcast
- SDK: `logAudit` now derives `auditEntry` PDA from `totalAudits` counter
- IDLs: removed phantom `owner` field from `AuditState`, added `AlreadyPaused` error
- EVM: all 6 Solidity contracts marked with `@notice: UNDER ACTIVE DEVELOPMENT`
- Documentation: updated README, AGENTS.md, SECURITY.md

### Fixed
- `prompt_safety.rs`: injection pattern case-sensitivity bug (patterns now lowercased)
- `evaluator.rs`: 3 clippy warnings (doc comment gap, wildcard_in_or_patterns, collapsible_if)
- `ingestion.rs`: `private_interfaces` warning (pub → pub(crate))
- `simulation.rs`: unused `api_key` field in `AlchemySimulator`
- `simulation_evm.rs`: dead `error` field in `RpcResponse`

---

## [0.1.0], 2026-05-01

### Added
- Initial release: Bastion sidecar with Axum HTTP server
- Policy engine with Solana-native transaction validation
- Helius simulation integration
- On-chain audit program (Anchor, Solana devnet)
- TypeScript SDK (`@bastion-agentique/sdk`)
- React dashboard with agent fleet visualizer
- EVM contracts (Solidity, Foundry), under development
- Arcium MXE confidentiality engine (MPC circuits)
- MCP server with 15 tools + 3 prompts
- SIEM expansion: correlation engine, ingestion, case management, DID resolver
