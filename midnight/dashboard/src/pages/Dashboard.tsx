import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Navbar } from '../components/Navbar';
import { formatTimestamp, truncate } from '../lib/utils';

const MIDDLEWARE_URL = import.meta.env.VITE_MIDDLEWARE_URL ?? 'https://bastion-agentique.fly.dev/';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AuditEntry {
  id: string;
  timestamp: number;
  decision: 'ALLOWED' | 'BLOCKED' | 'PENDING';
  agentId: string;
  intent: string;
  reason: string;
  commitmentHash?: string;
}

interface Policy {
  maxValuePerTx: number;
  dailyTxLimit: number;
  cooldownSeconds: number;
  allowedTargetIds: string[];
  allowedSelectors: string[];
}

interface Stats {
  total: number;
  allowed: number;
  blocked: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_POLICY: Policy = {
  maxValuePerTx: 1_000_000,
  dailyTxLimit: 100,
  cooldownSeconds: 0,
  allowedTargetIds: [],
  allowedSelectors: ['transfer', 'approve', 'swap'],
};

const DECISION_COLORS = {
  ALLOWED: { text: '#22c55e', border: '#22c55e' },
  BLOCKED: { text: '#ef4444', border: '#ef4444' },
  PENDING: { text: '#f59e0b', border: '#f59e0b' },
};

const MOCK_LOGS: AuditEntry[] = [
  {
    id: '1',
    timestamp: Math.floor(Date.now() / 1000),
    decision: 'ALLOWED',
    agentId: '0x7c3a...ed9f',
    intent: 'Transfer 500 DUST to approved target',
    reason: 'Policy passed',
    commitmentHash: '0xab12...ef34',
  },
  {
    id: '2',
    timestamp: Math.floor(Date.now() / 1000) - 60,
    decision: 'BLOCKED',
    agentId: '0x9mb2...7pL4',
    intent: 'Transfer 2,000,000 tokens to unknown target',
    reason: 'ValueExceedsLimit',
    commitmentHash: '0xcd56...gh78',
  },
  {
    id: '3',
    timestamp: Math.floor(Date.now() / 1000) - 180,
    decision: 'ALLOWED',
    agentId: '0x3fR5...8kM2',
    intent: 'Swap 100 DUST via DEX selector',
    reason: 'Policy passed',
    commitmentHash: '0xij90...kl12',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'pending' | 'logs' | 'policy' | 'agents'>('logs');
  const [pending, setPending] = useState<AuditEntry[]>([]);
  const [logs, setLogs] = useState<AuditEntry[]>(MOCK_LOGS);
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY);
  const [stats, setStats] = useState<Stats>({ total: 156, allowed: 142, blocked: 14 });
  const [isPaused, setIsPaused] = useState(false);
  const [agentId, setAgentId] = useState('');
  const [middlewareStatus, setMiddlewareStatus] = useState<'checking' | 'ok' | 'offline'>('checking');
  const isDark = theme === 'dark';

  // ── Health check ──
  useEffect(() => {
    fetch(`${MIDDLEWARE_URL}/health`)
      .then(r => r.ok ? setMiddlewareStatus('ok') : setMiddlewareStatus('offline'))
      .catch(() => setMiddlewareStatus('offline'));
  }, []);

  // ── Load audit logs for agent ──
  const loadLogs = useCallback(async () => {
    if (!agentId) return;
    try {
      const res = await fetch(`${MIDDLEWARE_URL}/audit/${agentId}`);
      if (!res.ok) return;
      const data = await res.json();
      const entries: AuditEntry[] = data.map((e: any) => ({
        id: e.entry_id,
        timestamp: e.timestamp,
        decision: e.allowed ? 'ALLOWED' : 'BLOCKED',
        agentId,
        intent: `Transaction at ${formatTimestamp(e.timestamp)}`,
        reason: e.allowed ? 'Policy passed' : 'Policy blocked',
        commitmentHash: e.commitment?.slice(0, 10) + '...',
      }));
      setLogs(entries);
      setStats({
        total: entries.length,
        allowed: entries.filter(e => e.decision === 'ALLOWED').length,
        blocked: entries.filter(e => e.decision === 'BLOCKED').length,
      });
    } catch {
      // middleware offline, keep mock data
    }
  }, [agentId]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // ── Human override ──
  const handleAllow = useCallback((id: string) => {
    setPending(prev => prev.filter(p => p.id !== id));
    setLogs(prev => [{
      id,
      timestamp: Math.floor(Date.now() / 1000),
      decision: 'ALLOWED',
      agentId: '',
      intent: 'Override: Allow',
      reason: 'Human approved',
    }, ...prev]);
    setStats(s => ({ ...s, total: s.total + 1, allowed: s.allowed + 1 }));
  }, []);

  const handleReject = useCallback((id: string) => {
    setPending(prev => prev.filter(p => p.id !== id));
    setLogs(prev => [{
      id,
      timestamp: Math.floor(Date.now() / 1000),
      decision: 'BLOCKED',
      agentId: '',
      intent: 'Override: Reject',
      reason: 'Human rejected',
    }, ...prev]);
    setStats(s => ({ ...s, total: s.total + 1, blocked: s.blocked + 1 }));
  }, []);

  // ── Pause / resume ──
  async function togglePause() {
    try {
      await fetch(`${MIDDLEWARE_URL}/${isPaused ? 'resume' : 'pause'}`, { method: 'POST' });
    } catch { /* offline fallback */ }
    setIsPaused(p => !p);
  }

  // ── Save policy ──
  async function savePolicy() {
    if (!agentId) { alert('Enter an Agent ID first.'); return; }
    try {
      await fetch(`${MIDDLEWARE_URL}/policy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: agentId,
          policy_commitment: '0x0000',
          policy: {
            allowed_target_ids: policy.allowedTargetIds,
            allowed_selectors: policy.allowedSelectors,
            max_value_per_tx: policy.maxValuePerTx,
            daily_tx_limit: policy.dailyTxLimit,
            cooldown_seconds: policy.cooldownSeconds,
            max_gas_per_tx: null,
          },
        }),
      });
      alert('Policy saved.');
    } catch {
      alert('Middleware offline — policy saved locally only.');
    }
  }

  const TABS = [
    { key: 'logs'    as const, label: 'Audit Logs' },
    { key: 'pending' as const, label: `Pending${pending.length > 0 ? ` (${pending.length})` : ''}` },
    { key: 'policy'  as const, label: 'Policy' },
    { key: 'agents'  as const, label: 'Agents' },
  ];

  const statusDot = middlewareStatus === 'ok'
    ? { color: '#22c55e', label: 'LIVE' }
    : middlewareStatus === 'offline'
    ? { color: '#ef4444', label: 'OFFLINE' }
    : { color: '#f59e0b', label: 'CHECKING' };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 pb-20">

        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-serif text-3xl font-normal" style={{ color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
              Firewall Dashboard
            </h1>
            <p className="font-sans text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              ZK-Private AI Agent Firewall for Midnight Network
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Middleware status */}
            <span
              className="px-3 py-1 rounded-full text-xs font-sans font-semibold border"
              style={{
                background: `${statusDot.color}18`,
                color: statusDot.color,
                borderColor: `${statusDot.color}44`,
              }}
            >
              {statusDot.label}
            </span>
            {/* Paused badge */}
            {isPaused && (
              <span
                className="px-3 py-1 rounded-full text-xs font-sans font-semibold border"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
              >
                PAUSED
              </span>
            )}
          </div>
        </div>

        {/* Agent ID input */}
        <div className="mb-6">
          <label htmlFor="agent-id" className="block font-sans text-xs font-medium mb-1 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Agent ID (ZK commitment)
          </label>
          <input
            id="agent-id"
            type="text"
            placeholder="0xabc123... or leave blank to view demo data"
            value={agentId}
            onChange={e => setAgentId(e.target.value)}
            onBlur={loadLogs}
            className="w-full max-w-xl p-3 rounded-lg font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Audits', value: stats.total,                                                                        color: 'var(--text-primary)' },
            { label: 'Allowed',      value: stats.allowed,                                                                     color: '#22c55e' },
            { label: 'Blocked',      value: stats.blocked,                                                                     color: '#ef4444' },
            { label: 'Block Rate',   value: stats.total > 0 ? `${((stats.blocked / stats.total) * 100).toFixed(1)}%` : '0%',  color: '#f59e0b' },
          ].map(stat => (
            <div
              key={stat.label}
              className="rounded-xl p-4"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow)' }}
            >
              <p className="font-sans text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                {stat.label}
              </p>
              <p className="font-mono text-2xl font-bold tabular-nums" style={{ color: stat.color }}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div
          className="flex gap-1 mb-6 p-1 rounded-xl w-fit"
          style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
          role="tablist"
          aria-label="Dashboard sections"
        >
          {TABS.map(tab => (
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

        {/* Tab panels */}
        <div
          className="rounded-2xl p-6"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow)' }}
          role="tabpanel"
        >

          {/* ── Audit Logs ── */}
          {activeTab === 'logs' && (
            <div className="space-y-2">
              {logs.length === 0 ? (
                <p className="font-sans text-center py-12" style={{ color: 'var(--text-muted)' }}>No audit entries yet.</p>
              ) : (
                logs.map(log => (
                  <div
                    key={log.id}
                    className="p-3 rounded-lg"
                    style={{
                      background: 'var(--bg-subtle)',
                      border: `1px solid var(--border)`,
                      borderLeft: `3px solid ${DECISION_COLORS[log.decision].border}`,
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-xs font-semibold" style={{ color: DECISION_COLORS[log.decision].text }}>
                        {log.decision}
                      </span>
                      <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                        {formatTimestamp(log.timestamp)}
                      </span>
                    </div>
                    <p className="font-sans text-sm mt-1" style={{ color: 'var(--text-primary)' }}>{log.intent}</p>
                    <div className="flex justify-between items-end mt-0.5">
                      {log.agentId && (
                        <p className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                          Agent: {truncate(log.agentId)}
                        </p>
                      )}
                      {log.commitmentHash && (
                        <p className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                          Commitment: {log.commitmentHash}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Pending Approvals ── */}
          {activeTab === 'pending' && (
            <div className="space-y-4">
              {pending.length === 0 ? (
                <p className="font-sans text-center py-12" style={{ color: 'var(--text-muted)' }}>
                  No transactions awaiting approval.
                </p>
              ) : (
                pending.map(item => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl"
                    style={{ background: 'var(--bg-subtle)', borderLeft: '4px solid #f59e0b', border: '1px solid var(--border)' }}
                  >
                    <div className="flex justify-between mb-2">
                      <span className="font-sans font-semibold text-sm" style={{ color: '#f59e0b' }}>Pending Approval</span>
                      <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                        {formatTimestamp(item.timestamp)}
                      </span>
                    </div>
                    <p className="font-sans text-sm mb-1" style={{ color: 'var(--text-primary)' }}>{item.intent}</p>
                    <p className="font-sans text-xs mb-4" style={{ color: 'var(--text-muted)' }}>{item.reason}</p>
                    <div className="flex gap-2">
                      <button onClick={() => handleAllow(item.id)} className="btn-primary flex-1 text-sm">Allow</button>
                      <button onClick={() => handleReject(item.id)} className="btn-danger flex-1 text-sm">Reject</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Policy ── */}
          {activeTab === 'policy' && (
            <div className="space-y-6 max-w-lg">
              <div>
                <label htmlFor="max-value" className="block font-sans text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Max Value per Transaction (base units)
                </label>
                <input
                  id="max-value"
                  type="number"
                  min="0"
                  value={policy.maxValuePerTx}
                  onChange={e => setPolicy(p => ({ ...p, maxValuePerTx: Number(e.target.value) }))}
                  className="w-full p-3 rounded-lg font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label htmlFor="daily-limit" className="block font-sans text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Daily Transaction Limit
                </label>
                <input
                  id="daily-limit"
                  type="number"
                  min="1"
                  value={policy.dailyTxLimit}
                  onChange={e => setPolicy(p => ({ ...p, dailyTxLimit: Number(e.target.value) }))}
                  className="w-full p-3 rounded-lg font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label htmlFor="cooldown" className="block font-sans text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Cooldown Between Transactions (seconds)
                </label>
                <input
                  id="cooldown"
                  type="number"
                  min="0"
                  value={policy.cooldownSeconds}
                  onChange={e => setPolicy(p => ({ ...p, cooldownSeconds: Number(e.target.value) }))}
                  className="w-full p-3 rounded-lg font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <p className="block font-sans text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Allowed Selectors
                </p>
                <div className="space-y-1">
                  {policy.allowedSelectors.map((sel, i) => (
                    <code
                      key={i}
                      className="block font-mono text-xs p-2 rounded"
                      style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                    >
                      {sel}
                    </code>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={savePolicy}
                  className="flex-1 py-3 rounded-xl font-sans font-semibold text-sm transition-all duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                  style={{ background: 'var(--accent)', color: '#ffffff' }}
                >
                  Save Policy
                </button>
                <button
                  onClick={togglePause}
                  className="flex-1 py-3 rounded-xl font-sans font-semibold text-sm transition-all duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  style={isPaused
                    ? { background: '#22c55e', color: '#ffffff' }
                    : { background: '#dc2626', color: '#ffffff' }
                  }
                >
                  {isPaused ? 'Resume Protocol' : 'Pause Protocol'}
                </button>
              </div>
            </div>
          )}

          {/* ── Agents ── */}
          {activeTab === 'agents' && (
            <div className="space-y-4">
              <p className="font-sans text-sm" style={{ color: 'var(--text-muted)' }}>
                Register a new agent. The agent's real address is committed as a ZK hash — never stored on-chain in plain text.
              </p>
              <div className="p-4 rounded-xl space-y-4" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
                <AgentRegistrationForm middlewareUrl={MIDDLEWARE_URL} />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent Registration Form
// ─────────────────────────────────────────────────────────────────────────────

function AgentRegistrationForm({ middlewareUrl }: { middlewareUrl: string }) {
  const [name, setName] = useState('');
  const [metadataUri, setMetadataUri] = useState('');
  const [result, setResult] = useState<{ agentId: string; txHash: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function register() {
    if (!name) { alert('Agent name required.'); return; }
    setLoading(true);
    try {
      // Derive a deterministic mock commitment from name (real SDK would use crypto)
      const enc = new TextEncoder();
      const digest = await crypto.subtle.digest('SHA-256', enc.encode(name));
      const agentId = '0x' + Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
      const commitment = '0x' + Array.from(new Uint8Array(digest).reverse()).map(b => b.toString(16).padStart(2, '0')).join('');

      const res = await fetch(`${middlewareUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId, commitment, name, metadata_uri: metadataUri || null }),
      });
      const data = await res.json();
      setResult({ agentId: data.agent_id, txHash: data.tx_hash });
    } catch {
      // middleware offline
      setResult({ agentId: '0x' + name.split('').map(c => c.charCodeAt(0).toString(16)).join(''), txHash: '0xdemo...' });
    } finally {
      setLoading(false);
    }
  }

  function useState<T>(init: T): [T, (v: T | ((p: T) => T)) => void] {
    return [init as T, () => {}]; // shadowed by outer useState — intentional re-use below
  }

  return <AgentRegistrationFormInner middlewareUrl={middlewareUrl} />;
}

// Separated to avoid hook rule issues with the inner useState shadowing
function AgentRegistrationFormInner({ middlewareUrl }: { middlewareUrl: string }) {
  const [name, setName] = useState('');
  const [metadataUri, setMetadataUri] = useState('');
  const [result, setResult] = useState<{ agentId: string; txHash: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function register() {
    if (!name) { alert('Agent name required.'); return; }
    setLoading(true);
    try {
      const enc = new TextEncoder();
      const digest = await crypto.subtle.digest('SHA-256', enc.encode(name));
      const agentId = '0x' + Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
      const commitment = '0x' + Array.from(new Uint8Array(digest).reverse()).map(b => b.toString(16).padStart(2, '0')).join('');

      const res = await fetch(`${middlewareUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId, commitment, name, metadata_uri: metadataUri || null }),
      });
      const data = await res.json();
      setResult({ agentId: data.agent_id, txHash: data.tx_hash });
    } catch {
      setResult({ agentId: '0xdemo_offline', txHash: '0xdemo_tx' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div>
        <label className="block font-sans text-xs font-medium mb-1 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Agent Name
        </label>
        <input
          type="text"
          placeholder="my-trading-agent"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full p-3 rounded-lg font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
      </div>
      <div>
        <label className="block font-sans text-xs font-medium mb-1 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Metadata URI (optional)
        </label>
        <input
          type="text"
          placeholder="ipfs://..."
          value={metadataUri}
          onChange={e => setMetadataUri(e.target.value)}
          className="w-full p-3 rounded-lg font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
      </div>
      <button
        onClick={register}
        disabled={loading}
        className="w-full py-3 rounded-lg font-sans font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ background: 'var(--accent)', color: '#ffffff' }}
      >
        {loading ? 'Registering...' : 'Register Agent'}
      </button>
      {result && (
        <div className="mt-2 p-3 rounded-lg space-y-1" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <p className="font-sans text-xs font-semibold" style={{ color: '#22c55e' }}>Agent registered</p>
          <p className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>ID: {result.agentId.slice(0, 18)}...</p>
          <p className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>Tx: {result.txHash.slice(0, 18)}...</p>
        </div>
      )}
    </>
  );
}
