import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useChain } from '../context/ChainContext';
import { useTheme } from '../context/ThemeContext';
import { Navbar } from '../components/Navbar';
import { useBastionProgram, type AuditEntryData, type PolicyData, type StatsData } from '../hooks/useBastionProgram';
import { useSidecar } from '../hooks/useSidecar';

const DECISION_COLORS: Record<string, { text: string; border: string }> = {
  ALLOWED: { text: '#22c55e', border: '#22c55e' },
  BLOCKED: { text: '#ef4444', border: '#ef4444' },
  PENDING: { text: '#f59e0b', border: '#f59e0b' },
};

const DEFAULT_DECISION = { text: '#9ca3af', border: '#9ca3af' };

export default function Dashboard() {
  const { chain } = useChain();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const { connected: solConnected, publicKey } = useWallet();
  const { isConnected: evmConnected } = useAccount();
  const connected = chain === 'solana' ? solConnected : evmConnected;

  const sol = useBastionProgram();
  const sidecar = useSidecar();

  const [activeTab, setActiveTab] = useState<'logs' | 'policy' | 'pending'>('logs');
  const [logs, setLogs] = useState<AuditEntryData[]>([]);
  const [policy, setPolicy] = useState<PolicyData | null>(null);
  const [stats, setStats] = useState<StatsData>({ total: 0, allowed: 0, blocked: 0 });
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [txPending, setTxPending] = useState(false);
  const [sidecarOnline, setSidecarOnline] = useState<boolean | null>(null);
  const [isEVM] = useState(chain !== 'solana');

  // Editable policy state
  const [editingPolicy, setEditingPolicy] = useState(false);
  const [policyForm, setPolicyForm] = useState({
    maxSolPerTx: 1,
    rateLimitPerMinute: 120,
    allowedProgramsText: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);

    // Try sidecar first for richer data
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
        const mapped: AuditEntryData[] = l.entries.map((e) => ({
          id: String(e.id),
          timestamp: e.timestamp,
          decision: e.result === 'ALLOWED' ? 'ALLOWED' : 'BLOCKED',
          account: e.transaction_details?.signature ?? '',
          intent: e.intent ?? 'No description',
          reason: e.reasoning,
        }));
        setLogs(mapped);
      }
      if (pol) {
        setPolicy({
          maxSolPerTx: pol.max_sol_per_tx ?? 0,
          rateLimit: pol.rate_limit_per_minute ?? 0,
          allowedPrograms: pol.allowed_programs,
        });
        setPolicyForm({
          maxSolPerTx: pol.max_sol_per_tx ?? 1,
          rateLimitPerMinute: pol.rate_limit_per_minute ?? 120,
          allowedProgramsText: pol.allowed_programs.join('\n'),
        });
      }
      setLoading(false);
      return;
    }

    // Fallback to on-chain Anchor program
    if (chain === 'solana') {
      const [s, p, l, pol] = await Promise.all([
        sol.fetchStats(),
        sol.fetchPaused(),
        sol.fetchAuditEntries(50),
        sol.fetchPolicy(),
      ]);
      if (s) setStats(s);
      if (p !== null) setIsPaused(p);
      if (l) setLogs(l);
      if (pol) {
        setPolicy(pol);
        setPolicyForm({
          maxSolPerTx: pol.maxSolPerTx,
          rateLimitPerMinute: pol.rateLimit,
          allowedProgramsText: pol.allowedPrograms.join('\n'),
        });
      }
    }

    setLoading(false);
  }, [chain, sol, sidecar]);

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
    if (chain !== 'solana') return;
    setTxPending(true);
    const sig = isPaused ? await sol.emergencyResume() : await sol.emergencyPause();
    if (sig) {
      setIsPaused(!isPaused);
      setTimeout(loadData, 2000);
    }
    setTxPending(false);
  }, [isPaused, sol, loadData, chain]);

  const handleSavePolicy = useCallback(async () => {
    if (chain !== 'solana') return;
    setTxPending(true);
    const programs = policyForm.allowedProgramsText
      .split('\n')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    // Try sidecar first
    const sidecarOk = await sidecar.updatePolicy({
      max_sol_per_tx: policyForm.maxSolPerTx,
      max_balance_drain_lamports: null,
      rate_limit_per_minute: policyForm.rateLimitPerMinute,
      allowed_programs: programs,
      blocked_addresses: [],
      simulation_checks_enabled: true,
    });

    // Also try on-chain
    try {
      await sol.updatePolicy(programs, policyForm.maxSolPerTx, policyForm.rateLimitPerMinute);
    } catch { /* on-chain update may fail if PDA not initialized */ }

    if (sidecarOk || programs.length > 0) {
      setPolicy({
        maxSolPerTx: policyForm.maxSolPerTx,
        rateLimit: policyForm.rateLimitPerMinute,
        allowedPrograms: programs,
      });
    }
    setEditingPolicy(false);
    setTxPending(false);
    setTimeout(loadData, 2000);
  }, [policyForm, sol, sidecar, loadData, chain]);

  const TABS = [
    { key: 'logs' as const, label: 'Audit Logs' },
    { key: 'policy' as const, label: 'Policy' },
  ];

  const tokenSymbol = chain === 'solana' ? 'SOL' : 'CELO';

  const labelStyle = { color: 'var(--text-primary)' } as const;
  const mutedStyle = { color: 'var(--text-muted)' } as const;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 pb-20">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-serif text-3xl font-normal" style={{ color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
              Firewall Dashboard
            </h1>
            <p className="font-sans text-sm mt-1" style={mutedStyle}>
              Multichain AI Agent Firewall — v0.3.0
              {sidecarOnline !== null && (
                <span className="ml-3">
                  Sidecar:{' '}
                  <span style={{ color: sidecarOnline ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                    {sidecarOnline ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {chain === 'solana' ? (
              <>
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
              </>
            ) : (
              <div className="[&_button]:!rounded-full [&_button]:!text-sm">
                <ConnectButton showBalance={false} accountStatus="address" chainStatus="none" />
              </div>
            )}
          </div>
        </div>

        {isEVM && (
          <div
            className="rounded-xl p-4 mb-6"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
          >
            <p className="font-sans text-sm" style={mutedStyle}>
              EVM integration (Celo, Base, Polygon) is under active development. The on-chain Solana flow is fully
              operational. Connect a Solana wallet and switch to the Solana chain to use the firewall dashboard.
            </p>
          </div>
        )}

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
              <p className="font-sans text-xs uppercase tracking-wider mb-1" style={mutedStyle}>
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
            <p className="font-sans text-center py-12" style={mutedStyle}>
              Loading data...
            </p>
          )}

          {!loading && activeTab === 'logs' && (
            <div className="space-y-2">
              {logs.length === 0 ? (
                <div className="text-center py-12">
                  <p className="font-sans text-sm mb-2" style={mutedStyle}>
                    No audit entries yet.
                  </p>
                  <p className="font-sans text-xs" style={mutedStyle}>
                    Start the sidecar with the /simulate endpoint to see entries here.
                  </p>
                </div>
              ) : (
                logs.map((log) => {
                  const colors = DECISION_COLORS[log.decision] ?? DEFAULT_DECISION;
                  return (
                    <div
                      key={log.id}
                      className="p-3 rounded-lg"
                      style={{
                        background: 'var(--bg-subtle)',
                        border: '1px solid var(--border)',
                        borderLeft: `3px solid ${colors.border}`,
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-xs font-semibold" style={{ color: colors.text }}>
                          {log.decision}
                        </span>
                        <span className="font-mono text-xs" style={mutedStyle}>
                          {log.timestamp > 10000000000
                            ? new Date(log.timestamp * 1000).toLocaleTimeString()
                            : new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="font-sans text-sm mt-1" style={labelStyle}>{log.intent}</p>
                      {log.account && (
                        <p className="font-mono text-xs mt-0.5" style={mutedStyle}>
                          {log.account.slice(0, 16)}...
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {!loading && activeTab === 'policy' && (
            <div className="space-y-6 max-w-lg">
              {isEVM && chain !== 'solana' && (
                <p className="font-sans text-sm" style={mutedStyle}>
                  Policy management is available on the Solana chain. EVM support is coming soon.
                </p>
              )}
              <div>
                <label htmlFor="max-token" className="block font-sans text-sm font-medium mb-2" style={labelStyle}>
                  Max {tokenSymbol} per Transaction
                </label>
                <input
                  id="max-token"
                  type="number"
                  min="0"
                  step="0.1"
                  value={editingPolicy ? policyForm.maxSolPerTx : (policy?.maxSolPerTx ?? 0)}
                  onChange={(e) => setPolicyForm((p) => ({ ...p, maxSolPerTx: Number(e.target.value) }))}
                  readOnly={!editingPolicy}
                  className="w-full p-3 rounded-lg font-mono text-sm"
                  style={{
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    opacity: editingPolicy ? 1 : 0.7,
                  }}
                />
              </div>

              <div>
                <label htmlFor="rate-limit" className="block font-sans text-sm font-medium mb-2" style={labelStyle}>
                  Rate Limit (tx per minute)
                </label>
                <input
                  id="rate-limit"
                  type="number"
                  min="1"
                  value={editingPolicy ? policyForm.rateLimitPerMinute : (policy?.rateLimit ?? 0)}
                  onChange={(e) => setPolicyForm((p) => ({ ...p, rateLimitPerMinute: Number(e.target.value) }))}
                  readOnly={!editingPolicy}
                  className="w-full p-3 rounded-lg font-mono text-sm"
                  style={{
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    opacity: editingPolicy ? 1 : 0.7,
                  }}
                />
              </div>

              <div>
                <label htmlFor="allowed-programs" className="block font-sans text-sm font-medium mb-2" style={labelStyle}>
                  Allowed Programs (one per line)
                </label>
                <textarea
                  id="allowed-programs"
                  rows={5}
                  value={editingPolicy ? policyForm.allowedProgramsText : (policy?.allowedPrograms?.join('\n') ?? '')}
                  onChange={(e) => setPolicyForm((p) => ({ ...p, allowedProgramsText: e.target.value }))}
                  readOnly={!editingPolicy}
                  placeholder="Paste Solana program IDs, one per line"
                  className="w-full p-3 rounded-lg font-mono text-sm resize-y"
                  style={{
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    opacity: editingPolicy ? 1 : 0.7,
                  }}
                />
              </div>

              <div className="flex gap-3">
                {chain === 'solana' && !editingPolicy && (
                  <button
                    onClick={() => setEditingPolicy(true)}
                    className="flex-1 py-3 rounded-xl font-sans font-semibold text-sm transition-all duration-150 hover:opacity-90"
                    style={{ background: 'var(--accent)', color: '#ffffff' }}
                  >
                    Edit Policy
                  </button>
                )}
                {chain === 'solana' && editingPolicy && (
                  <>
                    <button
                      onClick={handleSavePolicy}
                      disabled={txPending}
                      className="flex-1 py-3 rounded-xl font-sans font-semibold text-sm transition-all duration-150 hover:opacity-90 disabled:opacity-50"
                      style={{ background: '#22c55e', color: '#ffffff' }}
                    >
                      {txPending ? 'Saving...' : 'Save Policy'}
                    </button>
                    <button
                      onClick={() => setEditingPolicy(false)}
                      disabled={txPending}
                      className="flex-1 py-3 rounded-xl font-sans font-semibold text-sm transition-all duration-150 hover:opacity-90 disabled:opacity-50"
                      style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>

              {chain === 'solana' && (
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
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
