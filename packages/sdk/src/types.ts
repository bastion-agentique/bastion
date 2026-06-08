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
