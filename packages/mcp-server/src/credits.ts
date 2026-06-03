/**
 * Credit ledger for MCP HTTP server.
 * Tracks per-agent call counts with monthly reset and free tier limits.
 * Also tracks consumed payment tx hashes for replay protection.
 */

interface AgentCredits {
  count: number;
  resetAt: Date;
}

interface ToolLimit {
  free_per_month: number;
  price_per_call_sol: number;
  price_per_call_usd: number;
}

const CREDIT_MAP = new Map<string, AgentCredits>();
const USED_PAYMENTS = new Set<string>();

const FREE_TIER_RESET_DAY = 1; // Reset on 1st of each month

export const TOOL_PRICES: Record<string, ToolLimit> = {
  bastion_simulate_transaction: { free_per_month: 100, price_per_call_sol: 0.001, price_per_call_usd: 0.10 },
  bastion_override_block: { free_per_month: 10, price_per_call_sol: 0.01, price_per_call_usd: 1.00 },
  bastion_update_policy: { free_per_month: 5, price_per_call_sol: 0.05, price_per_call_usd: 5.00 },
  bastion_circuit_breaker_toggle: { free_per_month: 3, price_per_call_sol: 0.1, price_per_call_usd: 10.00 },
};

export function ensureCredits(agentId: string): AgentCredits {
  const existing = CREDIT_MAP.get(agentId);
  if (existing) {
    const now = new Date();
    if (now >= existing.resetAt) {
      const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, FREE_TIER_RESET_DAY);
      const fresh: AgentCredits = { count: 0, resetAt: nextReset };
      CREDIT_MAP.set(agentId, fresh);
      return fresh;
    }
    return existing;
  }
  const now = new Date();
  const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, FREE_TIER_RESET_DAY);
  const fresh: AgentCredits = { count: 0, resetAt: nextReset };
  CREDIT_MAP.set(agentId, fresh);
  return fresh;
}

export function getFreeLimit(toolName: string): number {
  return TOOL_PRICES[toolName]?.free_per_month ?? Infinity;
}

export function getToolPrice(toolName: string): ToolLimit | null {
  return TOOL_PRICES[toolName] ?? null;
}

export function useFreeCall(agentId: string, toolName: string): { ok: true; remaining: number } | { ok: false; reason: string; price_sol: number; price_usd: number } {
  const credits = ensureCredits(agentId);
  const limit = getFreeLimit(toolName);

  if (limit === Infinity) {
    // Free tool — no limit
    return { ok: true, remaining: Infinity };
  }

  if (credits.count < limit) {
    credits.count++;
    return { ok: true, remaining: limit - credits.count };
  }

  const price = TOOL_PRICES[toolName];
  return {
    ok: false,
    reason: `Free tier exhausted (${credits.count}/${limit} calls this month). Payment required.`,
    price_sol: price?.price_per_call_sol ?? 0,
    price_usd: price?.price_per_call_usd ?? 0,
  };
}

export function consumePayment(txHash: string): { ok: true } | { ok: false; reason: string } {
  if (USED_PAYMENTS.has(txHash)) {
    return { ok: false, reason: `Payment tx ${txHash} has already been consumed (replay protection)` };
  }
  USED_PAYMENTS.add(txHash);
  return { ok: true };
}

export function grantPaidCredits(agentId: string, numCalls: number): void {
  const credits = ensureCredits(agentId);
  // Grant extra free calls above the monthly limit
  credits.count = Math.max(0, credits.count - numCalls);
}
