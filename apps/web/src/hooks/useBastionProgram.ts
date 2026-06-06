import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useMemo, useCallback } from 'react';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import idl from '../idl.json';

const PROGRAM_ID = new PublicKey('A29V5MUVs73y7XBHHxPpPcAW7h4gGHupbDdwYSwA2n9D');
const AUDIT_SEED = 'bastion_audit';
const POLICY_SEED = 'bastion_policy';

export interface AuditEntryData {
  id: string;
  timestamp: number;
  decision: 'ALLOWED' | 'BLOCKED' | 'PENDING';
  account: string;
  intent: string;
  reason: string;
}

export interface PolicyData {
  maxSolPerTx: number;
  rateLimit: number;
  allowedPrograms: string[];
}

export interface StatsData {
  total: number;
  allowed: number;
  blocked: number;
}

export function useBastionProgram() {
  const { connection } = useConnection();
  const wallet = useWallet();

  // Read-only program — no wallet needed for fetching public on-chain data
  const readOnlyProgram = useMemo(() => {
    try {
      const noopWallet = {
        publicKey: PublicKey.default,
        signTransaction: async (tx: any) => tx,
        signAllTransactions: async (txs: any[]) => txs,
      };
      const provider = new AnchorProvider(connection, noopWallet, AnchorProvider.defaultOptions());
      return new Program(idl, PROGRAM_ID, provider);
    } catch { return null; }
  }, [connection]);

  // Write program — requires wallet for instructions
  const program = useMemo(() => {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) return null;

    try {
      const anchorWallet = {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions,
      };

      const provider = new AnchorProvider(
        connection,
        anchorWallet,
        AnchorProvider.defaultOptions(),
      );

      return new Program(idl, PROGRAM_ID, provider);
    } catch (e) {
      console.error('[Bastion] Failed to initialize Anchor Program:', e);
      return null;
    }
  }, [wallet.publicKey, wallet.signTransaction, wallet.signAllTransactions, connection]);

  const programId = useMemo(() => PROGRAM_ID, []);

  const getAuditStateAddress = useCallback(() => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(AUDIT_SEED)],
      programId,
    )[0];
  }, [programId]);

  const getPolicyAddress = useCallback(() => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(POLICY_SEED)],
      programId,
    )[0];
  }, [programId]);

  const getAuditEntryAddress = useCallback(
    (index: number) => {
      const buf = new BN(index).toArrayLike(Buffer, 'le', 8);
      return PublicKey.findProgramAddressSync(
        [Buffer.from(AUDIT_SEED), buf],
        programId,
      )[0];
    },
    [program, readOnlyProgram, getPolicyAddress],
  );

  const fetchAgents = useCallback(async (): Promise<any[]> => {
    const p = program || readOnlyProgram;
    if (!p) return [];
    try {
      const accounts = await program.account.agent.all();
      return accounts.map((a: any) => ({
        authority: a.account.authority.toBase58(),
        name: a.account.name as string,
        capabilityBitmask: Number(a.account.capabilityBitmask),
        reputationScore: Number(a.account.reputationScore),
        delegationDepth: Number(a.account.delegationDepth || 0),
        registeredAt: Number(a.account.registeredAt),
        bump: a.account.bump,
        pda: a.publicKey.toBase58(),
        did: `did:bastion:solana:${a.publicKey.toBase58()}`,
      }));
    } catch {
      return [];
    }
  }, [program, readOnlyProgram]);

  const fetchStake = useCallback(async (authority: PublicKey): Promise<any | null> => {
    const p = program || readOnlyProgram;
    if (!p) return null;
    try {
      const [agentStake] = PublicKey.findProgramAddressSync(
        [Buffer.from("agent_stake"), authority.toBuffer()],
        programId,
      );
      return await program.account.agentStake.fetch(agentStake);
    } catch {
      return null;
    }
  }, [program, readOnlyProgram, programId]);

  const fetchAllAudits = useCallback(async (limit = 50): Promise<AuditEntryData[]> => {
    const p = program || readOnlyProgram;
    if (!p) return [];
    try {
      const stateAddress = getAuditStateAddress();
      const state = (await program.account.auditState.fetch(stateAddress)) as any;
      const total = Number(state.totalAudits);
      if (total === 0) return [];

      const start = Math.max(0, total - limit);
      const entries: AuditEntryData[] = [];

      for (let i = total - 1; i >= start; i--) {
        try {
          const addr = getAuditEntryAddress(i);
          const entry = (await program.account.auditEntry.fetch(addr)) as any;
          entries.push({
            id: i.toString(),
            timestamp: Number(entry.timestamp),
            decision: entry.decision === 0 ? 'ALLOWED' : 'BLOCKED',
            account: entry.authority.toBase58(),
            intent: (entry.reasoning as string) || 'No description',
            reason: entry.decision === 0 ? 'Policy passed' : 'Policy violation',
          });
        } catch {
          continue;
        }
      }
      return entries;
    } catch {
      return [];
    }
  }, [program, readOnlyProgram, getAuditStateAddress, getAuditEntryAddress]);

  const emergencyPause = useCallback(async (): Promise<string | null> => {
    if (!program) return null;
    try {
      const sig = await (program.methods as any)
        .emergencyPause()
        .accounts({ auditState: getAuditStateAddress() })
        .rpc();
      return sig as string;
    } catch (e) {
      console.error('Pause failed:', e);
      return null;
    }
  }, [program, getAuditStateAddress]);

  const emergencyResume = useCallback(async (): Promise<string | null> => {
    if (!program) return null;
    try {
      const sig = await (program.methods as any)
        .emergencyResume()
        .accounts({ auditState: getAuditStateAddress() })
        .rpc();
      return sig as string;
    } catch (e) {
      console.error('Resume failed:', e);
      return null;
    }
  }, [program, getAuditStateAddress]);

  const updatePolicy = useCallback(
    async (
      allowedPrograms: string[],
      maxSolPerTx: number,
      rateLimitPerMinute: number,
    ): Promise<string | null> => {
      if (!program) return null;
      try {
        const programArrays = allowedPrograms.map((p) => {
          const arr = new Uint8Array(32);
          new PublicKey(p).toBuffer().copy(arr as any);
          return Array.from(arr);
        });

        const sig = await (program.methods as any)
          .setPolicy(programArrays, new BN(maxSolPerTx), rateLimitPerMinute)
          .accounts({
            policy: getPolicyAddress(),
            signer: wallet.publicKey!,
            systemProgram: PublicKey.default,
          })
          .rpc();
        return sig as string;
      } catch (e) {
        console.error('Update policy failed:', e);
        return null;
      }
    },
    [program, getPolicyAddress, wallet.publicKey],
  );

  return useMemo(() => ({
    program,
    fetchStats,
    fetchPaused,
    fetchAuditEntries,
    fetchPolicy,
    fetchAgents,
    fetchStake,
    fetchAllAudits,
    emergencyPause,
    emergencyResume,
    updatePolicy,
  }), [program, fetchStats, fetchPaused, fetchAuditEntries, fetchPolicy, fetchAgents, fetchStake, fetchAllAudits, emergencyPause, emergencyResume, updatePolicy]);
}
