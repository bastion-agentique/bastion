import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useTheme } from '../context/ThemeContext';
import { Navbar } from '../components/Navbar';
import { useBastionProgram, type AuditEntryData, type PolicyData, type StatsData } from '../hooks/useBastionProgram';

const DECISION_COLORS = {
  ALLOWED: { text: '#22c55e', border: '#22c55e' },
  BLOCKED: { text: '#ef4444', border: '#ef4444' },
  PENDING: { text: '#f59e0b', border: '#f59e0b' },
};

export default function Dashboard() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { connected } = useWallet();
  const {
    fetchStats,
    fetchPaused,
    fetchAuditEntries,
    fetchPolicy,
    emergencyPause,
    emergencyResume,
  } = useBastionProgram();

  const [activeTab, setActiveTab] = useState<'pending' | 'logs' | 'policy'>('logs');
  const [logs, setLogs] = useState<AuditEntryData[]>([]);
  const [policy, setPolicy] = useState<PolicyData | null>(null);
  const [stats, setStats] = useState<StatsData>({ total: 0, allowed: 0, blocked: 0 });
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [txPending, setTxPending] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [s, p, l, pol] = await Promise.all([
      fetchStats(),
      fetchPaused(),
      fetchAuditEntries(50),
      fetchPolicy(),
    ]);
    if (s) setStats(s);
    if (p !== null) setIsPaused(p);
    if (l) setLogs(l);
    if (pol) setPolicy(pol);
    setLoading(false);
  }, [fetchStats, fetchPaused, fetchAuditEntries, fetchPolicy]);

  useEffect(() => {
    if (!connected) {
      navigate('/');
      return;
    }
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [connected, navigate, loadData]);

  const handlePause = useCallback(async () => {
    setTxPending(true);
    const sig = isPaused ? await emergencyResume() : await emergencyPause();
    if (sig) {
      setIsPaused(!isPaused);
      setTimeout(loadData, 2000);
    }
    setTxPending(false);
  }, [isPaused, emergencyPause, emergencyResume, loadData]);

  const TABS = [
    { key: 'logs' as const, label: 'Audit Logs' },
    { key: 'policy' as const, label: 'Policy' },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 pb-20">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-serif text-3xl font-normal" style={{ color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
              Firewall Dashboard
            </h1>
            <p className="font-sans text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              AI Agent Firewall for Solana — v0.3.0
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className="px-3 py-1 rounded-full text-xs font-sans font-semibold border"
              style={isPaused
                ? { background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }
                : { background: 'rgba(34,197,94,0.1)', color: '#22c55e', borderColor: 'rgba(34,197,94,0.3)' }
              }
            >
              {loading ? '...' : isPaused ? 'PAUSED' : 'LIVE'}
            </span>
            <WalletMultiButton />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Audits', value: stats.total, color: 'var(--text-primary)' },
            { label: 'Allowed', value: stats.allowed, color: '#22c55e' },
            { label: 'Blocked', value: stats.blocked, color: '#ef4444' },
            {
              label: 'Block Rate',
              value: stats.total > 0 ? `${((stats.blocked / stats.total) * 100).toFixed(1)}%` : '0%',
              color: '#f59e0b',
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl p-4"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow)' }}
            >
              <p className="font-sans text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                {stat.label}
              </p>
              <p className="font-mono text-2xl font-bold tabular-nums" style={{ color: stat.color }}>
                {loading ? '...' : stat.value}
              </p>
            </div>
          ))}
        </div>

        <div
          className="flex gap-1 mb-6 p-1 rounded-xl w-fit"
          style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
          role="tablist"
          aria-label="Dashboard sections"
        >
          {TABS.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="px-4 py-2 rounded-lg font-sans text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              style={activeTab === tab.key
                ? { background: 'var(--accent)', color: '#ffffff' }
                : { background: 'transparent', color: 'var(--text-muted)' }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          className="rounded-2xl p-6"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow)' }}
          role="tabpanel"
        >
          {loading && (
            <p className="font-sans text-center py-12" style={{ color: 'var(--text-muted)' }}>
              Loading on-chain data...
            </p>
          )}

          {!loading && activeTab === 'logs' && (
            <div className="space-y-2">
              {logs.length === 0 ? (
                <p className="font-sans text-center py-12" style={{ color: 'var(--text-muted)' }}>
                  No audit entries yet. Deploy the program and start logging.
                </p>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-lg"
                    style={{
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border)',
                      borderLeft: `3px solid ${DECISION_COLORS[log.decision].border}`,
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-xs font-semibold" style={{ color: DECISION_COLORS[log.decision].text }}>
                        {log.decision}
                      </span>
                      <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                        {new Date(log.timestamp * 1000).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="font-sans text-sm mt-1" style={{ color: 'var(--text-primary)' }}>{log.intent}</p>
                    {log.account && (
                      <p className="font-mono text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{log.account}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {!loading && activeTab === 'policy' && (
            <div className="space-y-6 max-w-lg">
              <div>
                <label htmlFor="max-sol" className="block font-sans text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Max SOL per Transaction
                </label>
                <input
                  id="max-sol"
                  type="number"
                  min="0"
                  value={policy?.maxSolPerTx ?? 0}
                  readOnly
                  className="w-full p-3 rounded-lg font-mono text-sm"
                  style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-primary)', opacity: 0.7 }}
                />
              </div>

              <div>
                <label htmlFor="rate-limit" className="block font-sans text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Rate Limit (transactions per minute)
                </label>
                <input
                  id="rate-limit"
                  type="number"
                  min="1"
                  value={policy?.rateLimit ?? 0}
                  readOnly
                  className="w-full p-3 rounded-lg font-mono text-sm"
                  style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-primary)', opacity: 0.7 }}
                />
              </div>

              <div>
                <p className="block font-sans text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Allowed Programs
                </p>
                <div className="space-y-1">
                  {(policy?.allowedPrograms?.length ?? 0) === 0 ? (
                    <p className="font-sans text-sm" style={{ color: 'var(--text-muted)' }}>
                      No policy configured on-chain.
                    </p>
                  ) : (
                    policy?.allowedPrograms.map((prog, i) => (
                      <code
                        key={i}
                        className="block font-mono text-xs p-2 rounded"
                        style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                      >
                        {prog.slice(0, 12)}...{prog.slice(-8)}
                      </code>
                    ))
                  )}
                </div>
              </div>

              <button
                onClick={handlePause}
                disabled={txPending}
                className="w-full py-3 rounded-xl font-sans font-semibold text-sm transition-all duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50"
                style={isPaused
                  ? { background: '#22c55e', color: '#ffffff' }
                  : { background: '#dc2626', color: '#ffffff' }
                }
              >
                {txPending ? 'Processing...' : isPaused ? 'Resume Protocol' : 'Pause Protocol (Emergency)'}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
