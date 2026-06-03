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
  staked_lamports: number;
  stake_unlock_at: number;
  sidecar_endpoint: string | null;
  on_chain_verified: boolean;
  // Delegation fields
  parent_did?: string | null;
  delegation_depth?: number;
  delegated_capabilities?: string[];
  delegation_budget?: number | null;
  delegation_spent?: number;
  delegation_expires_at?: number | null;
  is_delegator?: boolean;
  child_dids?: string[];
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
    async (
      did: string,
      authorityPubkey: string,
      sidecarEndpoint?: string,
      parentDid?: string,
      delegationDepth?: number,
      delegatedCapabilities?: string[],
      delegationBudgetSol?: number | null,
      delegationExpiresAt?: number | null,
    ): Promise<boolean> => {
      try {
        const body: Record<string, unknown> = {
          did,
          authority_pubkey: authorityPubkey,
          sidecar_endpoint: sidecarEndpoint ?? null,
        };
        if (parentDid) body.parent_did = parentDid;
        if (delegationDepth !== undefined) body.delegation_depth = delegationDepth;
        if (delegatedCapabilities) body.delegated_capabilities = delegatedCapabilities;
        if (delegationBudgetSol !== undefined) body.delegation_budget_sol = delegationBudgetSol;
        if (delegationExpiresAt !== undefined) body.delegation_expires_at = delegationExpiresAt;

        const res = await fetch(`${SIDECAR_URL}/agents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    [],
  );

  const fetchAgentChildren = useCallback(async (did: string): Promise<TrackedAgent[]> => {
    try {
      const res = await fetch(`${SIDECAR_URL}/agents/${encodeURIComponent(did)}/children`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.children ?? [];
    } catch {
      return [];
    }
  }, []);

  const fetchAgentTree = useCallback(async (did: string): Promise<unknown | null> => {
    try {
      const res = await fetch(`${SIDECAR_URL}/agents/${encodeURIComponent(did)}/tree`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }, []);

  const delegateAgent = useCallback(
    async (
      parentDid: string,
      childDid: string,
      childName: string,
      capabilities: string[],
      budgetSol?: number | null,
      expiresAt?: number | null,
    ): Promise<boolean> => {
      try {
        const res = await fetch(`${SIDECAR_URL}/agents/${encodeURIComponent(parentDid)}/delegate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            child_did: childDid,
            child_name: childName,
            delegated_capabilities: capabilities,
            delegation_budget_sol: budgetSol ?? null,
            delegation_expires_at: expiresAt ?? null,
          }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    [],
  );

  const revokeDelegation = useCallback(
    async (parentDid: string, childDid: string): Promise<boolean> => {
      try {
        const res = await fetch(
          `${SIDECAR_URL}/agents/${encodeURIComponent(parentDid)}/delegation/${encodeURIComponent(childDid)}`,
          { method: 'DELETE' },
        );
        return res.ok;
      } catch {
        return false;
      }
    },
    [],
  );

  const fetchAgentStake = useCallback(async (did: string): Promise<{ staked_lamports: number; stake_unlock_at: number; authority: string } | null> => {
    try {
      const res = await fetch(`${SIDECAR_URL}/agents/${encodeURIComponent(did)}/stake`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }, []);

  const stakeLamports = useCallback(async (did: string, authorityPubkey: string, amount: number): Promise<boolean> => {
    try {
      const res = await fetch(`${SIDECAR_URL}/agents/${encodeURIComponent(did)}/stake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authority_pubkey: authorityPubkey, amount }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  const requestUnstake = useCallback(async (did: string, authorityPubkey: string): Promise<boolean> => {
    try {
      const res = await fetch(`${SIDECAR_URL}/agents/${encodeURIComponent(did)}/stake/unstake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authority_pubkey: authorityPubkey }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  const claimUnstake = useCallback(async (did: string, authorityPubkey: string): Promise<boolean> => {
    try {
      const res = await fetch(`${SIDECAR_URL}/agents/${encodeURIComponent(did)}/stake/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authority_pubkey: authorityPubkey }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  return {
    agents,
    loading,
    fetchAgents,
    fetchAgent,
    fetchAgentAudit,
    fetchAgentChildren,
    fetchAgentTree,
    fetchAgentStake,
    registerAgent,
    delegateAgent,
    stakeLamports,
    requestUnstake,
    claimUnstake,
    revokeDelegation,
  };
}
