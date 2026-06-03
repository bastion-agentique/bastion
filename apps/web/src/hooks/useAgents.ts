import { useCallback, useState } from 'react';

const SIDECAR_URL = import.meta.env.VITE_SIDECAR_URL || 'http://localhost:3000';

export interface TrackedAgent {
  did: string;
  authority: string;
  agent_pda: string;
  name: string;
  capability_bitmask: number;
  reputation_score: number;
  registered_at: number;
  sidecar_endpoint: string | null;
  on_chain_verified: boolean;
}

export interface AgentListResponse {
  agents: TrackedAgent[];
  total: number;
}

export interface AgentAuditEntry {
  id?: number;
  timestamp: number;
  decision: string;
  transaction_id: string | null;
  transaction_signature: string | null;
  intent: string | null;
  result: string;
  reasoning: string;
  simulation_logs: string[];
}

export interface AgentAuditResponse {
  did: string;
  total: number;
  offset: number;
  limit: number;
  entries: AgentAuditEntry[];
}

export function useAgents() {
  const [agents, setAgents] = useState<TrackedAgent[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAgents = useCallback(async (): Promise<TrackedAgent[]> => {
    setLoading(true);
    try {
      const res = await fetch(`${SIDECAR_URL}/agents`);
      if (!res.ok) return [];
      const data: AgentListResponse = await res.json();
      setAgents(data.agents);
      return data.agents;
    } catch {
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAgent = useCallback(async (did: string): Promise<TrackedAgent | null> => {
    try {
      const res = await fetch(`${SIDECAR_URL}/agents/${encodeURIComponent(did)}`);
      if (!res.ok) return null;
      return await res.json() as TrackedAgent;
    } catch {
      return null;
    }
  }, []);

  const fetchAgentAudit = useCallback(
    async (did: string, limit = 50, offset = 0): Promise<AgentAuditResponse | null> => {
      try {
        const res = await fetch(
          `${SIDECAR_URL}/agents/${encodeURIComponent(did)}/audit?limit=${limit}&offset=${offset}`,
        );
        if (!res.ok) return null;
        return await res.json() as AgentAuditResponse;
      } catch {
        return null;
      }
    },
    [],
  );

  const registerAgent = useCallback(
    async (did: string, authorityPubkey: string, sidecarEndpoint?: string): Promise<boolean> => {
      try {
        const res = await fetch(`${SIDECAR_URL}/agents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            did,
            authority_pubkey: authorityPubkey,
            sidecar_endpoint: sidecarEndpoint ?? null,
          }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    [],
  );

  return { agents, loading, fetchAgents, fetchAgent, fetchAgentAudit, registerAgent };
}
