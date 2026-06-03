import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Signer, Transaction } from "@solana/web3.js";
import idl from "./idl.json";

export const BASTION_PROGRAM_ID = new PublicKey(
  idl.address
);

export const AUDIT_SEED = "bastion_audit";
export const AGENT_SEED = "bastion_agent";
export const POLICY_SEED = "bastion_policy";

export interface BastionConfig {
  connection: Connection;
  provider?: anchor.Provider;
}

export class BastionClient {
  private program: any;
  private connection: Connection;

  constructor(config: BastionConfig) {
    this.connection = config.connection;

    const provider = config.provider ?? new anchor.AnchorProvider(
      config.connection,
      anchor.Wallet.local(),
      anchor.AnchorProvider.defaultOptions()
    );

    this.program = new anchor.Program(idl as any, provider);
  }

  async initialize(authority: Signer): Promise<Transaction> {
    const [auditState] = anchor.web3.PublicKey.findProgramAddressSync(
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
    const [auditState] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from(AUDIT_SEED)],
      this.program.programId
    );

    const state = await this.program.account.auditState.fetch(auditState);
    const totalAudits = state.totalAudits as anchor.BN;
    const leBytes = Buffer.alloc(8);
    leBytes.writeBigUInt64LE(BigInt(totalAudits.toString()));
    const [auditEntry] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from(AUDIT_SEED), leBytes],
      this.program.programId
    );

    const simulationResultArray = new Uint8Array(32);
    simulationResult.forEach((v, i) => simulationResultArray[i] = v);

    const programIdArray = programId
      ? new Uint8Array(programId)
      : null;

    return this.program.methods
      .logAudit(
        decision,
        Array.from(simulationResultArray),
        reasoning,
        programIdArray
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
    const [agent] = anchor.web3.PublicKey.findProgramAddressSync(
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
    const [agent] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from(AGENT_SEED), agentAuthority.toBuffer()],
      this.program.programId
    );

    return this.program.methods
      .updateAgentReputation(delta)
      .accounts({
        agent,
        signer: signer.publicKey,
      })
      .transaction();
  }

  async stakeLamports(signer: Signer, amount: number): Promise<Transaction> {
    const [agentStake] = anchor.web3.PublicKey.findProgramAddressSync(
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
    const [agentStake] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("agent_stake"), signer.publicKey.toBuffer()],
      this.program.programId
    );
    return this.program.methods
      .requestUnstake()
      .accounts({
        agentStake,
        authority: signer.publicKey,
      })
      .transaction();
  }

  async claimUnstake(signer: Signer): Promise<Transaction> {
    const [agentStake] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("agent_stake"), signer.publicKey.toBuffer()],
      this.program.programId
    );
    return this.program.methods
      .claimUnstake()
      .accounts({
        agentStake,
        authority: signer.publicKey,
      })
      .transaction();
  }

  async fetchAgentStake(authority: PublicKey): Promise<any> {
    const [agentStake] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("agent_stake"), authority.toBuffer()],
      this.program.programId
    );
    return this.program.account.agentStake.fetch(agentStake);
  }

  async setPolicy(
    signer: Signer,
    allowedPrograms: PublicKey[],
    maxSolPerTx: number,
    rateLimitPerMinute: number
  ): Promise<Transaction> {
    const [policy] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from(POLICY_SEED)],
      this.program.programId
    );

    const programArrays = allowedPrograms.map(p => {
      const arr = new Uint8Array(32);
      const buf = p.toBuffer();
      buf.copy(arr);
      return arr;
    });

    return this.program.methods
      .setPolicy(
        programArrays,
        maxSolPerTx,
        rateLimitPerMinute
      )
      .accounts({
        policy,
        signer: signer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .transaction();
  }

  async emergencyPause(signer: Signer): Promise<Transaction> {
    const [auditState] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from(AUDIT_SEED)],
      this.program.programId
    );

    return this.program.methods
      .emergencyPause()
      .accounts({
        auditState,
        signer: signer.publicKey,
      })
      .transaction();
  }

  async emergencyResume(signer: Signer): Promise<Transaction> {
    const [auditState] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from(AUDIT_SEED)],
      this.program.programId
    );

    return this.program.methods
      .emergencyResume()
      .accounts({
        auditState,
        signer: signer.publicKey,
      })
      .transaction();
  }

  getAuditStateAddress(): PublicKey {
    const [address] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from(AUDIT_SEED)],
      this.program.programId
    );
    return address;
  }

  getAgentAddress(authority: PublicKey): PublicKey {
    const [address] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from(AGENT_SEED), authority.toBuffer()],
      this.program.programId
    );
    return address;
  }

  getAgentDID(authority: PublicKey): string {
    const agentPda = this.getAgentAddress(authority);
    return `did:bastion:solana:${agentPda.toBase58()}`;
  }

  getPolicyAddress(): PublicKey {
    const [address] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from(POLICY_SEED)],
      this.program.programId
    );
    return address;
  }

  async fetchAuditState(): Promise<any> {
    const address = this.getAuditStateAddress();
    return this.program.account.auditState.fetch(address);
  }

  async fetchAgent(authority: PublicKey): Promise<any> {
    const address = this.getAgentAddress(authority);
    return this.program.account.agent.fetch(address);
  }

  async fetchAllAgents(): Promise<any[]> {
    return this.program.account.agent.all();
  }

  getAuditEntryAddress(index: number): PublicKey {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64LE(BigInt(index));
    const [address] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from(AUDIT_SEED), buf],
      this.program.programId
    );
    return address;
  }

  async fetchPolicy(): Promise<any> {
    const address = this.getPolicyAddress();
    return this.program.account.policy.fetch(address);
  }

  addEventListener<T>(
    eventName: string,
    callback: (event: T) => void
  ): number {
    return this.program.addEventListener(eventName, callback);
  }

  removeEventListener(listenerId: number): Promise<void> {
    return this.program.removeEventListener(listenerId);
  }
}

export * from "./types";