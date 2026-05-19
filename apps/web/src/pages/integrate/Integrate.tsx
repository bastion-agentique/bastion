import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAccount } from 'wagmi';
import { useChain } from '../../context/ChainContext';
import { Navbar } from '../../components/Navbar';
import { CHAIN_LIST } from '../../lib/chains';
import type { ChainId } from '../../lib/chains';
import InstallSection from './InstallSection';
import QuickStartSection from './QuickStartSection';
import ChainSupportSection from './ChainSupportSection';
import PersistentSetup from './PersistentSetup';
import ApiReference from './ApiReference';
import LiveTest from './LiveTest';

export default function Integrate() {
  const { chain: storedChain, setChain } = useChain();
  const [chain, setChainLocal] = useState<ChainId>(storedChain);
  const { connected: solConnected } = useWallet();
  const { isConnected: evmConnected } = useAccount();
  const navigate = useNavigate();

  const connected = storedChain === 'solana' ? solConnected : evmConnected;

  function handleChainToggle(id: ChainId) {
    setChainLocal(id);
    setChain(id);
  }

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden" style={{ background: 'var(--bg)' }}>
      <Navbar />

      <main className="relative z-10 max-w-6xl mx-auto px-6 pt-32 pb-20">
        {/* Hero */}
        <section className="text-center mb-20" aria-labelledby="integrate-headline">
          <h1
            id="integrate-headline"
            className="animate-fade-rise font-serif max-w-3xl mx-auto"
            style={{
              fontSize: 'clamp(2rem, 6vw, 4rem)',
              lineHeight: '1.05',
              letterSpacing: '-1.5px',
              fontWeight: 400,
              color: 'var(--text-primary)',
            }}
          >
            One line to secure{' '}
            <em style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>your agent</em>.
          </h1>

          <p
            className="animate-fade-rise-delay font-sans mt-6 max-w-xl mx-auto text-base leading-relaxed"
            style={{ color: 'var(--text-muted)' }}
          >
            Install the SDK, register your agent, set a policy. Every transaction validated before signing. Multi-chain. Zero trust.
          </p>

          {/* Chain Toggle */}
          <div
            className="animate-fade-rise-delay-2 inline-flex gap-1 mt-10 p-1 rounded-xl"
            style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
            role="radiogroup"
            aria-label="Select chain"
          >
            {CHAIN_LIST.map((c) => (
              <button
                key={c.id}
                role="radio"
                aria-checked={chain === c.id}
                onClick={() => handleChainToggle(c.id)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-sans text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                style={chain === c.id
                  ? { background: 'var(--accent)', color: '#ffffff' }
                  : { background: 'transparent', color: 'var(--text-muted)' }
                }
              >
                <span>{c.icon}</span>
                <span>{c.name}</span>
              </button>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-4 mt-8">
            {connected ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="rounded-full px-8 py-3 text-sm font-medium font-sans transition-transform duration-150 hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                style={{ background: 'var(--text-primary)', color: 'var(--bg)' }}
              >
                Go to Dashboard
              </button>
            ) : (
              <a
                href="#install"
                className="rounded-full px-8 py-3 text-sm font-medium font-sans transition-transform duration-150 hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                style={{ background: 'var(--text-primary)', color: 'var(--bg)', textDecoration: 'none' }}
              >
                Start Integrating
              </a>
            )}
            <a
              href="https://github.com/bastion-defend/bastion"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full px-8 py-3 text-sm font-medium font-sans transition-all duration-150 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border)', textDecoration: 'none' }}
            >
              GitHub
            </a>
          </div>
        </section>

        {/* Sections */}
        <div className="space-y-20 pb-20" id="install">
          <InstallSection chain={chain} />
          <QuickStartSection chain={chain} />
          <PersistentSetup />
          <ApiReference />
          <ChainSupportSection chain={chain} />
          <LiveTest chain={chain} />
        </div>
      </main>
    </div>
  );
}
