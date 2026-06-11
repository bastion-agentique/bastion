# Bastion Web2 AI Firewall — Expansion Plan

> **Extend Bastion from blockchain transaction firewall to universal AI agent API gateway.**
>
> Same brand. Same trust-but-verify philosophy. Same agent registry, policy engine, audit trail, GrondOSINT, and HITL flow — applied to HTTP API calls instead of blockchain transactions.
>
> **Repo:** `bastion` (this repo)

---

## 0. Repo Positioning

**`bastion` = Agent Firewall** (this repo). Solana-native + EVM multichain AI transaction firewall + Web2 API gateway firewall + agent-to-agent security + public SDKs, docs, OSS community.

**`bastion-enterprise`** = Privacy-preserving SIEM for agents. Midnight ZK, closed enterprise connectors, compliance analytics, regulated deployment.

**Positioning rule:** If it's about **blocking, inspecting, or governing agent actions** → `bastion`. If it's about **observability, privacy-preserving logging, compliance analytics, or enterprise SIEM** → `bastion-enterprise`.

Web2 API gateway firewall blocks/inspects agent API calls → belongs in `bastion`. `bastion-enterprise` stays focused on the Midnight privacy SIEM product.

---

## 1. Executive Summary

Bastion today protects Solana AI agents from malicious/unauthorized blockchain transactions. This expansion builds a **Web2 API Gateway Firewall** protecting AI agents calling external REST, gRPC, and GraphQL APIs (OpenAI, Stripe, Slack, GitHub, AWS, etc.).

**Core insight:** An AI agent is equally dangerous calling an unauthorized API endpoint as signing a bad blockchain transaction. The same infrastructure — policy engine, simulation, audit trail, HITL override, agent identity, circuit breaker — applies to both domains.

**Reused infrastructure:**
- Policy engine & decision model (`crates/core`)
- Sidecar HTTP server (Axum, `crates/sidecar`)
- Agent registry & W3C DID system
- GrondOSINT risk oracle (now also scores API endpoints / domains)
- Sled DB audit logging + on-chain Anchor audit
- HITL / human override dashboard
- Circuit breaker pattern
- MCP server (for agent integration)
- React dashboard
- Skills ecosystem (Web2 security skills added)
- CI/CD, Docker, deployment

**New code:**
- HTTP forward proxy with interception
- API schema inspection (OpenAPI parsing)
- TLS termination / certificate handling
- Request/response content inspection
- API key management for outbound service accounts
- Provider-specific adapters (OpenAI, Stripe, Slack, GitHub, AWS)
- Webhook receiver security
- Per-provider rate limiting and budget management

---

## 2. Repository Structure

```
bastion/
├── crates/
│   ├── core/                        ← SHARED: chain-agnostic policy engine
│   │   └── src/
│   │       └── api_event.rs         ← NEW: ApiEvent type (HTTP method, URL, headers, body, provider)
│   ├── sidecar/                     ← SHARED: Axum HTTP server (new routes)
│   ├── web2-firewall/               ← NEW: Web2 proxy core crate
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs               ← ProxyEngine, ApiPolicyEvaluator
│   │       ├── proxy.rs             ← HTTP forward proxy (hyper reverse proxy)
│   │       ├── openapi.rs           ← OpenAPI schema parser + endpoint validation
│   │       ├── providers/           ← Provider adapters
│   │       │   ├── mod.rs
│   │       │   ├── openai.rs        ← OpenAI-specific schema + rate limits
│   │       │   ├── stripe.rs
│   │       │   ├── slack.rs
│   │       │   ├── github.rs
│   │       │   └── generic.rs       ← Generic REST API (OpenAPI-based)
│   │       ├── inspector.rs         ← Req/res content inspection (PII, prompt injection)
│   │       ├── tls.rs               ← TLS termination + mTLS
│   │       └── webhook.rs           ← Inbound webhook security
│   ├── solana/                      ← UNCHANGED: Anchor program
│   └── midnight/                    ← UNCHANGED: must stay for prover infra
├── packages/
│   ├── sdk/                         ← UPDATED: @bastion-agentique/sdk (new Web2 methods)
│   └── web2-sdk/                    ← NEW: @bastion-agentique/web2-sdk
├── apps/
│   └── web/                         ← UPDATED: Dashboard (new Web2 panels)
│       └── src/
│           ├── pages/
│           │   ├── Landing.tsx       ← UPDATED: Web2 firewall mention
│           │   ├── Dashboard.tsx     ← UPDATED: Web2 audit log tab
│           │   └── integrate/
│           │       └── Integrate.tsx ← UPDATED: Web2 integration guide
│           └── hooks/
│               ├── useBastionProgram.ts   ← UNCHANGED
│               └── useWeb2Proxy.ts        ← NEW
├── agents/                          ← NEW: Web2 agent skills
└── docs/
    ├── PRD_SIEM_EXPANSION.md        ← bastion-enterprise scope reference
    └── WEB2_EXPANSION_PLAN.md       ← THIS FILE
```

---

## 3. Architecture

```
Agent Process                     Bastion Sidecar                     Target API
┌──────────────┐     HTTP CONNECT    ┌────────────────────┐     ┌──────────────┐
│  AI Agent     │ ──────────────────► │  Web2 Proxy Engine │────►│  OpenAI      │
│ (LangChain,   │    (forward proxy) │                    │     │  Stripe      │
│  CrewAI, etc) │                    │  1. Inspect req    │     │  Slack       │
│              │ ◄────────────────── │  2. Policy check   │◄────│  GitHub      │
│              │    proxied response │  3. Audit log      │     │  AWS         │
│              │                    │  4. Forward/Block   │     └──────────────┘
└──────────────┘                    └────────┬───────────┘
                                            │
                                    ┌───────▼────────┐
                                    │  Policy Engine   │
                                    │  (crates/core)   │
                                    │                  │
                                    │  + GrondOSINT    │
                                    │  + Rate Limiter  │
                                    │  + Budget Mgr    │
                                    └─────────────────┘
```

### Integration Modes

| Mode | How it works | Best for |
|------|-------------|----------|
| **Proxy** | Agent routes HTTP calls through Bastion proxy (localhost:4000) | Single-agent, dev |
| **SDK Middleware** | Agent uses `BastionWeb2Client` wrapper around fetch/axios | TS/JS agents (LangChain, Vercel AI SDK) |
| **Transparent** | eBPF/iptables intercept on agent host | Production, containers |
| **Ingest** | Agent sends raw API call logs after the fact | Monitoring mode, gradual rollout |

---

## 4. Policy Rules (Web2 Domain)

Reusing the `PolicyRule` trait from `crates/core`. New rule types:

| Rule | What it checks | Example |
|------|---------------|---------|
| `EndpointAllowlist` | Only allow specific URL paths + methods | `POST api.openai.com/v1/chat/completions` only |
| `EndpointBlocklist` | Block specific URL patterns | Block `v1/fine-tunes`, block `v1/billing` |
| `ProviderBudget` | Spend cap per provider per time window | `$50/day on OpenAI` |
| `RequestSizeLimit` | Max request body size per endpoint | `1MB on /chat/completions` |
| `ResponseSizeLimit` | Max response body size | `10MB on any` |
| `ContentInspection` | Scan for PII, secrets, prompt injection | Block requests containing `sk-*` keys |
| `HeaderFilter` | Allow/block specific HTTP headers | Strip `Authorization` on log |
| `ApiKeyPolicy` | Which agent can use which API keys | `agent-alpha → sk-proj-xxx` only |
| `RateLimitPerProvider` | Requests/min per provider endpoint | `100 RPM on GitHub API` |
| `TimeOfDayRestriction` | Only allow API calls during business hours | Only 8am-8pm UTC |
| `GeoRestriction` | Block requests to certain regions | Block non-US OpenAI endpoints |
| `WebhookVerification` | Verify inbound webhook signatures | Stripe webhook signature verification |
| `CostCap` | Cumulative cost cap from bills | `$1000/month total API spend` |

### Decision Model (reuses existing)

```
ALLOW           → Proxy the request, log, done
BLOCK           → Return 403, log, trigger HITL if policy says so
PENDING_HITL    → Block until human reviews & approves
SIMULATE_FIRST  → Forward a copy, compare result, then decide
LOG_ONLY        → Pass through, log for audit
```

---

## 5. Phased Rollout

### Phase 1: Core Proxy + OpenAI (Weeks 1-4)

- HTTP forward proxy in `crates/web2-firewall`
- OpenAI adapter (endpoint schema, rate limits, cost tracking)
- `EndpointAllowlist` + `ProviderBudget` rules
- SDK middleware for TypeScript agents
- Audit logging to Sled DB
- Dashboard panel: Web2 audit log view
- **Target:** Agent proxies OpenAI through Bastion, enforce budget, log all requests

### Phase 2: Provider Expansion (Weeks 5-8)

- Stripe, Slack, GitHub, AWS adapters
- Generic OpenAPI-based adapter (auto-parse any OpenAPI spec)
- Content inspection (PII scanning, prompt injection detection)
- Request/response inspection dashboard
- Webhook receiver security
- **Target:** Major SaaS APIs covered, auto-detect schema

### Phase 3: Enterprise Controls (Weeks 9-12)

- API key management vault (encrypted key store)
- Team/org agent management (multi-agent, shared budgets)
- RBAC on the dashboard
- SOC 2 evidence export (audit log CSV/JSON export)
- SAML/SSO integration
- **Target:** Enterprise-ready with compliance evidence

### Phase 4: Advanced (Weeks 13-16)

- Transparent proxy (eBPF for containers)
- gRPC interception (protobuf parsing)
- Real-time anomaly detection on API traffic
- Auto-remediation rules (block + alert without HITL)
- On-chain audit for Web2 events (optional, enterprise-tier)
- **Target:** Full coverage, production-hardened

---

## 6. Pricing Model (Dual-Track)

| Tier | Price | Web2 Features | Crypto Features |
|------|-------|---------------|-----------------|
| **Free** | $0 | 1 agent, 1K API calls/mo, 2 providers | Same as current free tier |
| **Pro** | $49/mo | 5 agents, 50K API calls, all providers, 1mo log retention | +500 tx simulations/mo |
| **Team** | $199/mo | 25 agents, 500K calls, team dashboard, SAML | +5K tx simulations/mo |
| **Enterprise** | Custom | Unlimited agents, custom retention, dedicated proxy, on-prem | + on-chain audit, SLA |

**Self-hosted:** Flat annual fee ($5K-$50K). All features, source access, priority support.

**x402/crypto rail:** Optional for Pro tier. Pay with SOL at 2x fiat rate. Free tier remains free.

---

## 7. Go-to-Market Strategy

### Phase 1: Cross-sell to existing Bastion users (crypto-first)

- Current Bastion users run AI agents for trading, DeFi ops, NFT management
- Many also call OpenAI, Twitter/X API, CoinGecko, Dune API
- **Narrative:** "You already trust Bastion for on-chain. Now trust it for every API call."
- Upgrade path: existing users get 30-day Pro trial

### Phase 2: Broader AI agent ecosystem (SaaS)

- LangChain / LangGraph plugin: drop-in `BastionWeb2Tracer` callback
- Vercel AI SDK middleware: wrap `generateText` / `streamText`
- CrewAI tool interceptor
- OpenAI Agents SDK interceptor
- **Narrative:** "Ship agents faster. We'll catch the mistakes."

### Phase 3: Enterprise security procurement

- SOC 2 Type II report (in progress)
- SAML/SSO, RBAC, audit export
- On-prem deployment option
- **Narrative:** "Your board wants AI governance. Here's the evidence."

---

## 8. Agent Skills (Web2 Security)

| Skill | Description |
|-------|-------------|
| `web2-api-firewall-administrator` | Guide for configuring Web2 proxy policies |
| `api-risk-scoring` | Score API endpoints for risk (data exfiltration, cost, abuse) |
| `provider-compliance-checker` | Verify API usage against provider ToS |
| `web2-incident-responder` | Investigate Web2 API security incidents |
| `api-budget-optimizer` | Analyze API spend and recommend cost controls |
| `prompt-injection-investigator` | Analyze blocked prompts for injection patterns |

---

## 9. Key Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| TLS MITM resistance from API providers | High | High | SDK mode avoids TLS issues. Transparent mode as alternative. Document clearly. |
| Latency overhead on API calls | Medium | Medium | SDK middleware in-process. Proxy mode <5ms. eBPF <1ms. |
| Scope creep — too many providers | High | Medium | Generic OpenAPI adapter covers 80%. Specific adapters only for top 5. |
| Competition from existing API gateways (Kong, Envoy) | Medium | Medium | Differentiate on agent-native: reputation-based policy, GrondOSINT, on-chain audit, agent DID. |
| Enterprise self-hosted eats dev resources | Medium | Medium | Docker compose for small. Reference k8s helm chart. No custom infra. |

---

## 10. What Ships When

| Milestone | Date | Deliverables |
|-----------|------|-------------|
| **Phase 1 Complete** | Week 4 | HTTP proxy, OpenAI adapter, SDK middleware, Sled audit, dashboard panel. `npm publish @bastion-agentique/web2-sdk@0.1.0` |
| **Phase 2 Complete** | Week 8 | 5 provider adapters, generic OpenAPI parser, content inspection, webhook security |
| **Phase 3 Complete** | Week 12 | API key vault, RBAC, SAML/SSO, SOC 2 evidence export, Team tier |
| **Phase 4 Complete** | Week 16 | eBPF transparent proxy, gRPC, anomaly detection, on-chain audit integration |
| **Public Launch** | Week 12 (soft) / Week 16 (GA) | Production-ready, enterprise sales |

---

## 11. What Stays in bastion-enterprise

For clarity, these features **do not** belong in `bastion` — they live in `bastion-enterprise`:

| Feature | Why enterprise-only |
|---------|-------------------|
| Midnight ZK privacy-preserving SIEM | Privacy story, regulated enterprise buyer |
| Closed-source enterprise connectors | Proprietary integration contracts |
| Compliance analytics & reporting dashboards | Enterprise SIEM scope |
| BSSN/OJK regulatory reporting modules | Indonesian reg-tech, commercial |
| Case management with on-chain case closure | SIEM workflow, enterprise |
| SLA-backed audit evidence chain | Paid enterprise support |

**Rule of thumb:** If it helps an agent developer **block or inspect** → `bastion`. If it helps a compliance officer **audit or report** → `bastion-enterprise`.

---

## 12. Appendix: Current Assets Leveraged

| Asset | How it maps to Web2 |
|-------|-------------------|
| `crates/core` PolicyRule trait | Same trait, new rule types (ApiEndpointRule, ProviderBudgetRule, etc.) |
| `crates/core` FirewallDecision enum | Reused as-is (Allow/Block/PendingHITL) |
| `crates/sidecar` Axum server | New routes: `POST /proxy/*`, `POST /ingest-api-event` |
| `crates/sidecar` audit.rs (Sled DB) | Web2 audit logs in same DB, prefixed by source |
| `crates/sidecar` simulation.rs (Helius) | Replaced by proxy dry-run mode |
| `apps/web` dashboard | New tab: "API Logs", "Providers", "Web2 Policies" |
| `packages/sdk` BastionClient | New client: `BastionWeb2Client` (same patterns) |
| Agent registry / DID | Web2 agents register via same flow |
| GrondOSINT | Expanded to score API endpoints, domains, provider reputations |
| HITL override flow | Same `POST /override` — works for Web2 blocks too |
| Circuit breaker | Same `POST /circuit-breaker/engage` — pauses ALL traffic |
| 47 agent skills | +6 new Web2 security skills (see §8) |
| MCP server | New tools: `proxy_configure`, `proxy_audit_logs`, `proxy_override` |
| x402 payments | Optional billing rail for Pro tier |
| Docker / Fly.io / Netlify | Same deployment pipeline |

---

> **Rebrand positioning:** "Bastion — The Firewall for Everything Your Agent Does."
>
> Tagline evolution: *"Trust your Agent, but Verify every Transaction"* → *"Trust your Agent, but Verify every Call."*
