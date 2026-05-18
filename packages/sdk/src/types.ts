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