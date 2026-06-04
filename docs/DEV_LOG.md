# Bastion Development Log

## v0.3.0 — Agent Delegation System
**Date:** 2026-06-04
**Branch:** `main`
**Commit range:** `ad34f54..HEAD`

### Overview
Implemented hierarchical agent delegation — parent agents can spawn sub-agents with delegated authority. Sub-agents inherit capability subsets, have budget limits, and can be revoked.

### Decision: Off-chain delegation (MVP)
**Choice:** Implement delegation in the sidecar AgentStore only, without Anchor program changes.
**Rationale:**
- Avoids Solana devnet redeployment cycle
- Faster iteration on delegation UX
- Program is already deployed and has stack overflow issues with Anchor 0.30 + solana-tools
**Trade-off:** In-memory storage, agents lost on sidecar restart. **Mitigation:** Documented as MVP limitation. On-chain delegation planned for v0.4.0.
**Alternatives considered:**
- On-chain only: requires program rebuild + redeploy. Tools not compatible.
- Hybrid: sidecar + on-chain sync. Too complex for MVP.

### Decision: Max depth 3
**Choice:** Limit delegation depth to 3 levels (root → sub → sub-sub).
**Rationale:**
- Prevents infinite delegation chains
- Keeps audit trail tractable (at most 3-hop walk to find root authority)
- Covers 99% of real-world delegation use cases
**Trade-off:** Complex org structures (4+ levels) not supported. Can be increased in future.

### Decision: Bitmask capability inheritance
**Choice:** Child capabilities MUST be a subset of parent capabilities (`child_mask & !parent_mask == 0`).
**Rationale:**
- Simple, deterministic, no complex policy language needed
- Matches Anchor program's existing capability bitmask model
**Trade-off:** Limited to 5 capability types (transfer, swap, stake, governance, deploy). No per-function granularity.

### Decision: In-memory AgentStore
**Choice:** `RwLock<HashMap<String, TrackedAgent>>` — no disk persistence.
**Rationale:**
- Fastest MVP path
- Sled DB used for audit logs but not needed for agent registry (agents can re-register)
**Trade-off:** Lost on restart. **Mitigation:** Dashboard shows "re-register" hint. Future: Sled persistence or on-chain sync.

### Changes Made

#### Sidecar (Rust)
| File | Change |
|------|--------|
| `crates/sidecar/src/agents.rs` | **NEW** — AgentStore with delegation fields: parent_did, delegation_depth, delegated_capabilities, budget, expiry, child_dids. Methods: delegate_agent, list_children, get_tree, revoke, track_spend. |
| `crates/sidecar/src/lib.rs` | **UPDATE** — New handlers: register_agent_handler (parent_did support), delegate_agent_handler, revoke_delegation_handler, get_agent_children, get_agent_tree. New routes: POST /agents/:did/delegate, DELETE /agents/:did/delegation/:child_did, GET /agents/:did/children, GET /agents/:did/tree. |

#### SDK (TypeScript)
| File | Change |
|------|--------|
| `packages/sdk/src/index.ts` | **UPDATE** — New methods: delegateAgent(), revokeDelegation(), fetchAgentTree(), fetchAgentChildren(). New PDA seed: DELEGATED_AGENT_SEED. |
| `packages/sdk/src/types.ts` | **UPDATE** — New types: DelegationPolicy, AgentTreeData, delegation fields on Agent. |

#### Dashboard (React)
| File | Change |
|------|--------|
| `apps/web/src/hooks/useAgents.ts` | **UPDATE** — New hooks: delegateAgent, revokeDelegation, fetchAgentChildren, fetchAgentTree. |
| `apps/web/src/pages/AgentDetail.tsx` | **UPDATE** — Parent agent link, sub-agents list, delegation policy section, revoke button, budget progress bar, delegation chain breadcrumb. |
| `apps/web/src/pages/Dashboard.tsx` | **UPDATE** — Hierarchy mode toggle, parent/child clustering, delegation depth indicator, agent count breakdown. |
| `apps/web/src/pages/AgentList.tsx` | **NEW** — /agents page: grid of all registered agents with filters (parents only, by capability, delegation status). |
| `apps/web/src/App.tsx` | **UPDATE** — Add /agents route. |

#### Integration Guide
| File | Change |
|------|--------|
| `apps/web/src/pages/integrate/Integrate.tsx` | **UPDATE** — Added Step 0: Register Agent section with curl/SDK examples. |
| `apps/web/src/pages/integrate/QuickStartSection.tsx` | **UPDATE** — Added delegation code example. |
| `apps/web/src/pages/integrate/ApiReference.tsx` | **UPDATE** — Added delegation endpoints. |

#### Documentation
| File | Change |
|------|--------|
| `docs/DELEGATION_SYSTEM.md` | **NEW** — Full system spec: architecture, data model, API reference, SDK usage, security considerations. |
| `docs/DEV_LOG.md` | **NEW** — This file. Development log with decisions and rationale. |
| `docs/AUDIT_LOG.md` | **NEW** — Structured audit log event schema and template. |
| `docs/CHANGELOG.md` | **NEW** — Version history. |
| `README.md` | **UPDATE** — Added delegation features, quick start example, updated architecture. |
| `docs/ARCHITECTURE.md` | **UPDATE** — Added delegation data flow, AgentStore tree structure, delegation lifecycle. |

### Test Results
- `cargo test -p bastion-core -p bastion-sidecar`: 92 tests passed, 0 failed
- `pnpm --filter bastion-dashboard build`: ✓ built successfully
- `pnpm --filter @bastion-agentique/sdk build`: $ tsc passed
- Integration: POST /agents, POST /delegate, GET /agents/:did/children, DELETE /delegations all functional

### Known Limitations
1. **In-memory AgentStore** — agents lost on sidecar restart. Mitigation: users can re-register.
2. **No on-chain verification** — sidecar trusts agent self-registration. Planned for v0.4.0 with Anchor program sync.
3. **No budget enforcement in policy engine** — budget tracking exists in AgentStore but is not enforced by `PolicyEvaluator`. Mitigation: sidecar-level budget check planned.
4. **No delegation in Anchor program** — on-chain PDA hierarchy not implemented. Agents are flat on-chain.
5. **AgentFloor no delegation lines** — visual hierarchy in canvas component pending. Current fallback: text hierarchy in dashboard.

### Next Steps
1. Anchor program: `delegate_agent` instruction with PDA seeds
2. Policy engine: `DelegationConstraint` rule type
3. AgentFloor: delegation lines between parent/child nodes
4. Sled DB persistence for AgentStore
5. Budget enforcement at policy evaluation time
