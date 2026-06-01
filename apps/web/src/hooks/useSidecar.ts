import { useCallback } from 'react';

const SIDECAR_URL = import.meta.env.VITE_SIDECAR_URL || 'http://localhost:3000';

interface AuditLogEntry {
  id: number;
  timestamp: number;
  decision: string;
  transaction_id: string | null;
  transaction_signature: string | null;
  intent: string | null;
  result: string;
  reasoning: string;
  simulation_logs: string[];
  transaction_details: {
    request_payload_base64: string | null;
    signature: string | null;
    program_ids: string[];
    account_keys: string[];
  } | null;
}

interface PaginatedLogs {
  total: number;
  offset: number;
  limit: number;
  entries: AuditLogEntry[];
}

interface SidecarStats {
  total: number;
  allowed: number;
  blocked: number;
}

interface PolicyConfig {
  max_sol_per_tx: number | null;
  max_balance_drain_lamports: number | null;
  rate_limit_per_minute: number | null;
  allowed_programs: string[];
  blocked_addresses: string[];
  simulation_checks_enabled: boolean;
}

interface SimulationRequest {
  transaction: string;
  intent?: string;
}

interface SimulationResult {
  passed: boolean;
  decision: string;
  reasoning: string;
  simulation_logs: string[];
  block_id?: string;
}

interface PendingApproval {
  block_id: string;
  timestamp: number;
  intent: string | null;
  reasoning: string;
  transaction_signature: string | null;
}

export function useSidecar() {
  const fetchHealth = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`${SIDECAR_URL}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  const fetchStats = useCallback(async (): Promise<SidecarStats | null> => {
    try {
      const res = await fetch(`${SIDECAR_URL}/audit/stats`);
      if (!res.ok) return null;
      const data = await res.json();
      return {
        total: data.total ?? 0,
        allowed: data.allowed ?? 0,
        blocked: data.blocked ?? 0,
      };
    } catch {
      return null;
    }
  }, []);

  const fetchLogs = useCallback(
    async (limit = 50, offset = 0): Promise<PaginatedLogs | null> => {
      try {
        const res = await fetch(
          `${SIDECAR_URL}/logs?limit=${limit}&offset=${offset}`,
        );
        if (!res.ok) return null;
        return (await res.json()) as PaginatedLogs;
      } catch {
        return null;
      }
    },
    [],
  );

  const fetchPolicy = useCallback(async (): Promise<PolicyConfig | null> => {
    try {
      const res = await fetch(`${SIDECAR_URL}/policy`);
      if (!res.ok) return null;
      const data = await res.json();
      return {
        max_sol_per_tx: data.max_sol_per_tx ?? null,
        max_balance_drain_lamports: data.max_balance_drain_lamports ?? null,
        rate_limit_per_minute: data.rate_limit_per_minute ?? null,
        allowed_programs: data.allowed_programs ?? [],
        blocked_addresses: data.blocked_addresses ?? [],
        simulation_checks_enabled: data.simulation_checks_enabled ?? false,
      };
    } catch {
      return null;
    }
  }, []);

  const updatePolicy = useCallback(
    async (policy: PolicyConfig): Promise<boolean> => {
      try {
        const res = await fetch(`${SIDECAR_URL}/policy/full`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(policy),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    [],
  );

  const simulateTransaction = useCallback(
    async (
      base64Tx: string,
      intent?: string,
    ): Promise<SimulationResult | null> => {
      try {
        const body: SimulationRequest = { transaction: base64Tx };
        if (intent) body.intent = intent;
        const res = await fetch(`${SIDECAR_URL}/simulate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json();
          return {
            passed: false,
            decision: 'BLOCKED',
            reasoning: err.error || 'Simulation request failed',
            simulation_logs: [],
            block_id: err.block_id,
          };
        }
        const data = await res.json();
        return {
          passed: true,
          decision: 'ALLOWED',
          reasoning: 'Transaction passed all checks',
          simulation_logs: data.checks_passed || [],
        };
      } catch (e) {
        return {
          passed: false,
          decision: 'BLOCKED',
          reasoning: `Network error: ${String(e)}`,
          simulation_logs: [],
        };
      }
    },
    [],
  );

  const fetchPending = useCallback(async (): Promise<PendingApproval[]> => {
    try {
      const res = await fetch(`${SIDECAR_URL}/pending`);
      if (!res.ok) return [];
      return (await res.json()) as PendingApproval[];
    } catch {
      return [];
    }
  }, []);

  const overrideBlock = useCallback(
    async (blockId: string, action: 'ALLOW' | 'REJECT'): Promise<boolean> => {
      try {
        const res = await fetch(`${SIDECAR_URL}/override`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ block_id: blockId, action }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    [],
  );

  const fetchCircuitBreakerStatus = useCallback(async (): Promise<{
    engaged: boolean;
  } | null> => {
    try {
      const res = await fetch(`${SIDECAR_URL}/circuit-breaker/status`);
      if (!res.ok) return null;
      return (await res.json()) as { engaged: boolean };
    } catch {
      return null;
    }
  }, []);

  const toggleCircuitBreaker = useCallback(
    async (engage: boolean): Promise<boolean> => {
      try {
        const endpoint = engage
          ? '/circuit-breaker/engage'
          : '/circuit-breaker/disengage';
        const res = await fetch(`${SIDECAR_URL}${endpoint}`, {
          method: 'POST',
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    [],
  );

  return {
    fetchHealth,
    fetchStats,
    fetchLogs,
    fetchPolicy,
    updatePolicy,
    simulateTransaction,
    fetchPending,
    overrideBlock,
    fetchCircuitBreakerStatus,
    toggleCircuitBreaker,
  };
}
