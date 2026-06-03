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
    [programId],
  );

  const fetchStats = useCallback(async (): Promise<StatsData | null> => {
    if (!program) return null;
    try {
      const address = getAuditStateAddress();
      const account = (await program.account.auditState.fetch(address)) as any;
      return {
        total: Number(account.totalAudits),
        allowed: Number(account.allowedCount),
        blocked: Number(account.blockedCount),
      };
    } catch {
      return null;
    }
  }, [program, getAuditStateAddress]);

  const fetchPaused = useCallback(async (): Promise<boolean | null> => {
    if (!program) return null;
    try {
      const address = getAuditStateAddress();
      const account = (await program.account.auditState.fetch(address)) as any;
      return account.paused as boolean;
    } catch {
      return null;
    }
  }, [program, getAuditStateAddress]);

  const fetchAuditEntries = useCallback(
    async (limit = 50): Promise<AuditEntryData[]> => {
      if (!program) return [];
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
    },
    [program, getAuditStateAddress, getAuditEntryAddress],
  );

  const fetchPolicy = useCallback(async (): Promise<PolicyData | null> => {
    if (!program) return null;
    try {
      const address = getPolicyAddress();
      const account = (await program.account.policy.fetch(address)) as any;
      return {
        maxSolPerTx: Number(account.maxSolPerTx),
        rateLimit: Number(account.rateLimitPerMinute),
        allowedPrograms: (account.allowedPrograms as any[]).map(
          (p: any) => new PublicKey(p).toBase58(),
        ),
      };
    } catch {
      return null;
    }
  }, [program, getPolicyAddress]);

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

  return {
    program,
    fetchStats,
    fetchPaused,
    fetchAuditEntries,
    fetchPolicy,
    emergencyPause,
    emergencyResume,
    updatePolicy,
  };
}
