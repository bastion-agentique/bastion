import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useChain } from '../context/ChainContext';
import { useBastionProgram, type AuditEntryData, type PolicyData, type StatsData } from '../hooks/useBastionProgram';
import { useSidecar } from '../hooks/useSidecar';

const DECISION_COLORS: Record<string, { text: string; border: string }> = {
  ALLOWED: { text: '#22c55e', border: '#22c55e' },
  BLOCKED: { text: '#ef4444', border: '#ef4444' },
  PENDING: { text: '#f59e0b', border: '#f59e0b' },
};

const DEFAULT_DECISION = { text: '#71717a', border: '#71717a' };

export default function Dashboard() {
  const { chain } = useChain();
  const navigate = useNavigate();

  const { connected: solConnected } = useWallet();
  const { isConnected: evmConnected } = useAccount();
  const connected = chain === 'solana' ? solConnected : evmConnected;

  const sol = useBastionProgram();
  const sidecar = useSidecar();

  const [activeTab, setActiveTab] = useState<'logs' | 'policy'>('logs');
  const [logs, setLogs] = useState<AuditEntryData[]>([]);
  const [policy, setPolicy] = useState<PolicyData | null>(null);
  const [stats, setStats] = useState<StatsData>({ total: 0, allowed: 0, blocked: 0 });
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [txPending, setTxPending] = useState(false);
  const [sidecarOnline, setSidecarOnline] = useState<boolean | null>(null);

  const [editingPolicy, setEditingPolicy] = useState(false);
  const [policyForm, setPolicyForm] = useState({
    maxSolPerTx: 1,
    rateLimitPerMinute: 120,
    allowedProgramsText: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const sidecarHealth = await sidecar.fetchHealth();
    setSidecarOnline(sidecarHealth);

    if (sidecarHealth) {
      const [s, l, pol] = await Promise.all([
        sidecar.fetchStats(),
        sidecar.fetchLogs(50),
        sidecar.fetchPolicy(),
      ]);
      if (s) setStats(s);
      if (l) {
        setLogs(
          l.entries.map((e) => ({
            id: String(e.id),
            timestamp: e.timestamp,
            decision: e.result === 'ALLOWED' ? 'ALLOWED' : 'BLOCKED',
            account: e.transaction_details?.signature ?? '',
            intent: e.intent ?? 'No description',
            reason: e.reasoning,
          })),
        );
      }
      if (pol) {
        setPolicy({ maxSolPerTx: pol.max_sol_per_tx ?? 0, rateLimit: pol.rate_limit_per_minute ?? 0, allowedPrograms: pol.allowed_programs });
        setPolicyForm({ maxSolPerTx: pol.max_sol_per_tx ?? 1, rateLimitPerMinute: pol.rate_limit_per_minute ?? 120, allowedProgramsText: pol.allowed_programs.join('\n') });
      }
      setLoading(false);
      return;
    }

    if (chain === 'solana') {
      const [s, p, l, pol] = await Promise.all([sol.fetchStats(), sol.fetchPaused(), sol.fetchAuditEntries(50), sol.fetchPolicy()]);
      if (s) setStats(s);
      if (p !== null) setIsPaused(p);
      if (l) setLogs(l);
      if (pol) {
        setPolicy(pol);
        setPolicyForm({ maxSolPerTx: pol.maxSolPerTx, rateLimitPerMinute: pol.rateLimit, allowedProgramsText: pol.allowedPrograms.join('\n') });
      }
    }
    setLoading(false);
  }, [chain, sol, sidecar]);

  useEffect(() => {
    if (!connected) { navigate('/'); return; }
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [connected, navigate, loadData]);

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
    await sidecar.updatePolicy({
      max_sol_per_tx: policyForm.maxSolPerTx, max_balance_drain_lamports: null,
      rate_limit_per_minute: policyForm.rateLimitPerMinute, allowed_programs: programs,
      blocked_addresses: [], simulation_checks_enabled: true,
    });
    try { await sol.updatePolicy(programs, policyForm.maxSolPerTx, policyForm.rateLimitPerMinute); } catch { /* ok */ }
    setPolicy({ maxSolPerTx: policyForm.maxSolPerTx, rateLimit: policyForm.rateLimitPerMinute, allowedPrograms: programs });
    setEditingPolicy(false);
    setTxPending(false);
    setTimeout(loadData, 2000);
  }, [policyForm, sol, sidecar, loadData, chain]);

  const inputStyle = (editable: boolean) => ({
    background: '#0a0a0a',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#fff',
    opacity: editable ? 1 : 0.6,
  });

  const cardBg = { background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)' };

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      {/* ── Navbar ── */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-8 py-5 bg-black/80 backdrop-blur-md border-b border-white/[0.06]">
        <a href="/" className="flex items-center gap-2 font-serif text-xl tracking-tight no-underline text-white">
          Bastion<span className="text-[10px] align-super ml-px">&reg;</span>
        </a>
        <div className="flex items-center gap-4">
          <span className="font-sans text-xs text-zinc-500">
            Sidecar: <span style={{ color: sidecarOnline ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{sidecarOnline === null ? '...' : sidecarOnline ? 'ONLINE' : 'OFFLINE'}</span>
          </span>
          <span className="px-3 py-1 rounded-full text-[11px] font-sans font-semibold border" style={isPaused ? { background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' } : { background: 'rgba(34,197,94,0.1)', color: '#22c55e', borderColor: 'rgba(34,197,94,0.2)' }}>
            {loading ? '...' : isPaused ? 'PAUSED' : 'LIVE'}
          </span>
          {chain === 'solana' ? <WalletMultiButton /> : <div className="[&_button]:!rounded-full [&_button]:!text-sm"><ConnectButton showBalance={false} accountStatus="address" chainStatus="none" /></div>}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 pt-[100px] pb-20">
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="font-serif text-3xl tracking-tight" style={{ fontWeight: 400, letterSpacing: '-0.5px' }}>Firewall Dashboard</h1>
            <p className="font-sans text-sm mt-1 text-zinc-500">Multichain AI Agent Firewall — v0.3.0</p>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
          {[
            { label: 'Total Audits', value: stats.total, color: '#fff' },
            { label: 'Allowed', value: stats.allowed, color: '#22c55e' },
            { label: 'Blocked', value: stats.blocked, color: '#ef4444' },
            { label: 'Block Rate', value: stats.total > 0 ? `${((stats.blocked / stats.total) * 100).toFixed(1)}%` : '0%', color: '#f59e0b' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl p-5" style={cardBg}>
              <p className="font-sans text-[11px] uppercase tracking-wider text-zinc-500 mb-2">{stat.label}</p>
              <p className="font-mono text-2xl font-bold tabular-nums" style={{ color: stat.color }}>{loading ? '...' : stat.value}</p>
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 mb-8 p-1 rounded-xl w-fit" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)' }} role="tablist">
          {[
            { key: 'logs' as const, label: 'Audit Logs' },
            { key: 'policy' as const, label: 'Policy' },
          ].map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="px-5 py-2.5 rounded-lg font-sans text-sm font-medium transition-all duration-150"
              style={activeTab === tab.key ? { background: '#fff', color: '#000' } : { background: 'transparent', color: '#71717a' }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="rounded-2xl p-6" style={cardBg} role="tabpanel">
          {loading && <p className="font-sans text-center py-16 text-zinc-500">Loading data...</p>}

          {!loading && activeTab === 'logs' && (
            <div className="space-y-2">
              {logs.length === 0 ? (
                <div className="text-center py-16">
                  <p className="font-sans text-sm text-zinc-500 mb-2">No audit entries yet.</p>
                  <p className="font-sans text-xs text-zinc-600">Start the sidecar with /simulate to see entries here.</p>
                </div>
              ) : (
                logs.map((log) => {
                  const colors = DECISION_COLORS[log.decision] ?? DEFAULT_DECISION;
                  return (
                    <div key={log.id} className="p-4 rounded-xl" style={{ background: '#000', border: '1px solid rgba(255,255,255,0.04)', borderLeft: `3px solid ${colors.border}` }}>
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-xs font-semibold" style={{ color: colors.text }}>{log.decision}</span>
                        <span className="font-mono text-xs text-zinc-600">
                          {log.timestamp > 10000000000 ? new Date(log.timestamp * 1000).toLocaleTimeString() : new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="font-sans text-sm mt-1.5 text-zinc-300">{log.intent}</p>
                      {log.account && <p className="font-mono text-xs mt-1 text-zinc-600">{log.account.slice(0, 16)}...</p>}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {!loading && activeTab === 'policy' && (
            <div className="space-y-6 max-w-lg">
              {chain !== 'solana' && <p className="font-sans text-sm text-zinc-500">Policy management is available on Solana. EVM support is coming soon.</p>}

              <div>
                <label className="block font-sans text-sm font-medium mb-2 text-zinc-300">Max SOL per Transaction</label>
                <input type="number" min="0" step="0.1" value={editingPolicy ? policyForm.maxSolPerTx : (policy?.maxSolPerTx ?? 0)} onChange={(e) => setPolicyForm((p) => ({ ...p, maxSolPerTx: Number(e.target.value) }))} readOnly={!editingPolicy} className="w-full p-3 rounded-lg font-mono text-sm outline-none" style={inputStyle(editingPolicy)} />
              </div>

              <div>
                <label className="block font-sans text-sm font-medium mb-2 text-zinc-300">Rate Limit (tx/min)</label>
                <input type="number" min="1" value={editingPolicy ? policyForm.rateLimitPerMinute : (policy?.rateLimit ?? 0)} onChange={(e) => setPolicyForm((p) => ({ ...p, rateLimitPerMinute: Number(e.target.value) }))} readOnly={!editingPolicy} className="w-full p-3 rounded-lg font-mono text-sm outline-none" style={inputStyle(editingPolicy)} />
              </div>

              <div>
                <label className="block font-sans text-sm font-medium mb-2 text-zinc-300">Allowed Programs (one per line)</label>
                <textarea rows={5} value={editingPolicy ? policyForm.allowedProgramsText : (policy?.allowedPrograms?.join('\n') ?? '')} onChange={(e) => setPolicyForm((p) => ({ ...p, allowedProgramsText: e.target.value }))} readOnly={!editingPolicy} placeholder="Paste Solana program IDs" className="w-full p-3 rounded-lg font-mono text-sm resize-y outline-none" style={inputStyle(editingPolicy)} />
              </div>

              <div className="flex gap-3">
                {!editingPolicy && (
                  <button onClick={() => setEditingPolicy(true)} className="flex-1 py-3 rounded-xl font-sans font-semibold text-sm bg-white text-black hover:bg-zinc-200 transition-colors">Edit Policy</button>
                )}
                {editingPolicy && (
                  <>
                    <button onClick={handleSavePolicy} disabled={txPending} className="flex-1 py-3 rounded-xl font-sans font-semibold text-sm bg-green-600 text-white hover:bg-green-500 transition-colors disabled:opacity-50">{txPending ? 'Saving...' : 'Save Policy'}</button>
                    <button onClick={() => setEditingPolicy(false)} disabled={txPending} className="flex-1 py-3 rounded-xl font-sans font-semibold text-sm bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-600 transition-colors disabled:opacity-50">Cancel</button>
                  </>
                )}
              </div>

              {chain === 'solana' && (
                <button onClick={handlePause} disabled={txPending} className="w-full py-3 rounded-xl font-sans font-semibold text-sm transition-all duration-150 hover:opacity-90 disabled:opacity-50"
                  style={isPaused ? { background: '#22c55e', color: '#fff' } : { background: '#ef4444', color: '#fff' }}>
                  {txPending ? 'Processing...' : isPaused ? 'Resume Protocol' : 'Pause Protocol (Emergency)'}
                </button>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
