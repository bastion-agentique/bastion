import { useState } from 'react';
import type { ChainId } from '../../lib/chains';
import { CHAINS } from '../../lib/chains';
import { useSidecar } from '../../hooks/useSidecar';

interface Props {
  chain: ChainId;
}

async function checkChainHealth(chain: ChainId): Promise<{ ok: boolean; detail: string }> {
  if (chain === 'solana') {
    const res = await fetch('https://api.devnet.solana.com/health', { method: 'GET' });
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
    const text = await res.text();
    if (text.trim() === 'ok') return { ok: true, detail: 'ok' };
    return { ok: false, detail: text.trim() };
  }

  const res = await fetch(CHAINS.celo.rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
  });
  if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
  const json = await res.json();
  if (json.error) return { ok: false, detail: json.error.message ?? 'RPC error' };
  const block = parseInt(json.result, 16);
  return { ok: true, detail: `block #${block.toLocaleString()}` };
}

export default function LiveTest({ chain }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [simTx, setSimTx] = useState('');
  const [simIntent, setSimIntent] = useState('');
  const [simStatus, setSimStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [simResult, setSimResult] = useState<{
    passed: boolean;
    decision: string;
    reasoning: string;
    logs: string[];
  } | null>(null);

  const sidecar = useSidecar();

  async function handleTest() {
    setStatus('loading');
    setMessage('');
    try {
      const { ok, detail } = await checkChainHealth(chain);
      if (ok) {
        setStatus('ok');
        setMessage(`Connected to ${CHAINS[chain].name}. RPC is healthy. (${detail})`);
      } else {
        setStatus('error');
        setMessage(`RPC check failed: ${detail}`);
      }
    } catch (err) {
      setStatus('error');
      setMessage(`Could not reach ${CHAINS[chain].name} RPC. Check your network.`);
      console.error('[Bastion] LiveTest error:', err);
    }
  }

  async function handleSimulate() {
    setSimStatus('loading');
    setSimResult(null);
    try {
      const result = await sidecar.simulateTransaction(
        simTx.trim(),
        simIntent.trim() || undefined,
      );
      if (!result) {
        setSimStatus('error');
        setSimResult({
          passed: false,
          decision: 'ERROR',
          reasoning: 'Could not reach the sidecar. Ensure it is running on port 3000.',
          logs: [],
        });
        return;
      }
      setSimStatus(result.passed ? 'ok' : 'error');
      setSimResult({
        passed: result.passed,
        decision: result.decision,
        reasoning: result.reasoning,
        logs: result.simulation_logs ?? [],
      });
    } catch (err) {
      setSimStatus('error');
      setSimResult({
        passed: false,
        decision: 'ERROR',
        reasoning: `Network error: ${String(err)}`,
        logs: [],
      });
    }
  }

  const decisionColor = simResult?.passed ? '#22c55e' : '#ef4444';

  return (
    <section className="max-w-3xl mx-auto space-y-12" aria-labelledby="test-heading">
      <h3
        id="test-heading"
        className="font-sans text-sm uppercase tracking-wider mb-4"
        style={{ color: 'var(--text-muted)' }}
      >
        Live Test
      </h3>

      {/* RPC Health Check */}
      <div
        className="rounded-xl p-6"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
      >
        <h4 className="font-sans text-base font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
          RPC Connection
        </h4>
        <p className="font-sans text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          Verify your connection to the {CHAINS[chain].name} network before integrating.
        </p>
        <button
          onClick={handleTest}
          disabled={status === 'loading'}
          className="rounded-full px-6 py-2.5 text-sm font-medium font-sans transition-all duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 disabled:opacity-50"
          style={{ background: 'var(--text-primary)', color: 'var(--bg)' }}
        >
          {status === 'loading' ? 'Testing...' : 'Test Connection'}
        </button>
        {message && (
          <p className="font-sans text-sm mt-4" style={{ color: status === 'ok' ? '#22c55e' : '#ef4444' }}>
            {message}
          </p>
        )}
      </div>

      {/* Sidecar Simulation Test */}
      <div
        className="rounded-xl p-6"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
      >
        <h4 className="font-sans text-base font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
          Simulate Transaction
        </h4>
        <p className="font-sans text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          Paste a base64-encoded Solana transaction and run it through the Bastion sidecar firewall.
        </p>

        <div className="space-y-3 mb-4">
          <textarea
            value={simTx}
            onChange={(e) => setSimTx(e.target.value)}
            placeholder="Paste base64-encoded transaction here..."
            rows={3}
            className="w-full p-3 rounded-lg font-mono text-sm resize-y"
            style={{
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />
          <input
            value={simIntent}
            onChange={(e) => setSimIntent(e.target.value)}
            placeholder="Intent (optional, e.g. 'swap 0.1 SOL for USDC')"
            className="w-full p-3 rounded-lg font-mono text-sm"
            style={{
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        <button
          onClick={handleSimulate}
          disabled={simStatus === 'loading' || !simTx.trim()}
          className="rounded-full px-6 py-2.5 text-sm font-medium font-sans transition-all duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 disabled:opacity-50 mb-4"
          style={{ background: 'var(--text-primary)', color: 'var(--bg)' }}
        >
          {simStatus === 'loading' ? 'Simulating...' : 'Run Simulation'}
        </button>

        {simResult && (
          <div
            className="rounded-lg p-4 mt-4"
            style={{
              background: 'var(--bg-subtle)',
              border: `1px solid ${decisionColor}`,
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span
                className="font-mono text-xs font-bold px-2 py-0.5 rounded"
                style={{ background: decisionColor, color: '#fff' }}
              >
                {simResult.decision}
              </span>
              <span className="font-sans text-sm" style={{ color: 'var(--text-primary)' }}>
                {simResult.reasoning}
              </span>
            </div>
            {simResult.logs.length > 0 && (
              <details className="mt-2">
                <summary className="font-sans text-xs cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                  Simulation logs ({simResult.logs.length} lines)
                </summary>
                <div
                  className="mt-2 p-3 rounded font-mono text-xs max-h-48 overflow-y-auto"
                  style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}
                >
                  {simResult.logs.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
