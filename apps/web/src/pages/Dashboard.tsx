import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useChain } from '../context/ChainContext';
import { useBastionProgram, type AuditEntryData, type PolicyData, type StatsData } from '../hooks/useBastionProgram';
import { useSidecar } from '../hooks/useSidecar';
import { useAgents, type TrackedAgent } from '../hooks/useAgents';
import AgentFloor from '../components/AgentFloor';
import { useAgentEvents } from '../hooks/useAgentEvents';

const DECISION_COLORS: Record<string, string> = { ALLOWED: '#22c55e', BLOCKED: '#ef4444', PENDING: '#f59e0b' };

function Gauge({ value, max, label, unit, colorScale }: { value: number; max: number; label: string; unit: string; colorScale?: [number, string][] }) {
  const pct = Math.min(value / max, 1);
  const angle = -90 + pct * 180;
  const c = colorScale?.find(([t]) => pct <= t / 100)?.[1] || '#22c55e';

  return (
    <div className="flex flex-col items-center">
      <svg width="80" height="56" viewBox="0 0 80 56">
        <path d="M 10 48 A 30 30 0 0 1 70 48" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" strokeLinecap="round" />
        <path
          d="M 10 48 A 30 30 0 0 1 70 48"
          fill="none"
          stroke={c}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${pct * 94} 94`}
        />
      </svg>
      <span className="font-mono text-xs font-bold mt-1 tabular-nums" style={{ color: c }}>
        {value.toLocaleString()}{unit}
      </span>
      <span className="font-sans text-[9px] text-zinc-600 mt-0.5 uppercase tracking-wider">{label}</span>
    </div>
  );
}

function TimeSeries({ data, width, height, color }: { data: number[]; width: number; height: number; color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || data.length < 2) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    c.width = width;
    c.height = height;
    ctx.clearRect(0, 0, width, height);

    const max = Math.max(...data, 1);
    const stepX = (width - 20) / (data.length - 1);

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = 10 + i * stepX;
      const y = height - 10 - (d / max) * (height - 30);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill area
    ctx.lineTo(10 + (data.length - 1) * stepX, height - 10);
    ctx.lineTo(10, height - 10);
    ctx.closePath();
    ctx.fillStyle = `${color}15`;
    ctx.fill();
  }, [data, width, height, color]);

  return <canvas ref={canvasRef} width={width} height={height} className="w-full" />;
}

function DonutChart({ segments, size }: { segments: { label: string; value: number; color: string }[]; size: number }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  let cumulative = -Math.PI / 2;
  const r = size / 2 - 4;
  const inner = r * 0.55;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((seg, i) => {
        const a = (seg.value / total) * Math.PI * 2;
        const x1 = size / 2 + r * Math.cos(cumulative);
        const y1 = size / 2 + r * Math.sin(cumulative);
        const x2 = size / 2 + r * Math.cos(cumulative + a);
        const y2 = size / 2 + r * Math.sin(cumulative + a);
        const large = a > Math.PI ? 1 : 0;
        const ix1 = size / 2 + inner * Math.cos(cumulative);
        const iy1 = size / 2 + inner * Math.sin(cumulative);
        const ix2 = size / 2 + inner * Math.cos(cumulative + a);
        const iy2 = size / 2 + inner * Math.sin(cumulative + a);
        const path = `M ${ix1} ${iy1} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${inner} ${inner} 0 ${large} 0 ${ix1} ${iy1} Z`;
        cumulative += a;
        return <path key={i} d={path} fill={seg.color} opacity={0.85} />;
      })}
      <text x={size / 2} y={size / 2 - 6} textAnchor="middle" className="font-mono text-xs font-bold" fill="#fff">
        {total.toLocaleString()}
      </text>
      <text x={size / 2} y={size / 2 + 8} textAnchor="middle" className="font-sans" fontSize="8" fill="#71717a">TOTAL</text>
    </svg>
  );
}

function StatWidget({ label, value, color, sub }: { label: string; value: number | string; color: string; sub?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="font-sans text-[10px] uppercase tracking-wider text-zinc-500 mb-1">{label}</p>
      <p className="font-mono text-xl font-bold tabular-nums" style={{ color }}>{value}</p>
      {sub && <p className="font-sans text-[9px] text-zinc-600 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const { chain } = useChain();
  const navigate = useNavigate();
  const { connected: solConnected } = useWallet();
  const { isConnected: evmConnected } = useAccount();
  const connected = chain === 'solana' ? solConnected : evmConnected;

  const sol = useBastionProgram();
  const sidecar = useSidecar();
  const { events: sseEvents, connected: sseConnected } = useAgentEvents();
  const { agents: trackedAgents, fetchAgents: fetchSidecarAgents } = useAgents();
  const [history, setHistory] = useState<number[]>(Array(30).fill(0));
  const [dataSource, setDataSource] = useState<'network' | 'sidecar'>('network');
  const [onChainAgents, setOnChainAgents] = useState<any[]>([]);
  const [onChainAudits, setOnChainAudits] = useState<AuditEntryData[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const networkLastFetch = useRef(0);
  const [onChainStats, setOnChainStats] = useState<StatsData | null>(null);

  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'policy' | 'cases'>('overview');
  const [logs, setLogs] = useState<AuditEntryData[]>([]);
  const [policy, setPolicy] = useState<PolicyData | null>(null);
  const [stats, setStats] = useState<StatsData>({ total: 0, allowed: 0, blocked: 0 });
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [txPending, setTxPending] = useState(false);
  const [sidecarOnline, setSidecarOnline] = useState<boolean | null>(null);
  const [mcpOnline, setMcpOnline] = useState<boolean | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);

  const [editingPolicy, setEditingPolicy] = useState(false);
  const [policyForm, setPolicyForm] = useState({ maxSolPerTx: 1, rateLimitPerMinute: 120, allowedProgramsText: '' });

  const loadNetworkData = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && networkLastFetch.current > 0 && now - networkLastFetch.current < 60000) {
      return; // Cache hit — skip fetch if < 60s old
    }
    setLoadingAgents(true);
    try {
      const [stats, agents, audits] = await Promise.all([
        sol.fetchStats(),
        sol.fetchAgents(),
        sol.fetchAllAudits(15), // Reduced: 15 instead of 50 for network view
      ]);
      if (stats) { setStats(stats); setHistory((h) => [...h.slice(-29), stats.total]); }
      if (agents) { setOnChainAgents(agents); networkLastFetch.current = now; }
      if (audits) { setOnChainAudits(audits); setLogs(audits); }
    } finally {
      setLoadingAgents(false);
      setLoading(false);
    }
  }, [sol]); // Removed onChainAgents — was creating infinite loop

  const loadSidecarData = useCallback(async () => {
    setLoading(true);
    const sh = await sidecar.fetchHealth();
    setSidecarOnline(sh);
    try {
      const mcpRes = await fetch('http://localhost:3001/mcp/health');
      setMcpOnline(mcpRes.ok);
    } catch { setMcpOnline(false); }
    if (sh) {
      const [s, l, pol, pend] = await Promise.all([sidecar.fetchStats(), sidecar.fetchLogs(50), sidecar.fetchPolicy(), sidecar.fetchPending()]);
      fetchSidecarAgents();
      if (s) { setStats(s); setHistory((h) => [...h.slice(-29), s.total]); }
      if (l) setLogs(l.entries.map((e) => ({ id: String(e.id), timestamp: e.timestamp, decision: e.result === 'ALLOWED' ? 'ALLOWED' : 'BLOCKED', account: e.transaction_details?.signature ?? '', intent: e.intent ?? 'No description', reason: e.reasoning })));
      if (pol) { setPolicy(pol as any); setPolicyForm({ maxSolPerTx: (pol as any).max_sol_per_tx ?? 1, rateLimitPerMinute: (pol as any).rate_limit_per_minute ?? 120, allowedProgramsText: (pol as any).allowed_programs?.join('\n') ?? '' }); }
      if (pend) setPendingApprovals(pend);
    }
    setLoading(false);
  }, [sidecar]); // Removed fetchSidecarAgents — identity changes every render

  const loadData = useCallback(async () => {
    if (dataSource === 'network') {
      await loadNetworkData();
    } else {
      await loadSidecarData();
      if (sol?.program) {
        const paused = await sol.fetchPaused();
        if (paused !== null) setIsPaused(paused);
      }
    }
  }, [dataSource]); // Only re-evaluate when dataSource changes — loadNetworkData/loadSidecarData are stable via useCallback

  useEffect(() => {
    if (!connected) { navigate('/'); return; }
    loadData();
    // Network mode: refresh every 2 minutes (60s cache + 1 refresh) to avoid RPC spam
    // Sidecar mode: refresh every 30 seconds (local, fast)
    const interval = dataSource === 'network' ? 120000 : 30000;
    const iv = setInterval(loadData, interval);
    return () => clearInterval(iv);
  }, [connected, navigate, loadData, dataSource]);

  const handlePause = useCallback(async () => {
    if (chain !== 'solana') return;
    setTxPending(true);
    const sig = isPaused ? await sol.emergencyResume() : await sol.emergencyPause();
    if (sig) { setIsPaused(!isPaused); setTimeout(loadData, 2000); }
    setTxPending(false);
  }, [isPaused, sol, loadData, chain]);

  const handleSavePolicy = useCallback(async () => {
    if (chain !== 'solana') return;
    setTxPending(true);
    const programs = policyForm.allowedProgramsText.split('\n').map((p) => p.trim()).filter((p) => p.length > 0);
    await sidecar.updatePolicy({ max_sol_per_tx: policyForm.maxSolPerTx, max_balance_drain_lamports: null, rate_limit_per_minute: policyForm.rateLimitPerMinute, allowed_programs: programs, blocked_addresses: [], simulation_checks_enabled: true });
    try { await sol.updatePolicy(programs, policyForm.maxSolPerTx, policyForm.rateLimitPerMinute); } catch { /* ok */ }
    setPolicy({ maxSolPerTx: policyForm.maxSolPerTx, rateLimit: policyForm.rateLimitPerMinute, allowedPrograms: programs });
    setEditingPolicy(false); setTxPending(false); setTimeout(loadData, 2000);
  }, [policyForm, sol, sidecar, loadData, chain]);

  const handleOverride = useCallback(async (blockId: string, action: 'ALLOW' | 'REJECT') => {
    setTxPending(true);
    await sidecar.overrideBlock(blockId, action);
    setTimeout(loadData, 1000);
    setTxPending(false);
  }, [sidecar, loadData]);

  const blockRate = stats.total > 0 ? (stats.blocked / stats.total * 100) : 0;

  // Build agent floor data from tracked agents (sidecar registry)
  const agentEntities = useMemo(() => {
    if (dataSource === 'network' && onChainAgents.length > 0) {
      return onChainAgents.map((a: any, i: number) => ({
        id: a.did || `agent-${i}`,
        name: a.name?.slice(0, 12) || a.authority?.slice(0, 8) || `?`,
        x: (i * 3 + 2) % 24,
        y: Math.floor(i / 6) * 3 + 2,
        status: ((a.capabilityBitmask || 0) & 0b00000010 ? 'walking' as const : 'idle' as const),
        intent: a.name || '',
        reputation: a.reputationScore || 0,
      }));
    }
    if (trackedAgents.length > 0) {
      return trackedAgents.map((a: TrackedAgent, i: number) => ({
        id: a.did,
        name: a.name,
        x: (i * 3 + 2) % 24,
        y: Math.floor(i / 6) * 3 + 2,
        status: (a.capability_bitmask & 0b00000010 ? 'walking' as const : 'idle' as const),
        intent: a.name,
        reputation: a.reputation_score,
      }));
    }
    return (sseEvents.length > 0 ? sseEvents : logs)
      .filter((l: any, i: number) => (l.agent_id || l.account) && i < 20)
      .map((l: any, i: number) => ({
        id: l.agent_id || l.account || `agent-${i}`,
        name: (l.agent_id || l.account || `?`).slice(0, 8),
        x: (i * 3 + 2) % 24,
        y: Math.floor(i / 6) * 3 + 2,
        status: (l.decision === 'ALLOWED' ? 'idle' as const : l.decision === 'BLOCKED' ? 'waiting' as const : 'walking' as const),
        intent: l.intent || '',
        reputation: l.decision === 'ALLOWED' ? 85 : 40,
      }));
  }, [dataSource, onChainAgents, trackedAgents, sseEvents, logs]);

  const inputStyle = (editable: boolean) => ({
    background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', opacity: editable ? 1 : 0.6,
  });

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-4 bg-black/80 backdrop-blur-md border-b border-white/[0.06]">
        <a href="/" className="font-serif text-lg tracking-tight no-underline text-white">Bastion<span className="text-[8px] align-super ml-px">&reg;</span></a>
        <div className="flex items-center gap-3">
          <span className="font-sans text-[10px] text-zinc-500">Sidecar: <span style={{ color: sidecarOnline ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{sidecarOnline === null ? '...' : sidecarOnline ? 'ON' : 'OFF'}</span></span>
          <span className="font-sans text-[10px] text-zinc-500">MCP: <span style={{ color: mcpOnline ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{mcpOnline === null ? '...' : mcpOnline ? 'ON' : 'OFF'}</span></span>
          <button
            onClick={() => setDataSource(d => d === 'network' ? 'sidecar' : 'network')}
            className="px-2 py-0.5 rounded-full text-[10px] font-sans font-semibold border transition-colors"
            style={dataSource === 'network'
              ? { background: 'rgba(59,130,246,0.1)', color: '#60a5fa', borderColor: 'rgba(59,130,246,0.2)' }
              : { background: 'rgba(34,197,94,0.1)', color: '#22c55e', borderColor: 'rgba(34,197,94,0.2)' }}
          >
            {dataSource === 'network' ? 'NETWORK' : 'MY SIDECAR'}
          </button>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-sans font-semibold border" style={isPaused ? { background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' } : { background: 'rgba(34,197,94,0.1)', color: '#22c55e', borderColor: 'rgba(34,197,94,0.2)' }}>{isPaused ? 'PAUSED' : 'LIVE'}</span>
          <span className="font-sans text-[10px] text-zinc-600">30s</span>
          {chain === 'solana' ? <WalletMultiButton /> : <div className="[&_button]:!rounded-full [&_button]:!text-xs"><ConnectButton showBalance={false} accountStatus="address" chainStatus="none" /></div>}
        </div>
      </nav>

      <main className="pt-32 px-4 pb-8">
        {/* Row 1: Gauges */}
        <div className="grid grid-cols-5 gap-3 mb-4 max-w-7xl mx-auto">
          <StatWidget label="Active Agents" value={trackedAgents.length || agentEntities.length} color="#3b82f6" sub={trackedAgents.length > 0 ? `${trackedAgents.length} registered` : 'from events'} />
          <div className="rounded-xl p-4 flex flex-col items-center justify-center" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Gauge value={stats.total} max={Math.max(stats.total * 2 || 10, 10)} label="Total Audits" unit="" colorScale={[[30, '#22c55e'], [60, '#f59e0b'], [80, '#ef4444']]} />
          </div>
          <div className="rounded-xl p-4 flex flex-col items-center justify-center" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Gauge value={Math.round(blockRate)} max={100} label="Block Rate" unit="%" colorScale={[[20, '#22c55e'], [50, '#f59e0b'], [75, '#ef4444']]} />
          </div>
          <StatWidget label="Allowed" value={stats.allowed} color="#22c55e" />
          <StatWidget label="Blocked" value={stats.blocked} color="#ef4444" />
          <StatWidget label="Total Staked" value={`${trackedAgents.reduce((s, a) => s + (a.staked_lamports || 0), 0).toLocaleString()} SOL`} color="#f59e0b" />
        </div>

        {/* Pending approvals */}
        {pendingApprovals.length > 0 && (
          <div className="max-w-7xl mx-auto mb-4 rounded-xl p-3" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <div className="flex flex-wrap gap-2">
              <span className="font-sans text-[10px] font-medium text-amber-400">PENDING ({pendingApprovals.length})</span>
              {pendingApprovals.slice(0, 3).map((pa: any) => (
                <span key={pa.block_id} className="font-mono text-[9px] text-zinc-400">{pa.block_id?.slice(0, 8)}... {pa.intent?.slice(0, 20)}</span>
              ))}
              {pendingApprovals.length > 3 && <span className="font-mono text-[9px] text-zinc-600">+{pendingApprovals.length - 3} more</span>}
            </div>
          </div>
        )}

        {/* Row 2: Time Series + Agent Floor */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-w-7xl mx-auto mb-4">
          <div className="rounded-xl p-4" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="font-sans text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Events per minute</p>
            <TimeSeries data={history.length > 1 ? history : [0, 1]} width={400} height={140} color="#3b82f6" />
          </div>
          <div className="rounded-xl p-4" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="font-sans text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Agent Fleet Visualizer</p>
            <AgentFloor agents={agentEntities} width={480} height={300} />
          </div>
        </div>

        {/* Row 3: Donut Charts */}
        <div className="grid grid-cols-4 gap-3 max-w-7xl mx-auto mb-4">
          <div className="rounded-xl p-4 flex flex-col items-center" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="font-sans text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Decisions</p>
            <DonutChart size={100} segments={[
              { label: 'Allowed', value: stats.allowed, color: '#22c55e' },
              { label: 'Blocked', value: stats.blocked, color: '#ef4444' },
              { label: 'Pending', value: pendingApprovals.length, color: '#f59e0b' },
            ]} />
          </div>
          <div className="rounded-xl p-4 flex flex-col items-center" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="font-sans text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Agent Health</p>
            <DonutChart size={100} segments={
              trackedAgents.length > 0
                ? [
                    { label: 'Healthy', value: trackedAgents.filter(a => a.reputation_score >= 70).length, color: '#22c55e' },
                    { label: 'At Risk', value: trackedAgents.filter(a => a.reputation_score >= 40 && a.reputation_score < 70).length, color: '#f59e0b' },
                    { label: 'Critical', value: trackedAgents.filter(a => a.reputation_score < 40).length, color: '#ef4444' },
                  ]
                : [
                    { label: 'Info', value: Math.floor(stats.total * 0.6), color: '#3b82f6' },
                    { label: 'Med', value: Math.floor(stats.total * 0.25), color: '#f59e0b' },
                    { label: 'High', value: Math.floor(stats.total * 0.1), color: '#ef7d44' },
                    { label: 'Critical', value: Math.floor(stats.total * 0.05), color: '#ef4444' },
                  ]
            } />
          </div>
          <div className="rounded-xl p-4 flex flex-col items-center" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="font-sans text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Policy Rules</p>
            <DonutChart size={100} segments={[
              { label: 'Allowlist', value: policy?.allowedPrograms?.length ? stats.allowed : 0, color: '#22c55e' },
              { label: 'Rate Limit', value: stats.blocked > 0 ? stats.blocked : 1, color: '#a855f7' },
              { label: 'Value Cap', value: 0, color: '#f59e0b' },
              { label: 'StakeWeighted', value: trackedAgents.filter(a => a.staked_lamports > 0).length || 1, color: '#f59e0b' },
            ]} />
          </div>
          <div className="rounded-xl p-4 flex flex-col items-center" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="font-sans text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Source Chain</p>
            <DonutChart size={100} segments={trackedAgents.length > 0 ? (() => {
              const sol = trackedAgents.filter(a => a.did.includes(':solana:')).length;
              const mid = trackedAgents.filter(a => a.did.includes(':midnight:')).length;
              const seg: {label:string;value:number;color:string}[] = [
                sol > 0 ? { label: 'Solana', value: sol, color: '#9945FF' } : null,
                mid > 0 ? { label: 'Midnight', value: mid, color: '#7C3AED' } : null,
              ].filter(Boolean) as {label:string;value:number;color:string}[];
              return seg.length > 0 ? seg : [{ label: 'Solana', value: stats.total, color: '#9945FF' }];
            })() : [{ label: 'Solana', value: stats.total, color: '#9945FF' }]} />
          </div>
        </div>

        {/* Registered Agents */}
        <div className="max-w-7xl mx-auto mb-4 rounded-xl p-4" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="font-sans text-[10px] uppercase tracking-wider text-zinc-500">Registered Agents ({trackedAgents.length})</p>
          </div>
          {trackedAgents.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {trackedAgents.map((agent) => {
                const scorePct = Math.min(agent.reputation_score / 100, 1);
                const scoreColor = scorePct > 0.7 ? '#22c55e' : scorePct > 0.4 ? '#f59e0b' : '#ef4444';
                return (
                  <button
                    key={agent.did}
                    onClick={() => navigate(`/agents/${encodeURIComponent(agent.did)}`)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors hover:opacity-80"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', minWidth: 200 }}
                  >
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: scoreColor }} />
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] text-zinc-200 truncate">{agent.name}</p>
                      <p className="font-mono text-[8px] text-zinc-600 truncate">{agent.did.split(':').pop()?.slice(0, 12)}...</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="font-sans text-xs text-zinc-600">No agents registered yet. Agents self-register via POST /agents with their DID.</p>
          )}
        </div>

        {/* Row 4: Data Tables */}
        <div className="max-w-7xl mx-auto mb-6">
          <div className="flex gap-1 mb-3 p-1 rounded-lg w-fit" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.04)' }}>
            {['overview', 'logs', 'policy', 'cases'].map((t) => (
              <button key={t} onClick={() => setActiveTab(t as any)}
                className="px-4 py-2 rounded-md font-sans text-xs font-medium transition-colors"
                style={activeTab === t ? { background: '#fff', color: '#000' } : { background: 'transparent', color: '#71717a' }}>
                {t === 'overview' ? 'Overview' : t === 'logs' ? 'Audit Logs' : t === 'policy' ? 'Policy' : 'Cases'}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <div className="rounded-xl p-6" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="font-sans text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Architecture</p>
                  <div className="space-y-2 font-mono text-[10px] text-zinc-400">
                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full shrink-0" style={{background:'#22c55e'}}/> Sidecar API <span className="text-zinc-600">:3000</span></div>
                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full shrink-0" style={{background:'#3b82f6'}}/> Solana On-Chain <span className="text-zinc-600">devnet</span></div>
                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full shrink-0" style={{background:'#a855f7'}}/> Agent Registry <span className="text-zinc-600">{trackedAgents.length} agents</span></div>
                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full shrink-0" style={{background:'#f59e0b'}}/> DID Resolution <span className="text-zinc-600">/did</span></div>
                  </div>
                </div>
                <div>
                  <p className="font-sans text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Program</p>
                  <div className="space-y-2 font-mono text-[10px] text-zinc-400">
                    <div>ID: <span className="text-zinc-500">A29V5MUV...n9D</span></div>
                    <div>Network: <span className="text-zinc-500">devnet</span></div>
                    <div>Audit Entries: <span className="text-zinc-500">{stats.total}</span></div>
                    <div>Refresh: <span className="text-zinc-500">30s</span></div>
                  </div>
                </div>
              </div>
              {pendingApprovals.length > 0 && (
                <div className="rounded-lg p-3" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)' }}>
                  <p className="font-sans text-[10px] text-amber-400 mb-1">Pending Approvals</p>
                  {pendingApprovals.slice(0, 5).map((pa: any) => (
                    <div key={pa.block_id} className="flex items-center gap-2 font-mono text-[9px] text-zinc-400">
                      <span className="text-zinc-600">{pa.block_id?.slice(0, 8)}</span>
                      <span>{pa.intent?.slice(0, 40)}</span>
                      <div className="flex gap-1 ml-auto">
                        <button onClick={() => handleOverride(pa.block_id, 'ALLOW')} className="px-2 py-0.5 rounded text-green-400 hover:bg-green-400/10">Allow</button>
                        <button onClick={() => handleOverride(pa.block_id, 'REJECT')} className="px-2 py-0.5 rounded text-red-400 hover:bg-red-400/10">Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="rounded-xl overflow-hidden" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.04)' }}>
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-white/[0.04] text-zinc-500">
                    <th className="py-2 px-4 font-normal">Time</th>
                    <th className="py-2 px-4 font-normal">Decision</th>
                    <th className="py-2 px-4 font-normal">Agent</th>
                    <th className="py-2 px-4 font-normal">Intent</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.slice(0, 25).map((l) => (
                    <tr key={l.id} className="border-b border-white/[0.02] hover:bg-white/[0.02]">
                      <td className="py-1.5 px-4 text-zinc-500">{l.timestamp > 10000000000 ? new Date(l.timestamp * 1000).toLocaleTimeString() : new Date(l.timestamp).toLocaleTimeString()}</td>
                      <td className="py-1.5 px-4"><span style={{ color: DECISION_COLORS[l.decision] || '#71717a' }}>{l.decision}</span></td>
                      <td className="py-1.5 px-4 text-zinc-500">{l.account?.slice(0, 10)}...</td>
                      <td className="py-1.5 px-4 text-zinc-400">{l.intent?.slice(0, 40)}</td>
                    </tr>
                  ))}
                  {logs.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-zinc-600">No audit entries yet.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'policy' && (
            <div className="max-w-lg space-y-4">
              <div><label className="block font-sans text-sm font-medium mb-1.5 text-zinc-300">Max SOL per Tx</label><input type="number" min="0" step="0.1" value={editingPolicy ? policyForm.maxSolPerTx : (policy?.maxSolPerTx ?? 0)} onChange={(e) => setPolicyForm((p) => ({ ...p, maxSolPerTx: Number(e.target.value) }))} readOnly={!editingPolicy} className="w-full p-2.5 rounded-lg font-mono text-sm outline-none" style={inputStyle(editingPolicy)} /></div>
              <div><label className="block font-sans text-sm font-medium mb-1.5 text-zinc-300">Rate Limit (tx/min)</label><input type="number" min="1" value={editingPolicy ? policyForm.rateLimitPerMinute : (policy?.rateLimit ?? 0)} onChange={(e) => setPolicyForm((p) => ({ ...p, rateLimitPerMinute: Number(e.target.value) }))} readOnly={!editingPolicy} className="w-full p-2.5 rounded-lg font-mono text-sm outline-none" style={inputStyle(editingPolicy)} /></div>
              <div><label className="block font-sans text-sm font-medium mb-1.5 text-zinc-300">Allowed Programs</label><textarea rows={4} value={editingPolicy ? policyForm.allowedProgramsText : (policy?.allowedPrograms?.join('\n') ?? '')} onChange={(e) => setPolicyForm((p) => ({ ...p, allowedProgramsText: e.target.value }))} readOnly={!editingPolicy} className="w-full p-2.5 rounded-lg font-mono text-sm resize-y outline-none" style={inputStyle(editingPolicy)} /></div>
              <div className="flex gap-3">
                {!editingPolicy && <button onClick={() => setEditingPolicy(true)} className="px-8 py-2.5 rounded-xl font-sans text-sm font-medium bg-white text-black hover:bg-zinc-200 transition-colors">Edit</button>}
                {editingPolicy && (<><button onClick={handleSavePolicy} disabled={txPending} className="px-8 py-2.5 rounded-xl font-sans text-sm font-medium bg-green-600 text-white hover:bg-green-500 transition-colors disabled:opacity-50">Save</button><button onClick={() => setEditingPolicy(false)} className="px-8 py-2.5 rounded-xl font-sans text-sm font-medium bg-zinc-900 text-zinc-400 border border-zinc-800">Cancel</button></>)}
              </div>
              {chain === 'solana' && (
                <button onClick={handlePause} disabled={txPending} className="w-full py-3 rounded-xl font-sans font-semibold text-sm hover:opacity-90 disabled:opacity-50" style={isPaused ? { background: '#22c55e', color: '#fff' } : { background: '#ef4444', color: '#fff' }}>{txPending ? 'Processing...' : isPaused ? 'Resume Protocol' : 'Pause Protocol (Emergency)'}</button>
              )}
            </div>
          )}

          {activeTab === 'cases' && (
            <div className="rounded-xl p-6" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.04)' }}>
              <p className="font-sans text-sm text-zinc-300 mb-2">Investigation Cases</p>
              <p className="font-sans text-xs text-zinc-500 mb-4">Manage investigations linked to agent DIDs and audit events.</p>
              {trackedAgents.length > 0 ? (
                <div className="space-y-2 font-mono text-[10px] text-zinc-500">
                  <p>Agents with investigation capability:</p>
                  {trackedAgents.map(a => (
                    <div key={a.did} className="flex items-center gap-2">
                      <span className="text-zinc-600">{a.did.split(':').pop()?.slice(0, 10)}</span>
                      <span>{a.name}</span>
                      <span className="ml-auto text-zinc-600">{a.reputation_score}/100</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="font-sans text-xs text-zinc-600">No agents registered. Register agents via POST /agents to create investigation cases.</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="max-w-7xl mx-auto pt-6 border-t border-white/[0.06] text-center">
          <p className="font-sans text-[10px] text-zinc-600">Built on Daemon BlockInt Technologies. Bastion v0.3.0. Apache 2.0. Auto-refresh: 30s.</p>
        </footer>
      </main>
    </div>
  );
}
