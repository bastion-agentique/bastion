import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAgents, type TrackedAgent, type AgentAuditResponse } from '../hooks/useAgents';

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
          <div className="grid grid-cols-4 gap-3 mb-4">
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
