import { useState } from 'react';
import type { ChainId } from '../../lib/chains';
import { CHAINS } from '../../lib/chains';

interface Props {
  chain: ChainId;
}

const HEALTH_ENDPOINTS: Record<ChainId, string> = {
  solana: 'https://api.devnet.solana.com/health',
  celo: 'https://forno.celo.org',
};

export default function LiveTest({ chain }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleTest() {
    setStatus('loading');
    setMessage('');

    try {
      const url = HEALTH_ENDPOINTS[chain];
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' });
      if (res.ok) {
        setStatus('ok');
        setMessage(`Connected to ${CHAINS[chain].name}. RPC is healthy.`);
      } else {
        setStatus('error');
        setMessage(`RPC returned status ${res.status}.`);
      }
    } catch {
      setStatus('error');
      setMessage(`Could not reach ${CHAINS[chain].name} RPC. Check your network.`);
    }
  }

  return (
    <section className="max-w-3xl mx-auto" aria-labelledby="test-heading">
      <h3
        id="test-heading"
        className="font-sans text-sm uppercase tracking-wider mb-4"
        style={{ color: 'var(--text-muted)' }}
      >
        Live Test
      </h3>

      <div
        className="rounded-xl p-6"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
      >
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
          <p
            className="font-sans text-sm mt-4"
            style={{ color: status === 'ok' ? '#22c55e' : '#ef4444' }}
          >
            {message}
          </p>
        )}
      </div>
    </section>
  );
}
