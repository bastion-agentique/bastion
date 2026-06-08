#!/usr/bin/env bash
# Bastion Devnet Demo — exercises the transaction firewall
# Requires: bastion-sidecar running on bastion-agentique.fly.dev/
# Usage:   cargo run -p bastion-sidecar & sleep 2 && bash docs/demo.sh
set -euo pipefail

BASE="${BASTION_URL:-https://bastion-agentique.fly.dev/}"
DIV="========================================"
section() { echo -e "\n$DIV\n  $1\n$DIV\n"; }

# ── Health check ────────────────────────────────────────────
section "1. Health Check"
curl -s "$BASE/health" | python3 -m json.tool

# ── V2 API: PASS ────────────────────────────────────────────
section "2. V2 Evaluate — PASS (within limits)"
curl -s -X POST "$BASE/api/v2/evaluate" \
  -H 'Content-Type: application/json' \
  -d '{
    "agent_id": "agent-solana-1",
    "from": "9xQeW...from",
    "to": "7yRfX...to",
    "amount": 1000000000,
    "currency": "SOL",
    "tx_type": "transfer",
    "chain": "solana"
  }' | python3 -m json.tool

# ── V2 API: BLOCK (amount) ──────────────────────────────────
section "3. V2 Evaluate — BLOCK (amount over 10 SOL limit)"
curl -s -X POST "$BASE/api/v2/evaluate" \
  -H 'Content-Type: application/json' \
  -d '{
    "agent_id": "agent-solana-2",
    "from": "9xQeW...from",
    "to": "5tGfH...unknown",
    "amount": 20000000000,
    "currency": "SOL",
    "tx_type": "transfer",
    "chain": "solana"
  }' | python3 -m json.tool

# ── V2 API: BLOCK (tx type) ─────────────────────────────────
section "4. V2 Evaluate — BLOCK (governance tx type not allowed)"
curl -s -X POST "$BASE/api/v2/evaluate" \
  -H 'Content-Type: application/json' \
  -d '{
    "agent_id": "agent-solana-3",
    "from": "9xQeW...from",
    "to": "7yRfX...to",
    "amount": 1000000000,
    "currency": "SOL",
    "tx_type": "governance",
    "chain": "solana"
  }' | python3 -m json.tool

# ── V2 API: HITL ────────────────────────────────────────────
section "5. V2 Evaluate — PENDING_HITL (over threshold, needs human approval)"
# Uses a custom policy via the internal evaluate endpoint
# (In production, agents configure policy on-chain)
curl -s -X POST "$BASE/api/v2/evaluate" \
  -H 'Content-Type: application/json' \
  -d '{
    "agent_id": "agent-solana-4",
    "from": "9xQeW...from",
    "to": "DAO-treasury",
    "amount": 60000000000,
    "currency": "SOL",
    "tx_type": "transfer",
    "chain": "solana"
  }' | python3 -m json.tool

# ── V1 API: Policy (existing API) ───────────────────────────
section "6. V1 Get Current Policy"
curl -s "$BASE/policy" | python3 -m json.tool

# ── V1 API: Audit Logs ──────────────────────────────────────
section "7. V1 Audit Logs"
curl -s "$BASE/logs" | python3 -m json.tool

# ── V1 API: Circuit Breaker Status ──────────────────────────
section "8. Circuit Breaker Status"
curl -s "$BASE/circuit-breaker/status" | python3 -m json.tool

echo -e "\n$DIV\n  DEMO COMPLETE\n$DIV\n"
