import {
  BastionConfig,
  BastionError,
  BastionErrorCode,
  DiscloseEntryParams,
  DiscloseEntryResult,
  RegisterAgentParams,
  RegisterAgentResult,
  SetPolicyParams,
  SetPolicyResult,
  ValidateTransactionParams,
  ValidateTransactionResult,
  AgentStatus,
  AuditEntry,
} from "./types.js";
import {
  deriveAgentCommitment,
  deriveAuditCommitment,
  deriveEntryId,
  derivePolicyCommitment,
} from "./proof.js";

export class BastionMidnightClient {
  private readonly config: BastionConfig;

  constructor(config: BastionConfig) {
    this.config = config;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Agent Management
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Register a new agent on Midnight.
   * The agent's real address is never stored on-chain — only a ZK commitment.
   */
  async registerAgent(params: RegisterAgentParams): Promise<RegisterAgentResult> {
    const agentId = deriveAgentCommitment(params.name, params.secret);
    const commitment = deriveAgentCommitment(params.name, params.secret, 1);

    const response = await this._post("/register", {
      agentId,
      commitment,
      name: params.name,
      metadataUri: params.metadataUri,
    });

    return {
      agentId,
      commitment,
      txHash: response.txHash,
    };
  }

  /**
   * Get the current status of an agent.
   */
  async getAgentStatus(agentId: string): Promise<AgentStatus> {
    return await this._get(`/agent/${agentId}/status`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Policy Management
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Set or update a policy for an agent.
   * Policy contents are committed as a ZK hash — never stored in plain text.
   */
  async setPolicy(params: SetPolicyParams): Promise<SetPolicyResult> {
    const policyCommitment = derivePolicyCommitment(params.policy, params.ownerSecret);

    const response = await this._post("/policy", {
      agentId: params.agentId,
      policyCommitment,
      policy: params.policy,
    });

    return {
      agentId: params.agentId,
      policyCommitment,
      version: response.version,
      txHash: response.txHash,
    };
  }

  /**
   * Remove an agent's policy.
   */
  async removePolicy(agentId: string, ownerSecret: Uint8Array): Promise<{ txHash: string }> {
    return await this._post("/policy/remove", { agentId });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Transaction Validation
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Validate a transaction against an agent's policy.
   * Returns a ZK proof of compliance if allowed.
   * Also logs the decision as an audit commitment on Midnight.
   */
  async validateTransaction(
    params: ValidateTransactionParams
  ): Promise<ValidateTransactionResult> {
    const timestamp = Math.floor(Date.now() / 1000);
    const response = await this._post("/validate", {
      agentId: params.agentId,
      target: params.target,
      value: params.value.toString(),
      selector: params.selector,
      callData: params.callData
        ? Buffer.from(params.callData).toString("hex")
        : undefined,
    });

    return {
      allowed: response.allowed,
      reason: response.reason,
      proofHash: response.proofHash,
      auditEntryId: response.auditEntryId,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Audit
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get audit log for an agent (returns commitment hashes + public metadata only).
   * Use discloseEntry() to reveal specific entry contents.
   */
  async getAuditLog(
    agentId: string,
    fromTimestamp?: number,
    toTimestamp?: number
  ): Promise<Pick<AuditEntry, "entryId" | "allowed" | "timestamp" | "commitment">[]> {
    const params = new URLSearchParams();
    if (fromTimestamp) params.set("from", fromTimestamp.toString());
    if (toTimestamp) params.set("to", toTimestamp.toString());
    return await this._get(`/audit/${agentId}?${params}`);
  }

  /**
   * Selectively disclose an audit entry to an authorized viewer.
   * Reveals the full entry contents using the original secret.
   */
  async discloseEntry(params: DiscloseEntryParams): Promise<DiscloseEntryResult> {
    const response = await this._post("/audit/disclose", {
      entryId: params.entryId,
      secret: Buffer.from(params.secret).toString("hex"),
      viewerPublicKey: params.viewerPublicKey,
    });
    return response;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Admin
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Emergency pause — stops all agent transactions.
   */
  async pause(): Promise<{ txHash: string }> {
    return await this._post("/pause", {});
  }

  /**
   * Resume from emergency pause.
   */
  async resume(): Promise<{ txHash: string }> {
    return await this._post("/resume", {});
  }

  /**
   * Health check.
   */
  async health(): Promise<{ status: "ok" | "paused"; network: string }> {
    return await this._get("/health");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal HTTP helpers
  // ─────────────────────────────────────────────────────────────────────────

  private async _post(path: string, body: unknown): Promise<any> {
    const res = await fetch(`${this.config.middlewareUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new BastionError(
        err.message ?? "Request failed",
        BastionErrorCode.NETWORK_ERROR,
        err
      );
    }
    return res.json();
  }

  private async _get(path: string): Promise<any> {
    const res = await fetch(`${this.config.middlewareUrl}${path}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new BastionError(
        err.message ?? "Request failed",
        BastionErrorCode.NETWORK_ERROR,
        err
      );
    }
    return res.json();
  }
}

export * from "./types.js";
export * from "./proof.js";
