# Bastion — Improvement Roadmap

> Inspired by a competitive analysis with [Bento](https://bentoguard.xyz/) during the Superteam Earn Beta Bounty (June 2026).
> Each feature below is grounded in the existing codebase structure.

---

## 1. Reputation Feedback Loop (Strikes → On-Chain Score)

**Status:** 80% built. `reputation_score` exists on `TrackedAgent` and `Agent` (on-chain). The gap is that no code path writes back to the score when a block or suspicious event happens.

### What's missing

`AgentStore::update_agent()` in `crates/sidecar/src/agents.rs` only takes a manual `reputation_score` argument — nothing calls it automatically after a `Decision::Blocked` audit entry is written.

### Implementation

**Step 1 — Add strike counter to `TrackedAgent`**

In `crates/sidecar/src/agents.rs`, add to `TrackedAgent`:

```rust
pub strike_count: u32,
pub last_strike_at: Option<i64>,
```

**Step 2 — Wire strike accumulation after every block**

In `crates/sidecar/src/lib.rs`, wherever `AuditLogger::log()` is called with `Decision::Blocked`, call a new helper immediately after:

```rust
// After logging a blocked decision:
agent_store.record_strike(&agent_did);
```

Add to `AgentStore`:

```rust
pub fn record_strike(&self, did: &str) -> Result<(), String> {
    let mut agent = self.get_agent(did).ok_or("Agent not found")?;
    agent.strike_count += 1;
    agent.last_strike_at = Some(chrono::Utc::now().timestamp());

    // Decay reputation: each strike reduces score by 5, floor 0
    agent.reputation_score = agent.reputation_score.saturating_sub(5);

    // At 3 strikes: require HITL for all subsequent transactions
    // At 10 strikes: auto-pause agent (set to suspended state)
    self.save_agent(&agent)
}
```

**Step 3 — Sync to on-chain program**

`crates/sidecar/src/program_client.rs` already has `update_agent_reputation()`. Call it after `record_strike()` when `BASTION_ON_CHAIN=true`:

```rust
if env::var("BASTION_ON_CHAIN").is_ok() {
    program_client.update_agent_reputation(agent_did, agent.reputation_score).await?;
}
```

**Step 4 — Expose strike count in API response**

Add `strike_count` to the `/agents/{did}` GET response and to the `FirewallDecision::Block` context so clients see it.

### Config addition (`config.toml`)

```toml
[reputation]
strike_decay_per_block = 5      # points removed per block
strikes_until_hitl = 3          # force HITL after N strikes
strikes_until_suspend = 10      # auto-suspend after N strikes
strike_ttl_hours = 24           # strikes reset after this window
```

---

## 2. HITL Approval Flow in the Dashboard

**Status:** `FirewallDecision::PendingHITL { approval_id, reason }` exists in `crates/core/src/decision/` and `Decision::PendingApproval` in `crates/sidecar/src/audit.rs`. The `POST /override` endpoint exists in the sidecar. Nothing wires these to the React dashboard.

### What's missing

- No UI panel in `apps/web/src/pages/Dashboard.tsx` showing pending approvals
- No polling or websocket subscription to surface pending items in real time
- No approval/rejection button wired to `POST /override`

### Implementation

**Step 1 — Pending queue API**

Add to `crates/sidecar/src/lib.rs`:

```rust
// GET /pending — returns all audit entries with Decision::PendingApproval
async fn list_pending_approvals(State(state): State<AppState>) -> Json<Vec<AuditEntry>> {
    let entries = state.audit_logger.get_logs_filtered(
        None, None, None, 0, 100
    ).unwrap_or_default();

    let pending: Vec<_> = entries.into_iter()
        .filter(|e| matches!(e.decision, Decision::PendingApproval(_)))
        .collect();

    Json(pending)
}
```

**Step 2 — Dashboard panel (`apps/web/src/pages/Dashboard.tsx`)**

Add a new `PendingApprovals` component:

```tsx
// src/components/PendingApprovals.tsx
export function PendingApprovals() {
  const [pending, setPending] = useState<AuditEntry[]>([]);

  useEffect(() => {
    const poll = setInterval(async () => {
      const res = await fetch(`${SIDECAR_URL}/pending`);
      setPending(await res.json());
    }, 3000);
    return () => clearInterval(poll);
  }, []);

  const decide = async (blockId: string, action: "ALLOW" | "DENY") => {
    await fetch(`${SIDECAR_URL}/override`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ block_id: blockId, action }),
    });
    setPending(p => p.filter(e => e.transaction_id !== blockId));
  };

  if (!pending.length) return null;

  return (
    <div className="border border-yellow-500 rounded-lg p-4">
      <h2 className="text-yellow-400 font-bold mb-3">
        ⏳ Pending Approvals ({pending.length})
      </h2>
      {pending.map(entry => (
        <div key={entry.transaction_id} className="flex items-center justify-between py-2 border-b border-gray-700">
          <div>
            <p className="text-sm text-gray-300">{entry.intent ?? entry.reasoning}</p>
            <p className="text-xs text-gray-500">{entry.transaction_id}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => decide(entry.transaction_id!, "ALLOW")}
              className="px-3 py-1 bg-green-600 rounded text-xs">Allow</button>
            <button onClick={() => decide(entry.transaction_id!, "DENY")}
              className="px-3 py-1 bg-red-600 rounded text-xs">Deny</button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Step 3 — Override endpoint must resolve the pending entry**

Ensure `POST /override` in the sidecar updates the stored audit entry from `PendingApproval` → `Allowed` or `Blocked`, and broadcasts the result back to the waiting agent (use a `tokio::sync::oneshot` channel per `approval_id` stored in `AppState`).

---

## 3. Webhook / Push Notifications on Block

**Status:** Not implemented. The sidecar has no outbound HTTP client for push events.

### What's missing

When `Decision::Blocked` is written, operators have no way to know unless they poll the dashboard or `/logs`. For autonomous fleets, this is a critical gap.

### Implementation

**Step 1 — Webhook config**

Add to `config.toml`:

```toml
[webhooks]
on_block = ["https://your-ops-system.example.com/bastion-alerts"]
on_strike_threshold = ["https://your-ops-system.example.com/bastion-alerts"]
secret = "your-hmac-secret"   # used to sign the payload
```

**Step 2 — `WebhookDispatcher` in the sidecar**

New file `crates/sidecar/src/webhook.rs`:

```rust
use reqwest::Client;
use serde_json::json;

pub struct WebhookDispatcher {
    client: Client,
    endpoints: Vec<String>,
    secret: Option<String>,
}

impl WebhookDispatcher {
    pub fn new(endpoints: Vec<String>, secret: Option<String>) -> Self {
        Self { client: Client::new(), endpoints, secret }
    }

    pub async fn fire_block_event(&self, agent_did: &str, reason: &str, tx_id: &str) {
        let payload = json!({
            "event": "block",
            "agent_did": agent_did,
            "reason": reason,
            "transaction_id": tx_id,
            "timestamp": chrono::Utc::now().timestamp(),
        });

        for url in &self.endpoints {
            let mut req = self.client.post(url).json(&payload);
            if let Some(secret) = &self.secret {
                let sig = hmac_sha256(secret, &payload.to_string());
                req = req.header("X-Bastion-Signature", sig);
            }
            let _ = req.send().await; // fire and forget, don't block evaluation path
        }
    }
}
```

**Step 3 — Add dispatcher to `AppState` and call it**

In `crates/sidecar/src/lib.rs`, add `webhook: Arc<WebhookDispatcher>` to `AppState`. After every `Decision::Blocked` audit log:

```rust
// Non-blocking spawn so webhook latency doesn't affect the response
let dispatcher = state.webhook.clone();
tokio::spawn(async move {
    dispatcher.fire_block_event(&agent_did, &reason, &tx_id).await;
});
```

**Step 4 — Webhook payload schema**

```json
{
  "event": "block",
  "agent_did": "did:bastion:solana:...",
  "reason": "AmountLimit: 2.5 SOL exceeds 1 SOL cap",
  "transaction_id": "uuid-here",
  "strike_count": 2,
  "timestamp": 1749500000
}
```

---

## 4. Behavioral Baseline Per Agent

**Status:** Not implemented. The `PolicyEvaluator` in `crates/core/src/policy/evaluator.rs` has a `RateLimitState` with a sliding window for frequency, but it's global (not per-agent) and tracks only count, not behavioral patterns.

### What's needed

Track per-agent transaction patterns over time, then flag when behavior deviates significantly from the agent's own baseline. Example: an agent that always transfers <0.1 SOL suddenly tries 5 SOL → anomaly flag, even if 5 SOL is under the global policy cap.

### Implementation

**Step 1 — Per-agent behavioral profile in `AgentStore`**

Add to `TrackedAgent`:

```rust
pub behavioral_baseline: Option<AgentBaseline>,
```

New struct:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AgentBaseline {
    /// Rolling average transaction value (in lamports) over last 100 tx
    pub avg_tx_value: u64,
    /// Rolling stddev of transaction value
    pub stddev_tx_value: u64,
    /// Typical programs this agent calls (program_id → call count)
    pub program_frequency: HashMap<String, u32>,
    /// Typical transaction rate (tx per hour, rolling 7-day average)
    pub avg_tx_per_hour: f32,
    /// Total transactions observed (used for Welford's online algorithm)
    pub sample_count: u64,
}
```

**Step 2 — Online baseline update after every allowed transaction**

In `AgentStore`, add:

```rust
pub fn update_baseline(&self, did: &str, tx_value: u64, program_ids: &[String]) -> Result<(), String> {
    let mut agent = self.get_agent(did).ok_or("not found")?;
    let baseline = agent.behavioral_baseline.get_or_insert_with(Default::default);

    // Welford's online mean/variance
    baseline.sample_count += 1;
    let n = baseline.sample_count as f64;
    let delta = tx_value as f64 - baseline.avg_tx_value as f64;
    baseline.avg_tx_value = (baseline.avg_tx_value as f64 + delta / n) as u64;
    let delta2 = tx_value as f64 - baseline.avg_tx_value as f64;
    // variance approx
    baseline.stddev_tx_value = ((baseline.stddev_tx_value as f64 * (n - 1.0) / n
        + delta * delta2 / n).sqrt()) as u64;

    for prog in program_ids {
        *baseline.program_frequency.entry(prog.clone()).or_insert(0) += 1;
    }

    self.save_agent(&agent)
}
```

**Step 3 — Anomaly check in policy evaluator**

Add new `PolicyRule` variant in `crates/core/src/policy/types.rs`:

```rust
/// Flag transactions that deviate significantly from the agent's own historical baseline.
BehavioralBaseline {
    /// Number of stddevs above mean before flagging (default: 3.0)
    stddev_threshold: f64,
    /// Minimum sample count before baseline kicks in (default: 20)
    min_samples: u64,
    /// Decision on anomaly: Block or PendingHITL
    on_anomaly: String,
},
```

In `crates/core/src/policy/evaluator.rs`, add evaluation:

```rust
PolicyRule::BehavioralBaseline { stddev_threshold, min_samples, on_anomaly } => {
    if let Some(baseline) = &tx.agent_baseline {
        if baseline.sample_count >= *min_samples && baseline.stddev_tx_value > 0 {
            let z_score = (tx.amount as f64 - baseline.avg_tx_value as f64)
                / baseline.stddev_tx_value as f64;
            if z_score > *stddev_threshold {
                let reason = format!(
                    "BehavioralAnomaly: z-score {:.1} (threshold {:.1})",
                    z_score, stddev_threshold
                );
                return match on_anomaly.as_str() {
                    "hitl" => FirewallDecision::PendingHITL {
                        approval_id: uuid::Uuid::new_v4().to_string(),
                        reason,
                    },
                    _ => FirewallDecision::Block { reason, policy_id: "behavioral_baseline".into() },
                };
            }
        }
    }
    FirewallDecision::Pass
}
```

**Step 4 — Pass baseline into `NormalizedTransaction`**

Add `agent_baseline: Option<AgentBaselineSnapshot>` to `NormalizedTransaction` in `crates/core/src/transaction/`. The sidecar populates this from `AgentStore` before calling `PolicyEvaluator::evaluate()`.

### `config.toml` addition

```toml
[[policy.rules]]
type = "behavioral_baseline"
stddev_threshold = 3.0
min_samples = 20
on_anomaly = "hitl"   # or "block"
```

---

## 5. AI Intent Scoring

**Status:** `crates/sidecar/src/prompt_safety.rs` exists and does basic prompt injection detection. No scoring model exists for transaction intent.

### Concept

Instead of (or alongside) rule-based blocking, score the *intent* of an action 0–100. Low score = benign (routine transfer to known address). High score = suspicious (new program, high value, unusual time, first-time destination). This score feeds into:
- The `reputation_score` decay (Feature 1)
- `BehavioralBaseline` anomaly confidence (Feature 4)
- Dashboard risk timeline visualization

### Implementation

**Step 1 — `IntentScorer` struct**

New file `crates/sidecar/src/intent_scorer.rs`:

```rust
use crate::audit::AuditEntry;
use crate::agents::AgentBaseline;

pub struct IntentScore {
    pub score: u8,          // 0 = safe, 100 = critical
    pub signals: Vec<String>, // human-readable explanations
}

pub struct IntentScorer;

impl IntentScorer {
    /// Heuristic-based intent scoring. Score 0–100.
    /// Phase 1 is rule-based; Phase 2 can replace with an LLM call.
    pub fn score(
        &self,
        amount: u64,
        destination_is_new: bool,
        program_is_unknown: bool,
        baseline: Option<&AgentBaseline>,
        intent_text: Option<&str>,
    ) -> IntentScore {
        let mut score: u8 = 0;
        let mut signals = vec![];

        // New destination: +20
        if destination_is_new {
            score = score.saturating_add(20);
            signals.push("new destination address".into());
        }

        // Unknown program: +25
        if program_is_unknown {
            score = score.saturating_add(25);
            signals.push("unknown program".into());
        }

        // Behavioral deviation: +30 if >3 stddev
        if let Some(b) = baseline {
            if b.sample_count > 10 && b.stddev_tx_value > 0 {
                let z = (amount as f64 - b.avg_tx_value as f64) / b.stddev_tx_value as f64;
                if z > 3.0 {
                    score = score.saturating_add(30);
                    signals.push(format!("amount {:.1}x above baseline", z));
                }
            }
        }

        // Suspicious keywords in intent text: +15
        if let Some(text) = intent_text {
            let lower = text.to_lowercase();
            let suspicious = ["drain", "sweep", "authority", "upgrade", "migrate"];
            for kw in suspicious {
                if lower.contains(kw) {
                    score = score.saturating_add(15);
                    signals.push(format!("suspicious keyword: '{kw}'"));
                    break;
                }
            }
        }

        IntentScore { score, signals }
    }
}
```

**Step 2 — Add `intent_score` to `AuditEntry`**

In `crates/sidecar/src/audit.rs`:

```rust
pub struct AuditEntry {
    // ...existing fields...
    pub intent_score: Option<u8>,
    pub intent_signals: Vec<String>,
}
```

**Step 3 — Add `IntentScore` policy rule**

In `crates/core/src/policy/types.rs`:

```rust
/// Block or escalate if the computed intent score exceeds a threshold.
IntentScoreThreshold {
    block_above: u8,   // e.g. 75 = block
    hitl_above: u8,    // e.g. 50 = HITL, evaluated first
},
```

**Step 4 — Expose score in API response**

Add `intent_score` and `intent_signals` to the `/simulate` response body so SDK consumers can show the score to their operator.

### Phase 2 — LLM-backed scoring (optional)

Once the heuristic baseline is established, replace `IntentScorer::score()` with a call to a local LLM (via `ollama` sidecar) or an external API:

```rust
// POST to local ollama with transaction context + agent history
// Prompt: "Given this agent's history and this transaction, rate the risk 0-100 and list reasons."
// Parse the JSON response into IntentScore.
```

The heuristic scorer serves as the fallback when the LLM is unavailable.

### `config.toml` addition

```toml
[[policy.rules]]
type = "intent_score_threshold"
hitl_above = 50
block_above = 80

[intent_scorer]
# Phase 2 only — leave empty to use heuristic scorer
llm_endpoint = ""   # e.g. "http://localhost:11434/api/generate"
llm_model = "llama3"
```

---

## Rollout Order

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| 1 | Reputation feedback loop | Low — ~100 lines Rust | Closes the on-chain accountability gap |
| 2 | Webhook on block | Low — ~80 lines Rust | Immediate operator value |
| 3 | HITL dashboard UI | Medium — ~150 lines React | Completes the PendingHITL flow that already exists |
| 4 | AI intent scoring (heuristic) | Medium — ~200 lines Rust | Differentiates from rule-only firewalls |
| 5 | Behavioral baseline | High — requires data pipeline | Strongest long-term moat |

---

## File Map (what to touch)

```
crates/core/src/policy/types.rs        ← add BehavioralBaseline, IntentScoreThreshold rules
crates/core/src/policy/evaluator.rs    ← implement new rule arms
crates/core/src/transaction/mod.rs     ← add agent_baseline to NormalizedTransaction
crates/sidecar/src/agents.rs           ← add strike_count, AgentBaseline, record_strike(), update_baseline()
crates/sidecar/src/audit.rs            ← add intent_score, intent_signals to AuditEntry
crates/sidecar/src/lib.rs              ← wire strike recording, webhook dispatch, pending queue endpoint
crates/sidecar/src/webhook.rs          ← new file: WebhookDispatcher
crates/sidecar/src/intent_scorer.rs    ← new file: IntentScorer
apps/web/src/components/PendingApprovals.tsx  ← new component
apps/web/src/pages/Dashboard.tsx       ← mount PendingApprovals, show intent_score in log rows
config.toml                            ← add [reputation], [webhooks], [intent_scorer] sections
```
