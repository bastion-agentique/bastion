import { PublicKey } from "@solana/web3.js";

export interface AuditState {
  owner: PublicKey;
  authority: PublicKey;
  bump: number;
  totalAudits: number;
  allowedCount: number;
  blockedCount: number;
  paused: boolean;
  pausedAt: number;
  resumedAt: number;
}

export interface AuditEntry {
  authority: PublicKey;
  timestamp: number;
  decision: number;
  simulationResult: number[];
  reasoning: string;
  programId?: number[];
  bump: number;
}

export interface Agent {
  authority: PublicKey;
  name: string;
  capabilityBitmask: number;
  reputationScore: number;
  registeredAt: number;
  bump: number;
}

export interface Policy {
  authority: PublicKey;
  allowedPrograms: PublicKey[];
  maxSolPerTx: number;
  rateLimitPerMinute: number;
  bump: number;
}

export interface AgentRegistered {
  agent: PublicKey;
  authority: PublicKey;
  name: string;
}

export interface ReputationUpdated {
  agent: PublicKey;
  newScore: number;
}

export interface ProtocolPaused {
  authority: PublicKey;
}

export interface ProtocolResumed {
  authority: PublicKey;
}

export const AGENT_CAPABILITIES = {
  TRANSFER: 1 << 0,
  SWAP: 1 << 1,
  NFT_MINT: 1 << 2,
  NFT_TRANSFER: 1 << 3,
  STAKE: 1 << 4,
  DELEGATE: 1 << 5,
  CREATE_PROGRAM: 1 << 6,
} as const;

export type AgentCapability = typeof AGENT_CAPABILITIES[keyof typeof AGENT_CAPABILITIES];

export const DECISION = {
  ALLOWED: 0,
  BLOCKED: 1,
  PENDING: 2,
} as const;

export type Decision = typeof DECISION[keyof typeof DECISION];

// ── Sidecar HTTP types ──────────────────────────────────────────────────────

export interface SidecarConfig {
  /** Base URL of the sidecar, e.g. "https://bastion-agentique.fly.dev/" */
  baseUrl: string;
  /** Optional API key sent as X-API-Key header */
  apiKey?: string;
}

export interface SimulateRequest {
  /** Base64-encoded serialized Solana transaction */
  transaction: string;
  intent?: string;
}

export interface SimulateResponse {
  units_consumed?: number;
  balance_changes?: Record<string, number>;
  logs?: string[];
  error?: string;
  simulation_hash?: number[];
}

export interface SimulateBlockedResponse {
  error: string;
  block_id?: string;
}

export interface SidecarAuditEntry {
  timestamp: number;
  transaction_id?: string;
  transaction_signature?: string;
  decision: string;
  result: "allowed" | "blocked" | "pending";
  reasoning: string;
  intent?: string;
  simulation_logs?: string[];
}

export interface LogsQuery {
  limit?: number;
  offset?: number;
  transaction_id?: string;
  signature?: string;
  result?: "allowed" | "blocked" | "pending";
}

export interface LogsResponse {
  total: number;
  offset: number;
  limit: number;
  entries: SidecarAuditEntry[];
}

export interface SidecarPolicy {
  max_sol_per_tx?: number;
  max_balance_drain_lamports?: number;
  rate_limit_per_minute?: number;
  allowed_programs: string[];
  blocked_addresses: string[];
  simulation_checks_enabled: boolean;
}

export interface HealthResponse {
  status: string;
  uptime_seconds: number;
  db_healthy: boolean;
  db_size_bytes: number;
}

export interface OverrideRequest {
  block_id: string;
  action: "ALLOW" | "REJECT";
}

export interface CircuitBreakerStatus {
  engaged: boolean;
}

// ── EVM Simulation types ─────────────────────────────────────────────────────

export interface EvmTxParams {
  from: string;
  to: string;
  value?: string;
  data?: string;
  gas?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: string;
}

export interface EvmSimulateRequest {
  transaction: EvmTxParams;
  intent?: string;
  chain?: string;
  agentId?: string;
}

export interface EvmSimulateResponse {
  allowed: boolean;
  decision: string;
  reason?: string;
  simulationResult?: {
    logs: string[];
    error?: unknown;
    balanceChanges?: Record<string, number>;
    simulationHash?: number[];
  };
  riskScore?: number;
  riskSummary?: string;
}

// ── SSE Events ────────────────────────────────────────────────────────────────

export interface SseEvent {
  type: string;
  data: unknown;
  id?: string;
}

export class BastionEventStream {
  private abortController: AbortController;
  private url: string;
  private headers: Record<string, string>;

  constructor(url: string, abortController: AbortController, headers: Record<string, string> = {}) {
    this.url = url;
    this.abortController = abortController;
    this.headers = headers;
  }

  private async *streamEvents(): AsyncGenerator<SseEvent> {
    const response = await fetch(this.url, {
      headers: {
        Accept: "text/event-stream",
        ...this.headers,
      },
      signal: this.abortController.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`SSE connection failed: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let eventType = "message";
        let eventData = "";
        let eventId: string | undefined;

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) {
            if (eventData) {
              yield {
                type: eventType,
                data: tryParseJson(eventData),
                id: eventId,
              };
            }
            eventType = "message";
            eventData = "";
            eventId = undefined;
            continue;
          }

          if (trimmed.startsWith("event: ")) {
            eventType = trimmed.slice(7);
          } else if (trimmed.startsWith("data: ")) {
            eventData = trimmed.slice(6);
          } else if (trimmed.startsWith("id: ")) {
            eventId = trimmed.slice(4);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /** Iterate over SSE events (for use in for-await-of loops) */
  async *[Symbol.asyncIterator](): AsyncGenerator<SseEvent> {
    yield* this.streamEvents();
  }

  /** Subscribe with callbacks */
  on(eventType: string | undefined, callback: (data: unknown, event: SseEvent) => void): () => void {
    let cancelled = false;
    (async () => {
      for await (const sseEvent of this.streamEvents()) {
        if (cancelled) break;
        if (!eventType || sseEvent.type === eventType) {
          callback(sseEvent.data, sseEvent);
        }
      }
    })().catch(() => {
      /* stream closed */
    });

    return () => {
      cancelled = true;
      this.abortController.abort();
    };
  }

  close(): void {
    this.abortController.abort();
  }
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
