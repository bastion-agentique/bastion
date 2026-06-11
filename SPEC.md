# Bastion: AI Agent Firewall

**Tagline:** "Trust your Agent, but Verify every Transaction."
**Web2 tagline:** "Trust your Agent, but Verify every Call."

> Alpha software. Bastion is in active development and not yet production hardened. Use with caution.

## The Problem
AI Agents are non-deterministic. They hallucinate. Prompt injection attacks can force them to sign malicious transactions or send sensitive data to unauthorized APIs.
Currently, agents sign whatever the LLM outputs and call whatever APIs the LLM suggests. This is a massive security risk.

## The Solution
**Bastion** is a Rust-based middleware firewall that sits between the Agent's "Brain" (LLM) and both the "Wallet" (Signing) and the "Internet" (API calls).
It intercepts every transaction request and every HTTP API call, **Simulates** them, and checks against a strict **Policy Engine**.

## Current Capabilities

### Blockchain Firewall (Production)
- Transaction simulation via Helius on Solana
- EVM transaction simulation via Celo eth_call
- Program allowlists (whitelist mode)
- Native token caps per transaction and per 24h window
- Per-minute rate limits
- Daemon BlockInt security checks (flash loan detection, high slippage, mint/freeze authority changes, risk-labeled addresses)
- On-chain audit via Anchor PDA (immutable records on Solana)
- Agent identity registry with W3C DID compliance
- Agent delegation (hierarchical sub-agents, budget limits, capability inheritance)
- Circuit breaker with fleet-wide transaction pausing
- Human-in-the-loop override for blocked transactions
- SOL staking for higher transaction limits
- MCP HTTP server (15 tools, 3 prompts, SSE transport)
- x402 pay-per-call pricing with Solana SOL transfers
- pay.sh provider gateway
- CORS support for browser-native access
- Robot/physical agent telemetry ingestion

### Web2 API Firewall (In Progress)
- HTTP forward proxy for AI agent API calls
- Endpoint allowlist/blocklist rules
- Provider budget enforcement (spend caps per time window)
- Content inspection (PII, secrets, prompt injection detection)
- Header filtering
- Rate limiting per provider
- OpenAPI spec auto-configuration (parses OpenAPI 3.0 specs into allowlists)
- Provider adapters (OpenAI, Stripe, Slack, GitHub, AWS)
- TypeScript SDK (@bastion-agentique/web2-sdk v0.1.0)
- Rust policy engine (bastion-web2-firewall crate)

### SIEM & Correlation (Planned)
- Universal event ingestion (CloudTrail, syslog, webhooks)
- Cross-event correlation engine (YAML rules, sliding windows)
- Case management dashboard
- On-chain case closure via Anchor
- MITRE ATT&CK Web3/ICS mapping
- GrondOSINT threat enrichment pipeline

## Core Architecture

1.  **Policy Engine (The Rulebook)**
    *   Written in TOML/JSON (Human readable).
    *   Rules: `MaxSpendPerTx`, `AllowedPrograms`, `WhitelistAddresses`, `RateLimit`.
    *   On-chain policy PDA for immutable rules.

2.  **The Interceptor (Rust Proxy)**
    *   A local server (bastion-agentique.fly.dev/) that looks like a standard Solana RPC.
    *   The Agent sends transactions here instead of mainnet.

3.  **Simulation Core (The Truth)**
    *   Decodes the instruction data.
    *   Simulates the state change (Balance change? Token delegation?).
    *   Checks for "Drain" patterns (e.g., `SetAuthority` to unknown address).

4.  **On-Chain Audit (Anchor Program)**
    *   Immutable audit trail on Solana
    *   Verifiable decision records
    *   Agent reputation tracking

5.  **The Gatekeeper**
    *   If PASS: Signs and forwards to Jito/RPC.
    *   If FAIL: Returns error to Agent ("Blocked by Bastion: Policy Violation").

## Tech Stack
- **Language:** Rust (for speed & safety).
- **Framework:** Axum (Web server) + Solana SDK.
- **Simulation:** Helius API or Local Bankrun.
- **Database:** Sled (embedded Rust DB) for local audit logs.
- **On-Chain:** Anchor (Solana programs).

## Roadmap

### Phase 1: Core Interceptor (Day 1-2)
- [x] Rust Proxy & Policy Parser (from Sentinel)
- [x] Transaction validation
- [ ] Policy API improvements

### Phase 2: On-Chain Audit (Day 3-4)
- [ ] Anchor program structure
- [ ] PDA-based audit storage
- [ ] CPI from interceptor to program

### Phase 3: Agent Registry (Day 5-6)
- [ ] On-chain agent registration
- [ ] Capability bitmasks
- [ ] Reputation tracking

### Phase 4: Dashboard (Day 7-8)
- [ ] Real-time policy editor
- [ ] Transaction feed + alerts
- [ ] Agent status overview

### Phase 5: Advanced Security (Day 9-10)
- [ ] Prompt injection detection
- [ ] Rate limiting per agent
- [ ] Anomaly detection hooks
- [ ] Emergency circuit breaker

## Why This Wins
It's a "Pick and Shovel" play. Every autonomous agent needs security.
This is infrastructure that every AI agent builder will need.