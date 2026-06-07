import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Signer, Transaction } from "@solana/web3.js";
import idl from "./idl.json";
import type {
  AuditState,
  AuditEntry,
  Agent,
  Policy,
  SidecarConfig,
  SimulateRequest,
  SimulateResponse,
  SimulateBlockedResponse,
  LogsQuery,
  LogsResponse,
  SidecarPolicy,
  HealthResponse,
  OverrideRequest,
  CircuitBreakerStatus,
} from "./types";

export { AGENT_CAPABILITIES, DECISION } from "./types";
export type {
  AuditState,
  AuditEntry,
  Agent,
  Policy,
  SidecarConfig,
  SimulateRequest,
  SimulateResponse,
  SimulateBlockedResponse,
  LogsQuery,
  LogsResponse,
  SidecarPolicy,
  HealthResponse,
  OverrideRequest,
  CircuitBreakerStatus,
} from "./types";

export const BASTION_PROGRAM_ID = new PublicKey(idl.address);

export const AUDIT_SEED = "bastion_audit";
export const AGENT_SEED = "bastion_agent";
export const POLICY_SEED = "bastion_policy";

export interface BastionConfig {
  connection: Connection;
  provider?: anchor.Provider;
}

// ── On-chain client ────────────────────────────────────────────────────────

export class BastionClient {
  private program: anchor.Program;
  private connection: Connection;
  // Anchor's AccountNamespace is typed against the IDL generic; bypass with a
  // single cast here rather than scattering `as any` throughout the class.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get acct(): any { return this.program.account; }

  constructor(config: BastionConfig) {
    this.connection = config.connection;

    const provider =
      config.provider ??
      new anchor.AnchorProvider(
        config.connection,
        anchor.Wallet.local(),
        anchor.AnchorProvider.defaultOptions()
      );

    this.program = new anchor.Program(idl as unknown as anchor.Idl, provider);
  }

  async initialize(authority: Signer): Promise<Transaction> {
    const [auditState] = PublicKey.findProgramAddressSync(
      [Buffer.from(AUDIT_SEED)],
      this.program.programId
    );
    return this.program.methods
      .initialize()
      .accounts({
        auditState,
        authority: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .transaction();
  }

  async logAudit(
    signer: Signer,
    decision: number,
    simulationResult: number[],
    reasoning: string,
    programId?: number[]
  ): Promise<Transaction> {
    const [auditState] = PublicKey.findProgramAddressSync(
      [Buffer.from(AUDIT_SEED)],
      this.program.programId
    );

    const state = await this.acct.auditState.fetch(auditState) as AuditState;
    const leBytes = Buffer.alloc(8);
    leBytes.writeBigUInt64LE(BigInt(state.totalAudits));

    const [auditEntry] = PublicKey.findProgramAddressSync(
      [Buffer.from(AUDIT_SEED), leBytes],
      this.program.programId
    );

    const simulationResultArray = new Uint8Array(32);
    simulationResult.forEach((v, i) => (simulationResultArray[i] = v));

    return this.program.methods
      .logAudit(
        decision,
        Array.from(simulationResultArray),
        reasoning,
        programId ? new Uint8Array(programId) : null
      )
      .accounts({
        auditState,
        auditEntry,
        signer: signer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .transaction();
  }

  async registerAgent(
    signer: Signer,
    name: string,
    capabilityBitmask: number | bigint
  ): Promise<Transaction> {
    const [agent] = PublicKey.findProgramAddressSync(
      [Buffer.from(AGENT_SEED), signer.publicKey.toBuffer()],
      this.program.programId
    );
    return this.program.methods
      .registerAgent(name, Number(capabilityBitmask))
      .accounts({
        agent,
        signer: signer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .transaction();
  }

  async updateAgentReputation(
    signer: Signer,
    agentAuthority: PublicKey,
    delta: number
  ): Promise<Transaction> {
    const [agent] = PublicKey.findProgramAddressSync(
      [Buffer.from(AGENT_SEED), agentAuthority.toBuffer()],
      this.program.programId
    );
    return this.program.methods
      .updateAgentReputation(delta)
      .accounts({ agent, signer: signer.publicKey })
      .transaction();
  }

  async stakeLamports(signer: Signer, amount: number): Promise<Transaction> {
    const [agentStake] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent_stake"), signer.publicKey.toBuffer()],
      this.program.programId
    );
    return this.program.methods
      .stakeLamports(new anchor.BN(amount))
      .accounts({
        agentStake,
        authority: signer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .transaction();
  }

  async requestUnstake(signer: Signer): Promise<Transaction> {
    const [agentStake] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent_stake"), signer.publicKey.toBuffer()],
      this.program.programId
    );
    return this.program.methods
      .requestUnstake()
      .accounts({ agentStake, authority: signer.publicKey })
      .transaction();
  }

  async claimUnstake(signer: Signer): Promise<Transaction> {
    const [agentStake] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent_stake"), signer.publicKey.toBuffer()],
      this.program.programId
    );
    return this.program.methods
      .claimUnstake()
      .accounts({ agentStake, authority: signer.publicKey })
      .transaction();
  }

  async fetchAgentStake(authority: PublicKey): Promise<unknown> {
    const [agentStake] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent_stake"), authority.toBuffer()],
      this.program.programId
    );
    return this.acct.agentStake.fetch(agentStake);
  }

  async setPolicy(
    signer: Signer,
    allowedPrograms: PublicKey[],
    maxSolPerTx: number,
    rateLimitPerMinute: number
  ): Promise<Transaction> {
    const [policy] = PublicKey.findProgramAddressSync(
      [Buffer.from(POLICY_SEED)],
      this.program.programId
    );
    const programArrays = allowedPrograms.map((p) => {
      const arr = new Uint8Array(32);
      p.toBuffer().copy(arr as unknown as Buffer);
      return arr;
    });
    return this.program.methods
      .setPolicy(programArrays, maxSolPerTx, rateLimitPerMinute)
      .accounts({
        policy,
        signer: signer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .transaction();
  }

  async emergencyPause(signer: Signer): Promise<Transaction> {
    const [auditState] = PublicKey.findProgramAddressSync(
      [Buffer.from(AUDIT_SEED)],
      this.program.programId
    );
    return this.program.methods
      .emergencyPause()
      .accounts({ auditState, signer: signer.publicKey })
      .transaction();
  }

  async emergencyResume(signer: Signer): Promise<Transaction> {
    const [auditState] = PublicKey.findProgramAddressSync(
      [Buffer.from(AUDIT_SEED)],
      this.program.programId
    );
    return this.program.methods
      .emergencyResume()
      .accounts({ auditState, signer: signer.publicKey })
      .transaction();
  }

  getAuditStateAddress(): PublicKey {
    const [address] = PublicKey.findProgramAddressSync(
      [Buffer.from(AUDIT_SEED)],
      this.program.programId
    );
    return address;
  }

  getAgentAddress(authority: PublicKey): PublicKey {
    const [address] = PublicKey.findProgramAddressSync(
      [Buffer.from(AGENT_SEED), authority.toBuffer()],
      this.program.programId
    );
    return address;
  }

  getAgentDID(authority: PublicKey): string {
    return `did:bastion:solana:${this.getAgentAddress(authority).toBase58()}`;
  }

  getPolicyAddress(): PublicKey {
    const [address] = PublicKey.findProgramAddressSync(
      [Buffer.from(POLICY_SEED)],
      this.program.programId
    );
    return address;
  }

  getAuditEntryAddress(index: number): PublicKey {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64LE(BigInt(index));
    const [address] = PublicKey.findProgramAddressSync(
      [Buffer.from(AUDIT_SEED), buf],
      this.program.programId
    );
    return address;
  }

  async fetchAuditState(): Promise<AuditState> {
    return this.acct.auditState.fetch(
      this.getAuditStateAddress()
    ) as Promise<AuditState>;
  }

  async fetchAgent(authority: PublicKey): Promise<Agent> {
    return this.acct.agent.fetch(
      this.getAgentAddress(authority)
    ) as Promise<Agent>;
  }

  async fetchAllAgents(): Promise<Agent[]> {
    return this.acct.agent.all() as Promise<Agent[]>;
  }

  async fetchPolicy(): Promise<Policy> {
    return this.acct.policy.fetch(
      this.getPolicyAddress()
    ) as Promise<Policy>;
  }

  addEventListener<T>(eventName: string, callback: (event: T) => void): number {
    return this.program.addEventListener(eventName, callback);
  }

  removeEventListener(listenerId: number): Promise<void> {
    return this.program.removeEventListener(listenerId);
  }
}

// ── Sidecar HTTP client ────────────────────────────────────────────────────

export class BastionSidecar {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: SidecarConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.headers = { "Content-Type": "application/json" };
    if (config.apiKey) {
      this.headers["X-API-Key"] = config.apiKey;
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string | number | undefined>
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`;
    if (query) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined) params.set(k, String(v));
      }
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }

    const res = await fetch(url, {
      method,
      headers: this.headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const json = await res.json();

    if (!res.ok) {
      const err = (json as { error?: string }).error ?? res.statusText;
      const e = Object.assign(new Error(err), {
        status: res.status,
        body: json,
      });
      throw e;
    }

    return json as T;
  }

  /** Check sidecar health */
  health(): Promise<HealthResponse> {
    return this.request<HealthResponse>("GET", "/health");
  }

  /**
   * Submit a base64-encoded Solana transaction for simulation + policy evaluation.
   * Throws with `status: 403` and `body.block_id` if blocked pending human review.
   */
  simulate(req: SimulateRequest): Promise<SimulateResponse> {
    return this.request<SimulateResponse>("POST", "/simulate", req);
  }

  /** Fetch paginated audit logs */
  logs(query?: LogsQuery): Promise<LogsResponse> {
    return this.request<LogsResponse>("GET", "/logs", undefined, query as Record<string, string | number | undefined>);
  }

  /** Human-in-the-loop: approve or reject a blocked transaction */
  approve(req: OverrideRequest): Promise<SimulateResponse | { error: string }> {
    return this.request("POST", "/override", req);
  }

  /** Get current policy */
  getPolicy(): Promise<SidecarPolicy> {
    return this.request<SidecarPolicy>("GET", "/policy");
  }

  /** Update policy */
  updatePolicy(policy: Partial<SidecarPolicy>): Promise<SidecarPolicy> {
    return this.request<SidecarPolicy>("PUT", "/policy", policy);
  }

  /** Get circuit breaker status */
  circuitBreakerStatus(): Promise<CircuitBreakerStatus> {
    return this.request<CircuitBreakerStatus>("GET", "/circuit-breaker/status");
  }

  /** Engage circuit breaker — pauses all transaction processing */
  engageCircuitBreaker(): Promise<CircuitBreakerStatus> {
    return this.request<CircuitBreakerStatus>("POST", "/circuit-breaker/engage");
  }

  /** Disengage circuit breaker */
  disengageCircuitBreaker(): Promise<CircuitBreakerStatus> {
    return this.request<CircuitBreakerStatus>("POST", "/circuit-breaker/disengage");
  }
}
