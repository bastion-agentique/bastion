---
name: web2-api-firewall-administrator
description: Guides configuring Bastion Web2 API firewall proxy policies. Covers endpoint allowlists, provider budgets, rate limits, content inspection (PII/secrets detection), header filters, and OpenAPI spec-based auto-configuration. Use when configuring API call security for AI agents, setting provider spending caps, inspecting outbound API traffic, or setting up the Web2 proxy.
---

# Bastion Web2 API Firewall — Administrator Guide

This skill covers configuring the Bastion Web2 API gateway firewall for AI agents calling external REST/gRPC/GraphQL APIs (OpenAI, Stripe, Slack, GitHub, AWS, etc.).

## Architecture

```
Agent → Bastion Proxy (crates/web2-firewall) → Target API
         └─ Policy Engine (crates/core)
         └─ GrondOSINT threat scoring
         └─ Audit logging (Sled DB)
```

## Integration Modes

| Mode | How | Best for |
|------|-----|----------|
| **Proxy** | Agent HTTP calls through `localhost:4000` | Single-agent, dev |
| **SDK** | `BastionWeb2Client` wrapper (TypeScript) | LangChain, Vercel AI SDK, CrewAI |
| **Ingest** | Log-only mode, send events after the fact | Monitoring, gradual rollout |

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/proxy` | Proxy an API call through policy evaluation |
| POST | `/api/v2/evaluate` | Evaluate without proxying |
| GET | `/policy` | Current proxy policy |
| POST | `/policy/full` | Update proxy policy |
| GET | `/proxy/logs` | Web2 audit logs |
| GET | `/proxy/stats` | Usage statistics |

## Policy Rules

### EndpointAllowlist
```json
{ "type": "endpoint_allowlist", "paths": ["/v1/chat/completions"], "methods": ["POST"] }
```

### ProviderBudget
```json
{ "type": "provider_budget", "provider": "openai", "maxUsdCentsPerWindow": 5000, "windowMinutes": 1440 }
```

### ContentInspection
```json
{ "type": "content_inspection", "detectPII": true, "detectSecrets": true, "detectPromptInjection": true }
```

## SDK Quick Start

```typescript
import { BastionWeb2Client } from "@bastion-agentique/web2-sdk";

const client = new BastionWeb2Client({
  proxyUrl: "http://localhost:4000",
  apiKey: "your-api-key",
});

const req = client.buildRequest("POST", "https://api.openai.com/v1/chat/completions", {
  "Content-Type": "application/json",
}, JSON.stringify({ model: "gpt-4o", messages: [] }));

const result = await client.evaluate(req);
if (result.decision === "pass") {
  // Proceed with the API call
}
```

## Provider Detection

| URL pattern | Provider |
|-------------|----------|
| `api.openai.com` | `openai` |
| `api.stripe.com` | `stripe` |
| `api.github.com` | `github` |
| `slack.com/api` | `slack` |
| `amazonaws.com` | `aws` |

## Related Skills

- **bastion-how-to-use** — Blockchain transaction firewall (same policy engine)
- **api-risk-scoring** — Score API endpoints for security risk
- **api-budget-optimizer** — Analyze and optimize API spend
