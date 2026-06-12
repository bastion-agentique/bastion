# Bastion Competitive Analysis — vs litebeam.xyz

> **Date:** 2026-06-12 &nbsp;·&nbsp; **Status:** Analysis complete, improvement plan active
>
> Litebeam is an AI microservice routing layer (MCP-native, Base/USDC settlement, real-time auction across 6,000+ services).
> Bastion is an AI agent security firewall (multi-chain simulation, policy engine, on-chain audit).
> **These are complementary products, not direct competitors.** The strategy is integration + differentiation, not head-to-head.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [What Bastion Built So Far](#2-what-bastion-built-so-far)
3. [Litebeam Deep Dive](#3-litebeam-deep-dive)
4. [Competitive Positioning Matrix](#4-competitive-positioning-matrix)
5. [Feature Parity Gap Analysis](#5-feature-parity-gap-analysis)
6. [Strategic Recommendations](#6-strategic-recommendations)
7. [Improvement Plan (Prioritized)](#7-improvement-plan-prioritized)
8. [3-Day Sprint Plan](#8-3-day-sprint-plan)
9. [What NOT to Do](#9-what-not-to-do)
10. [Reference Architecture — Bastion + Litebeam](#10-reference-architecture--bastion--litebeam)
11. [Appendices](#11-appendices)

---

## 1. Executive Summary

### The Landscape

Two products serve the AI agent ecosystem from opposite ends of the stack:

| | Bastion | Litebeam |
|---|---|---|
| **Problem** | Agent wallets get drained. No audit trail. No policy enforcement. | Agent needs 100+ API keys. Can't compare vendors. Can't auto-pay. |
| **Layer** | **Security** — prevent bad transactions | **Routing** — find best vendor + settle payment |
| **Value prop** | "Trust your Agent, but Verify every Transaction" | "One MCP connection. Every microservice. Zero config." |
| **Integration** | Sidecar HTTP proxy + on-chain program | Single MCP server config block |
| **Chains** | Solana + EVM (Celo/Base/Polygon/ETH) + Midnight (ZK) | Base (USDC settlement) + Tempo (MPP buffer) |
| **Maturity** | Active dev (5+ crates, 6 contracts, SDK, dashboard, CI/CD) | Very early (6 commits, 0 releases, 0 stars) |

### The Recommendation

**Bastion should integrate with Litebeam, not compete.** The two products solve different problems at different layers. The strongest position is: *"Use Litebeam to discover + pay for microservices. Use Bastion to ensure every on-chain transaction is safe and auditable."*

**Primary action items:**
1. Close UX gaps Litebeam exposed (budget UI, MCP-first positioning, x402 surfacing)
2. Build a Litebeam firewall adapter (Bastion secures Litebeam-routed calls)
3. Market the integration as a reference architecture

---

## 2. What Bastion Built So Far

### 2.1 Recent Work (June 2026)

| Date | Commit | What |
|---|---|---|
| 2026-06-12 | `05ddaad` | Quasar migration attempt → reverted to Anchor (crate immaturity) |
| 2026-06-12 | `a37dd8a` | Staking removed — deleted 4 instructions from Solana program + SDK |
| 2026-06-12 | `a8210fb` | Web2 API firewall expansion — proxy engine, provider adapters (OpenAI, Stripe, Slack, GitHub) |
| 2026-06-12 | `401f3fa` | SDK 0.5.2 release |
| 2026-06-11 | `5da98de` | MCP reverse proxy via sidecar at `/mcp/*` (15 tools, 3 prompts, SSE) |
| 2026-06-11 | `81c67cf` | IMPROVEMENTS.md — 5 features (reputation, HITL, webhook, behavioral, intent scoring) |
| 2026-06-11 | `b9d9471` | SDK fix: `updatePolicy` uses POST /policy/full |
| 2026-06-11 | `71f6e46` | README + Integrate — MCP proxy, EVM contracts, Foundry status |
| 2026-06-10 | — | EVM dashboard hooks wired (functional, not stubs) |
| 2026-06-09–10 | — | 6 Solidity contracts + 54 Foundry tests + deploy script |

### 2.2 Current Feature Inventory

#### Rust Workspace

| Crate | Status | Key Capabilities |
|---|---|---|
| `core` | Complete | Chain-agnostic `PolicyEvaluator<O: RiskOracle>`, `PolicyRule`, `PolicySet`, `NormalizedTransaction`, `FirewallDecision` |
| `sidecar` | Complete | Axum HTTP server (port 3000), Helius simulation, EVM simulation (Celo), Sled audit DB, GrondOSINT oracle, Anchor program RPC client, agent registry, DID resolution, circuit breaker, case management |
| `web2-firewall` | Partial | Proxy engine types + PolicyRule + provider adapters (OpenAI, Stripe, Slack, GitHub). HTTP forward proxy, TLS, webhook security, inspector missing |
| `correlation` | Skeleton | SIEM event correlation — 3 modules (buffer, engine, rules), content sparse |
| `solana/bastion-audit` | Complete | Anchor 0.30.1, 7 instructions, deployed on devnet `A29V5MUVs73y7XBHHxPpPcAW7h4gGHupbDdwYSwA2n9D` |

#### EVM Contracts (`evm/`)

| Contract | Purpose |
|---|---|
| `BastionFirewall.sol` | ERC-7579 validator — gates UserOperations |
| `BastionPolicy.sol` | Per-agent rules (allowlists, limits, cooldowns) |
| `BastionAudit.sol` | EIP-712 signed immutable audit trail |
| `BastionRegistry.sol` | Agent + target directory |
| `BastionERC8004Registry.sol` | ERC-8004 agent identity (ERC-721 + EIP-712) |
| `BastionSidecar.sol` | Oracle request/fulfill pattern |

→ 54 Foundry tests, deploy script at `evm/script/DeployBastion.s.sol`

#### TypeScript SDK (`packages/sdk/`)

| Component | Status |
|---|---|
| `BastionClient` | Complete — 7 Anchor instruction methods |
| `BastionSidecar` | Complete — simulate, logs, policy, override, health, circuit-breaker, EVM simulate, SSE |
| `BastionEventStream` | Complete — SSE event stream |
| `BastionWeb2Client` | Complete — `buildRequest()`, `evaluate()`, proxy methods (9 TDD tests) |

#### MCP Server (`packages/mcp-server/`)

- 15 tools: simulate, logs, policy, override, agents, circuit-breaker, health, etc.
- 3 prompts: security-analysis, policy-generation, agent-diagnostic
- SSE transport, proxied via sidecar at `/mcp/*`
- x402 payment verification (Solana SOL transfer polling)
- `bastion-provider.yml` for marketplace registration

#### Dashboard (`apps/web/`)

| Page | Status |
|---|---|
| Landing (/) | Complete — VideoBackground, feature showcase, competitive comparison table |
| Dashboard (/dashboard) | Built but **NOT wired in router** — live tx feed, stats, audit log viewer, policy editor, circuit breaker |
| Integrate (/integrate) | Complete — install blocks, API examples, MCP proxy docs |
| `useBastionProgram.ts` | Complete — Solana Anchor hooks |
| `useBastionEVM.ts` | Functional — EVM reads/writes via wagmi |
| `useSidecar.ts` | Complete — REST API hooks |
| `useAgents.ts` | Complete — agent registry hooks |

### 2.3 Known Gaps (from IMPROVEMENTS.md)

| # | Feature | Status |
|---|---|---|
| 1 | Reputation feedback loop (auto-strike on block) | 80% built, missing write-back path |
| 2 | Webhook on block events | Not implemented |
| 3 | HITL approval UI in dashboard | Not implemented |
| 4 | AI intent scoring (heuristic) | Not implemented |
| 5 | Behavioral baseline per agent | Not implemented |
| 6 | Web2 firewall proxy/routing | Types defined, logic missing |
| 7 | SIEM correlation engine | Skeleton only |

---

## 3. Litebeam Deep Dive

### 3.1 What Litebeam Is

An **AI microservice routing layer** — a single MCP gateway that lets AI agents call any external API service (image generation, translation, search, audio, finance, data, compute, code) without managing vendor accounts, API keys, or payment integrations.

**Three-step flow:** Call → Route → Settle (under 800ms p50).

### 3.2 Feature Inventory

| Category | Feature | Detail |
|---|---|---|
| **Integration** | MCP-native | Single config block: `{ "mcpServers": { "litebeam": { "url": "...", "headers": { "Authorization": "Bearer sk-litebeam-..." } } } }` |
| | 2 MCP tools | `call_service` (natural language or capability keyword) + `list_services` |
| | Dual routing mode | AI-routed (LLM classifies, selects, extracts params) or explicit (skip AI, cheaper) |
| | Supported clients | Claude Desktop, Cursor, Claude Code, any MCP HTTP client |
| **Routing** | Real-time auction | Parallel bids across x402 + MPP, ranked by `priceScore × 0.5 + reputationScore × 0.5` |
| | Prefilter + AI select | Keyword search across 6,000+ services → up to 25 candidates → LLM picks winner |
| | Cost transparency | Response includes: `vendor_cost_usdc`, `litebeam_fee_usdc`, `vendor_endpoint`, `latency_ms`, `candidates_evaluated`, `ai_routed` |
| **Payment** | Mode A — Litebeam wallet | Pre-funded USDC on Base. Dedicated dashboard. Per-request deduction. |
| | Mode B — BYO wallet | No account needed. HTTP 402 + EIP-3009. Agent signs, Litebeam verifies and fulfills. |
| | Fee | **0.5% (50 bps)** of routed volume, deducted from vendor payment |
| **Budget** | Daily spend limit | USDC/day hard cap, resets at UTC midnight |
| | Approval threshold | Per-call HITL — requests above threshold pause and notify human |
| | Low balance alert | Pings operator when balance drops below configured amount |
| **Reputation** | Vendor reputation | Starts at 80. ±2 (fast <500ms), ±1 (normal), -1 (slow >2000ms), -5 (failure). 0–100 range. |
| | On-chain update | Reputation updated per settled transaction |
| **Services** | Directory | 6,000+ services indexed from `agentic.market` (x402) + `mpp.dev` (MPP). Sync every 6h. |
| | Categories | image, text, audio, search, finance, data, compute, travel, code |
| | Status tracking | online / slow / offline (2+ days unseen → offline) |
| | llms.txt ingestion | Auto-reads vendor documentation for routing accuracy and `vendor_guidance` |
| **Architecture** | Registry crawler | Pulls from public directories every 6h, categorizes, fetches llms.txt |
| | Protocol abstraction | Agent calls capability. Litebeam decides x402 vs MPP vs future protocol. |
| | USDC settlement | All payments on Base mainnet (chainId 8453). Fully auditable on Basescan. |
| | Tempo buffer | Separate wallet for MPP protocol settlement (agents never interact with Tempo) |
| **HITL** | Per-call override | `hitl_override_id` in `call_service` |
| | REST API | List pending/approved/rejected HITL requests |

### 3.3 Maturity Assessment

| Metric | Value |
|---|---|
| GitHub commits | 6 |
| GitHub stars | 0 |
| npm releases | 0 |
| Contributors | 1 |
| Service directory | **Empty** at fetch time ("no services match") |
| Documentation | Good — 9 markdown files, clear structure, working code snippets |
| Architecture clarity | Excellent — well-documented ranking formula, protocol abstraction, registry sync |

**Verdict:** Very early proof of concept. Conceptually strong, well-documented, but unproven. The 6,000+ service claim comes from crawling public directories — the actual end-to-end flow may not be functional yet.

---

## 4. Competitive Positioning Matrix

### 4.1 Head-to-Head

| Dimension | Bastion | Litebeam | Leader |
|---|---|---|---|
| **Core value** | Security (prevent bad txs) | Routing (find best vendor + pay) | N/A — different |
| **Integration** | Sidecar proxy + on-chain program | Single MCP config block | Litebeam |
| **MCP tool count** | 15 tools + 3 prompts | 2 tools | Bastion |
| **On-chain depth** | Solana Anchor program + 6 EVM contracts | Base payment settlement only | Bastion |
| **Multi-chain** | Solana + EVM + Midnight | Base + Tempo | Bastion |
| **Payment layer** | x402 in MCP (undocumented) | Primary product feature | Litebeam |
| **Policy engine** | `PolicyEvaluator<O: RiskOracle>` (chain-agnostic) | N/A | Bastion |
| **Transaction simulation** | Helius + EVM simulation | None | Bastion |
| **Agent identity** | W3C DID, ERC-8004, delegation | None | Bastion |
| **Circuit breaker** | On-chain pause/resume | None | Bastion |
| **Web2 API firewall** | HTTP proxy for API calls | MCP-only outbound routing | Bastion |
| **Audit trail** | Sled + Solana on-chain + EIP-712 | Payment tx history only | Bastion |
| **Budget controls** | Policy rules (config.toml) | Dashboard UI with daily limit, approval threshold, alerts | Litebeam |
| **Dashboard UX** | Feature-rich but partially wired | Clean, focused | Litebeam |
| **Open source** | Full monorepo | Partial (core router is SaaS) | Bastion |
| **Maturity** | Active dev, CI/CD, deployed | 6 commits, 0 releases | Bastion |
| **Service directory** | None | 6,000+ indexed (empty at fetch) | Litebeam |
| **Documentation** | Comprehensive but sprawling | Concise, code-heavy | Litebeam |

### 4.2 Value Map

```
                    ROUTING (Litebeam)
                          ▲
                          │
                  ┌───────┼───────┐
                  │       │       │
                  │ Both  │ Lite- │
                  │ missing beam  │
                  │       │ lane  │
 ┌────────────────┼───────┼───────┼─────────────────┐
 │                │       │       │                 │
 │  Bastion lane  │  Bastion +   │  Litebeam lane  │
 │  (unique)      │  Litebeam   │  (unique)       │
 │                │       │       │                 │
 └────────────────┼───────┼───────┼─────────────────┘
                  │       │       │
                  │  Both products have these       │
                  │  (MCP, budget, HITL, reputation)│
                  │                                 │
                  ▼                 SECURITY (Bastion)
```

**Bastion wins:** simulation, policy engine, multi-chain, on-chain audit, identity, Web2 firewall
**Litebeam wins:** routing-auction, payment, service directory, budget UX, low-friction onboarding
**Both have:** MCP integration, budget/limit concepts, HITL, reputation tracking
**Neither has:** Full observability (metrics/traces/dashboards), enterprise SSO/SAML, compliance certifications

---

## 5. Feature Parity Gap Analysis

### 5.1 Gaps Bastion Should Close

| # | Gap | Litebeam's Implementation | Bastion Status | Priority | Effort |
|---|---|---|---|---|---|
| G1 | **Budget control UI** | Daily spend limit, per-call approval threshold, low-balance alert — all in dashboard | Policy engine has rules but no dashboard UI for budget visualization | **Critical** | Med |
| G2 | **MCP-first positioning** | Single MCP config = entire product | MCP server has 15 tools but buried in docs; sidecar is primary integration path | **Critical** | Low |
| G3 | **x402 as product feature** | Core payment rail, prominently marketed | x402 exists in MCP server, not documented or surfaced in dashboard | **High** | Low |
| G4 | **Cost transparency** | Line-item breakdown in every response (`vendor_cost_usdc`, `litebeam_fee_usdc`, `latency_ms`) | Simulation response shows block/pass decision but no cost breakdown | **Medium** | Low |
| G5 | **Integration marketplace** | Service directory (6,000+ services) | No equivalent — could add policy template catalog or adapter registry | **Medium** | Med |
| G6 | **HITL approval UI** | Per-call HITL with REST API for pending/approve/reject | `PendingHITL` exists in core, override endpoint exists, dashboard panel not built | **Medium** | Med |
| G7 | **No-account onboarding** | BYO wallet mode — zero signup, just HTTP 402 response | Requires sidecar setup, env vars, wallet connection | **Low** | High |
| G8 | **Service health monitoring** | Vendor status tracking (online/slow/offline), reputation per tx | No concept of tracking external service health (just agent reputation) | **Low** | High |

### 5.2 Gaps Litebeam Has (Bastion's Moat)

| # | Advantage | Bastion | Litebeam's Gap |
|---|---|---|---|
| M1 | **Transaction simulation** | Helius API + EVM simulation before signing | No pre-execution validation |
| M2 | **Risk oracle** | GrondOSINT integration for address risk | No risk scoring for addresses |
| M3 | **Multi-chain support** | Solana + EVM (4 chains) + Midnight | Base only |
| M4 | **On-chain audit trail** | Anchor PDA on Solana + EIP-712 events on EVM | Just payment tx history |
| M5 | **Circuit breaker** | On-chain `emergency_pause`/`emergency_resume` | No emergency controls |
| M6 | **Agent identity system** | W3C DID resolution, ERC-8004 NFTs, parent/child delegation with budget limits | No agent identity concept |
| M7 | **Web2 API firewall** | HTTP proxy with policy evaluation for API calls | MCP-only — no HTTP proxy layer |
| M8 | **SIEM correlation** | Event correlation engine (buffer/engine/rules) | No event correlation |
| M9 | **Full open source** | Everything in monorepo | Core router is SaaS |

---

## 6. Strategic Recommendations

### 6.1 Primary Strategy: Complement, Don't Compete

Bastion and Litebeam solve opposite problems. The best position is **integration + differentiation**.

**Narrative:** *"Litebeam finds and pays for AI microservices. Bastion ensures every on-chain transaction those services trigger is safe, policy-compliant, and auditable."*

### 6.2 Specific Recommendations

#### R1: Integrate MCP-first positioning (Priority: Critical)

Litebeam proves MCP is the default integration surface for AI agents in 2026. Bastion's MCP server already has 15 tools (vs Litebeam's 2), but it's treated as secondary.

**Action:** Rewrite Integrate page and README to lead with MCP config block. Make the sidecar HTTP API the second option, not the first.

```json
// Primary integration path:
{
  "mcpServers": {
    "bastion": {
      "url": "https://bastion-agentique.fly.dev/mcp/sse",
      "headers": { "Authorization": "Bearer sk-bastion-..." }
    }
  }
}
```

#### R2: Build Bastion → Litebeam Adapter (Priority: High)

Wrap Litebeam's MCP with Bastion's security policies. When an agent calls `litebeam.call_service("generate_image prompt=...")`, Bastion intercepts, runs content inspection, checks budget limits, and only forwards if it passes.

**Architecture:**
```
Agent (MCP client)
    │
    ├─ MCP connection: Litebeam (routing + payment)
    │                    │
    │                    ▼
    │              ┌──────────────┐
    │              │   Bastion    │ ← Web2 firewall inspects outbound API call
    │              │ (adapter)   │     before Litebeam routes it
    │              └──────┬───────┘
    │                     │ if pass
    │                     ▼
    │              ┌──────────────┐
    │              │   Litebeam   │ → routes to vendor, settles USDC
    │              └──────────────┘
    │
    └─ MCP connection: Bastion (security + audit)
```

This is a **net-new value proposition** neither product currently has.

#### R3: Close the Budget UX Gap (Priority: Critical)

Litebeam's budget dashboard is clean, simple, and immediately understandable. Bastion has more powerful policy rules but no user-facing budget interface.

**Action:** Add a budget overview panel to Dashboard.tsx with:
- Daily spend gauge (current / limit)
- Per-agent budget breakdown
- Alert configuration (low balance, threshold exceeded)
- Quick-edit policy limits

#### R4: Surface x402 as a Product Feature (Priority: High)

Litebeam made x402 the core of their payment narrative. Bastion has x402 verification working in the MCP server but never marketed it.

**Action:**
1. Document `x402` tool in the MCP integration docs
2. Add "Pay-per-call firewall" to the landing page features
3. Add x402 payment status to dashboard (recent payments, success rate)

#### R5: Document the Joint Architecture (Priority: Medium)

Create a reference architecture page showing how Bastion + Litebeam work together:

**Bastion + Litebeam Reference Stack:**
```
┌──────────────────────────────────────────────────────────────────┐
│                         Agent Stack                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  LLM     │→ │ Bastion  │→ │ Litebeam │→ │   On-    │        │
│  │ (brain)  │  │ (verify) │  │  (route) │  │  chain   │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│      │              │              │              │              │
│   generates     simulates      finds best     settles           │
│   actions       txs before     vendor for     USDC on           │
│                 signing        API calls      Base              │
└──────────────────────────────────────────────────────────────────┘
```

#### R6: Consider Policy Template Marketplace (Future)

Litebeam has a service directory. Bastion could have a **policy template marketplace** — community-contributed `config.toml` snippets for common agent use cases (DeFi trading bots, NFT minters, DAO treasuries, etc.). This creates network effects without competing on routing.

---

## 7. Improvement Plan (Prioritized)

### Priority Matrix

| # | Feature | Effort | Impact | Closes Gap | Category |
|---|---|---|---|---|---|
| P1 | Budget control UI in dashboard | Med | High | G1 | Dashboard |
| P2 | MCP-first docs rewrite | Low | High | G2 | Docs/Marketing |
| P3 | x402 surfacing | Low | Medium | G3 | Docs/Feature |
| P4 | Cost transparency in simulate response | Low | Medium | G4 | Sidecar |
| P5 | HITL approval UI in dashboard | Med | High | G6 | Dashboard |
| P6 | Litebeam firewall adapter | Med | High | N/A (new) | Integration |
| P7 | Integration marketplace | Med | Medium | G5 | Dashboard |
| P8 | Reference architecture docs | Low | Medium | N/A (new) | Docs |
| P9 | No-account quickstart demo | High | Medium | G7 | Infra |
| P10 | Service health monitoring | High | Low-Med | G8 | Sidecar |

### Detailed Implementation Specs

#### P1: Budget Control UI

**Files to touch:**
- `apps/web/src/pages/Dashboard.tsx` — add budget overview panel
- `apps/web/src/components/BudgetPanel.tsx` — new component
- `crates/sidecar/src/lib.rs` — add `GET /budget` endpoint returning per-agent limits + current usage
- `config.toml` — add `[budget]` section

**Budget Panel UI:**
```
┌─────────────────────────────────────────────┐
│  💰 Budget Overview                         │
│  ┌─────────────────────────────────────┐    │
│  │ Daily Spend: ○─────── 1.2/5.0 SOL  │    │
│  │ Per-Call Limit: 1.0 SOL             │    │
│  │ Approval Threshold: 0.5 SOL         │    │
│  │ Low Balance Alert: 0.3 SOL ✓        │    │
│  └─────────────────────────────────────┘    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ Agent A   │ │ Agent B   │ │ Agent C   │    │
│  │ 0.3/2.0  │ │ 0.9/5.0  │ │ 0.0/1.0  │    │
│  └──────────┘ └──────────┘ └──────────┘    │
└─────────────────────────────────────────────┘
```

#### P2: MCP-First Docs Rewrite

**Files to touch:**
- `README.md` — move MCP config to "Quick Start" section (section 1 after overview)
- `apps/web/src/pages/Integrate.tsx` — restructure to MCP-first (move HTTP API to "advanced" section)
- `docs/MCP_INTEGRATION.md` — new dedicated MCP guide

**Before (current):**
```
Quick Start → pnpm + cargo + env vars + docker
```

**After:**
```
Quick Start (3 lines):
  { "mcpServers": { "bastion": { "url": "...", ... } } }

Advanced (self-hosted):
  pnpm + cargo + env vars + docker
```

#### P3: x402 Surfacing

**Files to touch:**
- `packages/mcp-server/README.md` — document x402 tool
- `apps/web/src/pages/Integrate.tsx` — add "Pay-per-call firewall" block
- `apps/web/src/pages/Landing.tsx` — add x402 to feature list
- `README.md` — add x402 to feature table

#### P4: Cost Transparency

**Files to touch:**
- `crates/sidecar/src/lib.rs` — add `estimated_sol_fee`, `simulation_cost`, `program_cu_estimate` to simulate response
- `crates/sidecar/src/audit.rs` — add cost fields to `AuditEntry`
- `packages/sdk/src/types.ts` — add cost fields to `SimulateResponse`

**Response shape:**
```json
{
  "decision": "Pass",
  "cost_breakdown": {
    "estimated_tx_size_bytes": 230,
    "estimated_base_fee_lamports": 5000,
    "estimated_priority_fee_lamports": 10000,
    "simulation_cost_cu": 42000,
    "bastion_overhead_ms": 12
  }
}
```

#### P5: HITL Approval UI

**Per existing IMPROVEMENTS.md spec (Feature 2).** Files:
- `apps/web/src/components/PendingApprovals.tsx` — new component
- `apps/web/src/pages/Dashboard.tsx` — mount PendingApprovals
- `crates/sidecar/src/lib.rs` — add `GET /pending` endpoint

#### P6: Litebeam Firewall Adapter

**New files:**
- `crates/sidecar/src/litebeam_adapter.rs` — wrap Litebeam MCP calls with Bastion Web2 firewall inspection
- `docs/LITEBEAM_INTEGRATION.md` — setup guide

**How it works:**
1. Agent connects to both Bastion and Litebeam MCP servers
2. Agent calls `bastion.inspect_api_call()` before `litebeam.call_service()`
3. Bastion checks: content (prompt injection), budget limits, destination domain allowlist
4. Returns pass/block with reason
5. If pass, agent proceeds to Litebeam for routing + payment

**Alternatively** — Bastion could provide an MCP tool that wraps Litebeam:
```typescript
// Single Bastion MCP tool that internally calls Litebeam:
await mcp.callTool("bastion-safe-call", {
  capability: "generate_image",
  prompt: "mountain at dusk",
  max_spend_usdc: 0.05
});
// Bastion inspects content → forwards to Litebeam → returns result + cost breakdown
```

#### P7: Integration Marketplace

**Files to touch:**
- `apps/web/src/pages/Integrate.tsx` — add "Partners & Adapters" section
- `apps/web/src/components/IntegrationCards.tsx` — new component

**Listing:**
```
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Litebeam        │ │ Helius          │ │ GrondOSINT      │
│ Routing adapter │ │ Sim provider    │ │ Risk oracle     │
│ [Configure]     │ │ [Built-in]      │ │ [Built-in]      │
└─────────────────┘ └─────────────────┘ └─────────────────┘
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ x402            │ │ Midnight ZK     │ │ Celo EVM        │
│ Payment network │ │ Privacy         │ │ ERC-7579        │
│ [MCP tool]      │ │ [Coming soon]   │ │ [Deployed]      │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

#### P8: Reference Architecture Docs

**New file:** `docs/REFERENCE_ARCHITECTURE.md`

Content:
- Bastion + Litebeam stack diagram
- Bastion + Helius + Solana stack
- Bastion + Celo + EVM stack
- Multi-agent fleet with Bastion
- Agent CI/CD pipeline with Bastion simulation gate

#### P9: No-Account Quickstart (Future)

**Concept:** A hosted demo mode where anyone can test Bastion's security without installing anything. Provide a public MCP endpoint that routes to a sandboxed devnet sidecar.

**Requires:** Separate demo deployment, rate limiting, agent isolation. Not blocking, low priority.

#### P10: Service Health Monitoring (Future)

**Concept:** Track which external services agents interact with (program IDs on Solana, contract addresses on EVM, API endpoints via Web2 firewall), accumulate response times and success rates, and alert when a service degrades. This is the inverse of Litebeam's vendor reputation — it's about the service's reliability from the agent's side.

---

## 8. 3-Day Sprint Plan

### Day 1 — MCP-First + Budget UX

| Task | Effort | Deliverable |
|---|---|---|
| Rewrite Integrate.tsx to MCP-first layout | 2h | Load /integrate → see MCP config block first |
| Add MCP integration to README quick start | 1h | README leads with 3-line MCP config |
| Wire /dashboard route in App.tsx | 15m | `/dashboard` goes to Dashboard.tsx (not blank) |
| Add `GET /budget` endpoint to sidecar | 2h | `GET /budget?agent=did:...` returns limits + usage |
| Build `BudgetPanel.tsx` component | 3h | Gauges, limit editors, per-agent breakdown |

**Day 1 close:** MCP-first docs live. Budget panel in dashboard. Dashboard route wired.

### Day 2 — x402 + Cost Transparency + HITL

| Task | Effort | Deliverable |
|---|---|---|
| Document x402 tool in MCP docs | 1h | `docs/x402.md` + MCP server README update |
| Add x402 feature block to landing page | 1h | "Pay-per-call firewall" card on Landing.tsx |
| Add cost fields to `AuditEntry` + simulate response | 2h | `cost_breakdown` in `/simulate` response |
| Build `PendingApprovals.tsx` component | 3h | Real-time approval queue in dashboard |
| Mount `PendingApprovals` in Dashboard.tsx | 1h | Dashboard shows pending HITL items |

**Day 2 close:** x402 marketed. Cost breakdown in API. HITL working end-to-end.

### Day 3 — Litebeam Adapter + Marketplace + Docs

| Task | Effort | Deliverable |
|---|---|---|
| Write `docs/LITEBEAM_COMPETITIVE_ANALYSIS.md` | — | ✅ This document |
| Write Litebeam integration guide | 2h | `docs/LITEBEAM_INTEGRATION.md` |
| Build `IntegrationCards.tsx` marketplace component | 3h | Partner listing on /integrate |
| Write `docs/REFERENCE_ARCHITECTURE.md` | 2h | Three reference architectures (Bastion+Litebeam, Bastion+Solana, Bastion+EVM) |
| Update README with Litebeam positioning | 1h | "Complementary" messaging in README |

**Day 3 close:** Integration marketplace live. Reference architecture published. Full competitive analysis committed.

---

## 9. What NOT to Do

| Don't Do | Why |
|---|---|
| Build a service directory | Litebeam already indexes 6,000+. Competing here is expensive and off-strategy. |
| Build a payment layer | Bastion's value is security, not routing. Don't split focus. |
| Add USDC settlement on Base | Litebeam's lane. Bastion doesn't need its own wallet. |
| Try to match "6,000+ services" breadth | Focus on being the best at 1 thing (security), not mediocre at both. |
| Copy Litebeam's "auction" model | Bastion is a firewall, not a marketplace. Policy evaluation, not price comparison. |
| Build agent-facing API key management | Litebeam's problem to solve. Bastion secures, doesn't provision. |
| Remove the sidecar HTTP API in favor of MCP-only | Some use cases (headless deploy, K8s, non-MCP clients) need the REST API. Keep both. |
| Chase Litebeam's 0.5% fee model | Bastion is open-source middleware. Monetize via service/hosting, not per-call fees. |

---

## 10. Reference Architecture — Bastion + Litebeam

```
                              ┌──────────────────┐
                              │   Human Operator  │
                              │  (policy + HITL)  │
                              └────────┬─────────┘
                                       │ config.toml + dashboard
                                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Agent Runtime                               │
│  ┌───────────┐     ┌─────────────┐     ┌──────────────┐            │
│  │   LLM     │────→│   Bastion    │────→│   Litebeam   │            │
│  │  (brain)  │     │  (verify)   │     │   (route)    │            │
│  └───────────┘     └──────┬──────┘     └──────┬───────┘            │
│                           │                    │                    │
│              ┌────────────┼────────────────────┼──────────┐        │
│              ▼            ▼                    ▼          ▼        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────┐  │
│  │ On-Chain Tx  │ │ Web2 API     │ │ Microservice  │ │ Payment  │  │
│  │ (Solana/EVM) │ │ Calls (HTTP) │ │ Calls (MCP)   │ │ (x402)   │  │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────┘  │
│        │                │                  │               │       │
└────────┼────────────────┼──────────────────┼───────────────┼───────┘
         ▼                ▼                  ▼               ▼
┌──────────────────────────────────────────────────────────────────┐
│                        Settlement Layer                           │
│  ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌──────────┐           │
│  │ Solana  │  │   EVM   │  │   Base   │  │ Midnight │           │
│  │ (audit) │  │ (audit) │  │ (USDC)   │  │   (ZK)   │           │
│  └─────────┘  └─────────┘  └──────────┘  └──────────┘           │
│        │             │            │              │                │
│        ▼             ▼            ▼              ▼                │
│  ┌─────────────────────────────────────────────────────┐         │
│  │                 Immutable Audit Trail               │         │
│  │  Anchor PDA (Solana) + EIP-712 (EVM) + USDC tx     │         │
│  └─────────────────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────────────────┘
```

**Bastion secures:**
- On-chain transactions (Solana program calls, EVM UserOperations)
- Web2 API calls (HTTP proxy firewall)
- Litebeam-routed calls (adapter, inspect before route)

**Litebeam routes:**
- AI microservice calls (image gen, translation, search)
- Protocol + vendor selection (x402, MPP)
- Payment settlement (USDC on Base)

---

## 11. Appendices

### A. Litebeam Source Summary

| Source | URL | Content |
|---|---|---|
| Website | https://litebeam.xyz | Landing page, service directory, login/register |
| Docs | https://litebeam.xyz/docs | Getting started, MCP integration, payment modes, API reference, registry, FAQ |
| GitHub | https://github.com/litebeam-protocol/protocol | Protocol spec, MCP integration, x402 client, registry spec (6 commits, 0 stars) |
| Service sources | agentic.market (x402), mpp.dev (MPP) | Public directories Litebeam crawls |

### B. Litebeam Service Categories

| Category | Example Capabilities |
|---|---|
| image | generate_image, image_edit, image_to_text |
| text | translate, summarize, sentiment, generate |
| audio | text_to_speech, speech_to_text, audio_transcribe |
| search | web_search, news, image_search |
| finance | stock_price, crypto_price, exchange_rate |
| data | csv_analysis, json_generator, scrape |
| compute | run_python, run_sql, math_solver |
| travel | flight_price, hotel_search, weather |
| code | generate_code, review_code, explain_code |

### C. Bastion MCP Tools (Current)

| # | Tool | Purpose |
|---|---|---|
| 1 | `simulate_transaction` | Run Helius/EVM simulation before signing |
| 2 | `get_audit_logs` | Query audit trail |
| 3 | `get_policy` | Read current policy config |
| 4 | `update_policy` | Modify policy rules |
| 5 | `override_decision` | HITL approve/reject |
| 6 | `list_agents` | List registered agents |
| 7 | `register_agent` | Register new agent (DID) |
| 8 | `get_agent` | Get agent details |
| 9 | `update_agent_reputation` | Manual reputation adjustment |
| 10 | `get_circuit_breaker` | Read pause state |
| 11 | `toggle_circuit_breaker` | Emergency pause/resume |
| 12 | `health_check` | Check sidecar health |
| 13 | `get_stats` | Dashboard statistics |
| 14 | `simulate_evm` | EVM (Celo) transaction simulation |
| 15 | `inspect_api_call` | Web2 firewall content inspection |
| — | `*_prompt` (3) | security-analysis, policy-generation, agent-diagnostic |

### D. Key Differences Summary Table

| Aspect | Bastion | Litebeam |
|---|---|---|
| **Category** | Security middleware | Routing + payment |
| **Primary user** | AI agent operators (security) | AI agent developers (connectivity) |
| **Integration model** | HTTP REST API + MCP + on-chain program | MCP server (primary) + REST API |
| **Simulation** | Yes (Helius + EVM) | No |
| **Policy engine** | Yes (chain-agnostic) | No (only budget limits) |
| **Payment** | x402 (MCP tool, undocumented) | Primary feature (USDC, 0.5% fee) |
| **Chains** | Solana, Celo, Base, Polygon, ETH, Midnight | Base, Tempo |
| **Open source** | Full monorepo | Partial (protocol layer only) |
| **Audit trail** | On-chain (Anchor + EIP-712) + Sled | Payment tx history |
| **Agent identity** | W3C DID + ERC-8004 + delegation | None |
| **Circuit breaker** | Yes | No |
| **Service directory** | None | 6,000+ (empty at fetch) |
| **Market status** | Alpha (devnet) | Pre-alpha (no releases) |
