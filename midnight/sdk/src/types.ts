// ─────────────────────────────────────────────────────────────────────────────
// Midnight Bastion SDK — Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

export type NetworkId = "undeployed" | "testnet" | "mainnet";

export interface BastionConfig {
  middlewareUrl: string;
  network: NetworkId;
  /** Optional: override the deployed contract addresses */
  contracts?: {
    registry?: string;
    policy?: string;
    audit?: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent types
// ─────────────────────────────────────────────────────────────────────────────

export interface RegisterAgentParams {
  /** Human-readable name for this agent */
  name: string;
  /** Optional metadata URI (IPFS, HTTPS) */
  metadataUri?: string;
  /**
   * Secret used to derive the ZK commitment.
   * Keep this private — losing it means losing ownership proof.
   */
  secret: Uint8Array;
}

export interface RegisterAgentResult {
  /** Public on-chain agent ID (commitment hash) */
  agentId: string;
  /** ZK commitment stored on-chain */
  commitment: string;
  /** Tx hash on Midnight */
  txHash: string;
}

export interface AgentStatus {
  agentId: string;
  isActive: boolean;
  entryCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Policy types
// ─────────────────────────────────────────────────────────────────────────────

export interface Policy {
  /** Allowed target identifiers (hashed) */
  allowedTargetIds: string[];
  /** Allowed function selectors (4-byte hex strings) */
  allowedSelectors: string[];
  /** Maximum value per transaction (in smallest token unit) */
  maxValuePerTx: bigint;
  /** Maximum transactions per day */
  dailyTxLimit: number;
  /** Seconds between transactions (cooldown) */
  cooldownSeconds: number;
  /** Maximum gas per transaction */
  maxGasPerTx?: bigint;
}

export interface SetPolicyParams {
  agentId: string;
  policy: Policy;
  /** Owner secret for authorization proof */
  ownerSecret: Uint8Array;
}

export interface SetPolicyResult {
  agentId: string;
  policyCommitment: string;
  version: number;
  txHash: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Transaction validation types
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidateTransactionParams {
  agentId: string;
  target: string;
  value: bigint;
  /** 4-byte hex selector */
  selector: string;
  /** Raw calldata */
  callData?: Uint8Array;
}

export interface ValidateTransactionResult {
  allowed: boolean;
  reason?: string;
  /** ZK proof of compliance (if allowed) */
  proofHash?: string;
  /** Audit entry ID committed on-chain */
  auditEntryId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit types
// ─────────────────────────────────────────────────────────────────────────────

export interface AuditEntry {
  entryId: string;
  agentId: string;
  target: string;
  value: bigint;
  selector: string;
  allowed: boolean;
  timestamp: number;
  /** ZK commitment stored on-chain */
  commitment: string;
}

export interface DiscloseEntryParams {
  entryId: string;
  /** Secret used when logging the entry */
  secret: Uint8Array;
  /** Public key of the authorized viewer */
  viewerPublicKey: string;
}

export interface DiscloseEntryResult {
  entryId: string;
  disclosed: AuditEntry;
  proof: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Error types
// ─────────────────────────────────────────────────────────────────────────────

export class BastionError extends Error {
  constructor(
    message: string,
    public readonly code: BastionErrorCode,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "BastionError";
  }
}

export enum BastionErrorCode {
  AGENT_NOT_REGISTERED = "AGENT_NOT_REGISTERED",
  AGENT_ALREADY_REGISTERED = "AGENT_ALREADY_REGISTERED",
  POLICY_NOT_SET = "POLICY_NOT_SET",
  POLICY_INACTIVE = "POLICY_INACTIVE",
  TARGET_NOT_ALLOWED = "TARGET_NOT_ALLOWED",
  VALUE_EXCEEDS_LIMIT = "VALUE_EXCEEDS_LIMIT",
  DAILY_LIMIT_EXCEEDED = "DAILY_LIMIT_EXCEEDED",
  COOLDOWN_NOT_ELAPSED = "COOLDOWN_NOT_ELAPSED",
  REGISTRY_PAUSED = "REGISTRY_PAUSED",
  UNAUTHORIZED = "UNAUTHORIZED",
  PROOF_GENERATION_FAILED = "PROOF_GENERATION_FAILED",
  NETWORK_ERROR = "NETWORK_ERROR",
}
