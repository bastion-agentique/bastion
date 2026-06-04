import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useAgents, type TrackedAgent, type AgentAuditResponse } from '../hooks/useAgents';
import { useBastionProgram } from '../hooks/useBastionProgram';

const CAPABILITY_LABELS: Record<number, string> = {
  0b00000001: 'TRANSFER',
  0b00000010: 'SWAP',
  0b00000100: 'STAKE',
  0b00001000: 'GOVERNANCE',
  0b00010000: 'DEPLOY',
};

function getCapabilityLabels(bitmask: number): string[] {
  return Object.entries(CAPABILITY_LABELS)
    .filter(([k]) => (bitmask & Number(k)) !== 0)
    .map(([, v]) => v);
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

export default function AgentDetail() {
  const { did } = useParams<{ did: string }>();
  const { fetchAgent, fetchAgentAudit } = useAgents();
  const [agent, setAgent] = useState<TrackedAgent | null>(null);
  const [audit, setAudit] = useState<AgentAuditResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!did) return;
    setLoading(true);
    Promise.all([
      fetchAgent(did),
      fetchAgentAudit(did, 50, 0),
    ]).then(([agentData, auditData]) => {
      setAgent(agentData);
      setAudit(auditData);
      setLoading(false);
    });
  }, [did, fetchAgent, fetchAgentAudit]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <span className="font-mono text-xs text-zinc-500">Loading agent...</span>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4">
        <p className="font-mono text-zinc-500">Agent not found</p>
        <Link to="/dashboard" className="font-sans text-xs text-blue-400 hover:underline">Back to Dashboard</Link>
      </div>
    );
  }

  const capabilities = getCapabilityLabels(agent.capability_bitmask);
  const scorePct = Math.min(agent.reputation_score / 100, 1);

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-4 bg-black/80 backdrop-blur-md border-b border-white/[0.06]">
        <Link to="/dashboard" className="font-serif text-lg tracking-tight no-underline text-white">Bastion<span className="text-[8px] align-super ml-px">&reg;</span></Link>
        <span className="font-sans text-[10px] text-zinc-500">Agent Detail</span>
      </nav>

      <main className="pt-[72px] px-6 pb-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="rounded-xl p-6 mb-4" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="font-serif text-2xl mb-1">{agent.name}</h1>
              <p className="font-mono text-[11px] text-zinc-500 break-all">{agent.did}</p>
            </div>
            <div className="flex items-center gap-2">
              {agent.on_chain_verified && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', borderColor: 'rgba(34,197,94,0.2)' }}>VERIFIED</span>
              )}
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-5 gap-3 mb-4">

            <div className="rounded-lg p-3" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <p className="font-sans text-[9px] uppercase tracking-wider text-zinc-500 mb-1">Staked</p>
              <p className="font-mono text-sm font-bold" style={{ color: '#f59e0b' }}>{(agent.staked_lamports ?? 0).toLocaleString()} SOL</p>
              {agent.stake_unlock_at > 0 && (
                <p className="font-mono text-[8px] text-orange-400 mt-0.5">Unlock: {formatDate(agent.stake_unlock_at)}</p>
              )}
            </div>

            <div className="rounded-lg p-3" style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}>
              <p className="font-sans text-[9px] uppercase tracking-wider text-zinc-500 mb-1">Reputation</p>
              <p className="font-mono text-lg font-bold" style={{ color: scorePct > 0.7 ? '#22c55e' : scorePct > 0.4 ? '#f59e0b' : '#ef4444' }}>{agent.reputation_score}</p>
            </div>
            <div className="rounded-lg p-3" style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.15)' }}>
              <p className="font-sans text-[9px] uppercase tracking-wider text-zinc-500 mb-1">Capabilities</p>
              <div className="flex flex-wrap gap-1">
                {capabilities.length > 0 ? capabilities.map(c => (
                  <span key={c} className="font-mono text-[8px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(139,92,246,0.2)', color: '#a78bfa' }}>{c}</span>
                )) : <span className="font-mono text-xs text-zinc-600">none</span>}
              </div>
            </div>
            <div className="rounded-lg p-3" style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)' }}>
              <p className="font-sans text-[9px] uppercase tracking-wider text-zinc-500 mb-1">Authority</p>
              <p className="font-mono text-[10px] break-all text-zinc-300">{agent.authority.slice(0, 16)}...</p>
            </div>
            <div className="rounded-lg p-3" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <p className="font-sans text-[9px] uppercase tracking-wider text-zinc-500 mb-1">Registered</p>
              <p className="font-mono text-[10px] text-zinc-300">{formatDate(agent.registered_at)}</p>
            </div>
          </div>

          {/* DID Document */}
          <details className="mb-4">
            <summary className="font-sans text-[10px] uppercase tracking-wider text-zinc-500 cursor-pointer hover:text-zinc-300">DID Document</summary>
            <pre className="mt-2 p-3 rounded-lg font-mono text-[10px] text-zinc-400 overflow-x-auto" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.04)' }}>
{JSON.stringify({
  id: agent.did,
  authority: agent.authority,
  agent_pda: agent.agent_pda,
  name: agent.name,
  capability_bitmask: agent.capability_bitmask,
  reputation_score: agent.reputation_score,
  on_chain_verified: agent.on_chain_verified,
}, null, 2)}
            </pre>
          </details>

          {/* Delegation Info */}
          {((agent as any).parent_did || (agent as any).is_delegator || (agent as any).child_dids?.length > 0) && (
            <div className="mb-4 p-4 rounded-lg" style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.15)' }}>
              <p className="font-sans text-[10px] uppercase tracking-wider text-zinc-500 mb-3">Delegation</p>

              {/* Parent chain */}
              {(agent as any).parent_did && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-[9px] text-zinc-500">Parent:</span>
                  <Link
                    to={`/agents/${encodeURIComponent((agent as any).parent_did)}`}
                    className="font-mono text-[10px] text-purple-400 hover:underline truncate"
                  >
                    {((agent as any).parent_did as string)?.split(':').pop()?.slice(0, 12)}...
                  </Link>
                  {(agent as any).delegation_depth !== undefined && (
                    <span className="ml-auto font-mono text-[8px] text-zinc-600">Depth: {(agent as any).delegation_depth}</span>
                  )}
                </div>
              )}

              {/* Delegated capabilities */}
              {(agent as any).delegated_capabilities?.length > 0 && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-[9px] text-zinc-500">Delegated:</span>
                  <div className="flex flex-wrap gap-1">
                    {(agent as any).delegated_capabilities.map((c: string) => (
                      <span key={c} className="font-mono text-[8px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Budget bar */}
              {(agent as any).delegation_budget && (
                <div className="mb-2">
                  <div className="flex items-center justify-between font-mono text-[9px] mb-1">
                    <span className="text-zinc-500">Budget: {Number((agent as any).delegation_budget).toLocaleString()} lamports</span>
                    <span className="text-zinc-600">Spent: {Number((agent as any).delegation_spent ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(((agent as any).delegation_spent ?? 0) / Number((agent as any).delegation_budget) * 100, 100)}%`,
                        background: 'linear-gradient(90deg, #a78bfa, #c084fc)',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Expiry */}
              {(agent as any).delegation_expires_at && (
                <div className="font-mono text-[9px] text-zinc-500 mb-2">
                  Expires: {formatDate((agent as any).delegation_expires_at)}
                </div>
              )}

              {/* Sub-agents */}
              {((agent as any).child_dids?.length > 0 || (agent as any).is_delegator) && (
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(139,92,246,0.15)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-[9px] text-zinc-500">Sub-Agents: {(agent as any).child_dids?.length ?? 0}</span>
                  </div>
                  {(agent as any).child_dids?.slice(0, 5).map((childDid: string) => (
                    <Link
                      key={childDid}
                      to={`/agents/${encodeURIComponent(childDid)}`}
                      className="flex items-center gap-2 py-1 font-mono text-[10px] text-purple-400 hover:underline truncate block"
                    >
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#a78bfa' }} />
                      {childDid.split(':').pop()?.slice(0, 12)}...
                    </Link>
                  ))}
                  {(agent as any).child_dids?.length > 5 && (
                    <p className="font-mono text-[9px] text-zinc-600 mt-1">+{((agent as any).child_dids?.length ?? 0) - 5} more</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Staking Actions */}
        <div className="rounded-xl p-4 mb-6" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)' }}>
          <p className="font-sans text-[10px] uppercase tracking-wider text-zinc-500 mb-3">Staking</p>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                const amt = prompt('Enter SOL amount to stake:');
                if (amt) {
                  const lamports = Math.floor(parseFloat(amt) * 1_000_000_000);
                  if (lamports > 0) {
                    alert(`Use the SDK to stake: client.stakeLamports(wallet, ${lamports})`);
                  }
                }
              }}
              className="px-4 py-2 rounded-lg font-mono text-xs font-medium transition-colors hover:opacity-80"
              style={{ background: '#f59e0b', color: '#000' }}
            >
              Stake SOL
            </button>
            {agent.staked_lamports > 0 && (
              <button
                onClick={async () => {
                  alert('Use the SDK: client.requestUnstake(wallet)');
                }}
                className="px-4 py-2 rounded-lg font-mono text-xs font-medium transition-colors hover:opacity-80"
                style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}
              >
                Request Unstake
              </button>
            )}
            {agent.stake_unlock_at > 0 && agent.stake_unlock_at * 1000 < Date.now() && (
              <button
                onClick={async () => {
                  alert('Use the SDK: client.claimUnstake(wallet)');
                }}
                className="px-4 py-2 rounded-lg font-mono text-xs font-medium transition-colors hover:opacity-80"
                style={{ background: '#22c55e', color: '#000' }}
              >
                Claim SOL
              </button>
            )}
          </div>
          <div className="mt-3 space-y-1 font-mono text-[9px] text-zinc-600">
            <p>Min stake duration: 48 hours</p>
            <p>Unstake cooldown: 7 days</p>
            <p>Stake-weighted policy: higher stake = higher transaction limits</p>
          </div>
        </div>

        {/* Audit Timeline */}
        <div className="rounded-xl p-6" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-sans text-sm font-semibold">Audit Trail</h2>
            <span className="font-mono text-[10px] text-zinc-500">{audit?.total ?? 0} entries</span>
          </div>

          {!audit || audit.entries.length === 0 ? (
            <p className="font-mono text-xs text-zinc-600">No audit entries for this agent yet.</p>
          ) : (
            <div className="space-y-2">
              {audit.entries.map((entry, i) => {
                const isAllowed = typeof entry.decision === 'string'
                  ? entry.decision.toUpperCase() === 'ALLOWED'
                  : false;
                return (
                  <div key={i} className="flex items-start gap-3 p-2 rounded" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: isAllowed ? '#22c55e' : '#ef4444' }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-[9px] px-1 rounded" style={{ color: isAllowed ? '#22c55e' : '#ef4444', background: isAllowed ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)' }}>
                          {isAllowed ? 'ALLOWED' : 'BLOCKED'}
                        </span>
                        <span className="font-mono text-[9px] text-zinc-600">{formatDate(entry.timestamp)}</span>
                      </div>
                      <p className="font-sans text-[11px] text-zinc-400 truncate">{entry.reasoning || 'No reason'}</p>
                      {entry.intent && (
                        <p className="font-sans text-[10px] text-zinc-600 mt-0.5">Intent: {entry.intent}</p>
                      )}
                      {entry.transaction_signature && (
                        <p className="font-mono text-[9px] text-zinc-700 mt-0.5 truncate">TX: {entry.transaction_signature}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
