import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAgents, type TrackedAgent } from '../hooks/useAgents';
import { useBastionProgram } from '../hooks/useBastionProgram';
import { useWallet } from '@solana/wallet-adapter-react';

type Filter = 'all' | 'parents' | 'children' | 'swaps' | 'transfers' | 'stakers';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'parents', label: 'Parents' },
  { id: 'children', label: 'Sub-Agents' },
  { id: 'transfers', label: 'Transfers' },
  { id: 'swaps', label: 'Swaps' },
  { id: 'stakers', label: 'Stakers' },
];

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

function AgentCard({ agent }: { agent: any }) {
  const navigate = useNavigate();
  const rep = agent.reputation_score ?? agent.reputationScore ?? 0;
  const caps = getCapabilityLabels(agent.capability_bitmask ?? agent.capabilityBitmask ?? 0);
  const scorePct = Math.min(rep / 100, 1);
  const scoreColor = scorePct > 0.7 ? '#22c55e' : scorePct > 0.4 ? '#f59e0b' : '#ef4444';
  const isParent = agent.is_delegator || agent.child_dids?.length > 0;
  const isChild = !!agent.parent_did;
  const name = agent.name || `Agent-${(agent.authority || '').slice(0, 8)}`;
  const did = agent.did || '';
  const staked = agent.staked_lamports ?? 0;

  return (
    <button
      onClick={() => navigate(`/agents/${encodeURIComponent(did)}`)}
      className="rounded-xl p-4 text-left transition-colors hover:opacity-90 w-full"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: scoreColor }} />
              <p className="font-mono text-sm text-zinc-200 truncate">{name}</p>
          </div>
          <p className="font-mono text-[9px] text-zinc-600 truncate">
            {agent.did.split(':').pop()?.slice(0, 16)}...
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          {isParent && (
            <span className="font-mono text-[8px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>PARENT</span>
          )}
          {isChild && (
            <span className="font-mono text-[8px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>SUB</span>
          )}
          {agent.on_chain_verified && (
            <span className="font-mono text-[8px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>VERIFIED</span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between font-mono text-[10px]">
        <div className="flex flex-wrap gap-1">
          {caps.length > 0 ? caps.map(c => (
            <span key={c} className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa' }}>{c}</span>
          )) : (
            <span className="text-zinc-600">none</span>
          )}
        </div>
        <span className="text-zinc-500">{agent.reputation_score}/100</span>
        {agent.staked_lamports > 0 && (
          <span className="text-amber-400">{agent.staked_lamports.toLocaleString()} SOL</span>
        )}
      </div>

      {isParent && (
        <p className="font-mono text-[9px] text-zinc-500 mt-2">
          {(agent as any).child_count ?? (agent as any).child_dids?.length ?? 0} sub-agents
        </p>
      )}
      {isChild && (
        <p className="font-mono text-[9px] text-zinc-500 mt-2">
          Depth: {(agent as any).delegation_depth ?? '?'} →
          Parent: {((agent as any).parent_did as string)?.split(':').pop()?.slice(0, 8)}...
        </p>
      )}
    </button>
  );
}

export default function AgentList() {
  const { agents: trackedAgents, fetchAgents, loading: sidecarLoading } = useAgents();
  const sol = useBastionProgram();
  const { connected } = useWallet();
  const [filter, setFilter] = useState<Filter>('all');
  const [onChainAgents, setOnChainAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    sol.fetchAgents().then(agents => {
      setOnChainAgents(agents || []);
      setLoading(false);
    });
    fetchAgents(); // Try sidecar too for hybrid data
  }, [sol, fetchAgents]);

  // Merge on-chain + sidecar agents, preferring on-chain
  const allAgents = useCallback(() => {
    const seen = new Set<string>();
    const merged: any[] = [];
    // On-chain first (network view)
    for (const a of onChainAgents) {
      if (!seen.has(a.authority)) {
        seen.add(a.authority);
        merged.push({ ...a, onChain: true, did: a.did || `did:bastion:solana:${a.pda}` });
      }
    }
    // Sidecar overlay (adds staking + delegation fields)
    for (const a of trackedAgents) {
      if (!seen.has(a.authority)) {
        seen.add(a.authority);
        merged.push({ ...a, onChain: false });
      }
    }
    return merged;
  }, [onChainAgents, trackedAgents]);

  const filtered = useCallback(() => {
    switch (filter) {
      case 'parents': return trackedAgents.filter(a => (a as any).is_delegator || (a as any).child_dids?.length > 0);
      case 'children': return trackedAgents.filter(a => !!(a as any).parent_did);
      case 'transfers': return trackedAgents.filter(a => a.capability_bitmask & 0b00000001);
      case 'swaps': return trackedAgents.filter(a => a.capability_bitmask & 0b00000010);
      case 'stakers': return trackedAgents.filter(a => a.capability_bitmask & 0b00000100);
      default: return trackedAgents;
    }
  }, [filter, trackedAgents]);

  const agents = filtered();
  const parentCount = trackedAgents.filter(a => (a as any).is_delegator || (a as any).child_dids?.length > 0).length;
  const childCount = trackedAgents.filter(a => !!(a as any).parent_did).length;

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-4 bg-black/80 backdrop-blur-md border-b border-white/[0.06]">
        <Link to="/dashboard" className="font-serif text-lg tracking-tight no-underline text-white">Bastion<span className="text-[8px] align-super ml-px">&reg;</span></Link>
        <div className="flex items-center gap-3">
          <span className="font-sans text-[10px] text-zinc-500">
            {allAgents().length} agents ({parentCount} parents, {childCount} children)
          </span>
          {!connected && (
            <Link to="/integrate" className="font-sans text-xs text-blue-400 hover:underline">Register New Agent</Link>
          )}
        </div>
      </nav>

      <main className="pt-32 px-6 pb-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-serif text-2xl mb-2">Agent Registry</h1>
          <p className="font-sans text-xs text-zinc-500">
            Registered agents with DID-based identity and delegation hierarchy.
          </p>
        </div>

        {/* Filters */}
        <div className="flex gap-1 mb-6 p-1 rounded-lg w-fit" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.04)' }}>
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className="px-4 py-1.5 rounded-md font-sans text-xs font-medium transition-colors"
              style={filter === f.id ? { background: '#fff', color: '#000' } : { background: 'transparent', color: '#71717a' }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Agent grid */}
        {loading ? (
          <p className="font-mono text-xs text-zinc-600">Loading agents...</p>
        ) : agents.length === 0 ? (
          <div className="rounded-xl p-8 text-center" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.04)' }}>
            <p className="font-mono text-sm text-zinc-500 mb-2">No agents found</p>
            <p className="font-sans text-xs text-zinc-600 mb-4">
              {trackedAgents.length === 0
                ? 'No agents registered yet. Start by self-registering an agent.'
                : 'No agents match the current filter.'}
            </p>
            {trackedAgents.length === 0 && (
              <button
                onClick={() => navigate('/integrate')}
                className="px-6 py-2 rounded-full text-sm font-medium font-sans"
                style={{ background: 'var(--text-primary)', color: 'var(--bg)' }}
              >
                Register Your Agent
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {agents.map(agent => (
              <AgentCard key={agent.did} agent={agent} />
            ))}
          </div>
        )}

        {/* Summary */}
        {trackedAgents.length > 0 && (
          <div className="mt-8 rounded-xl p-4" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.04)' }}>
            <p className="font-sans text-[10px] uppercase tracking-wider text-zinc-500 mb-3">Delegation Summary</p>
            <div className="grid grid-cols-3 gap-4 font-mono text-[10px] text-zinc-400">
              <div>
                <span className="text-zinc-500">Total Agents</span>
                <p className="text-zinc-200 text-sm">{trackedAgents.length}</p>
              </div>
              <div>
                <span className="text-zinc-500">Parent Agents</span>
                <p className="text-zinc-200 text-sm">{parentCount}</p>
              </div>
              <div>
                <span className="text-zinc-500">Sub-Agents</span>
                <p className="text-zinc-200 text-sm">{childCount}</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
