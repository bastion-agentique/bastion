import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { Navbar } from '../../components/Navbar';
import InstallSection from './InstallSection';
import ReputationSection from './ReputationSection';
import QuickStartSection from './QuickStartSection';
import McpSection from './McpSection';
import PricingSection from './PricingSection';
import ChainSupportSection from './ChainSupportSection';
import PersistentSetup from './PersistentSetup';
import ApiReference from './ApiReference';
import LiveTest from './LiveTest';

const CHAIN = 'solana' as const;

export default function Integrate() {
  const { connected: solConnected } = useWallet();
  const navigate = useNavigate();

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
            Install the SDK, register your agent, set a policy, connect via MCP. Every transaction validated before signing. Every API call inspected before sending. Solana native. Web2 proxy. Zero trust.

            Bastion is in alpha testing. Use with caution in production environments.
          </p>

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-4 mt-10">
            {solConnected ? (
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
              href="https://github.com/bastion-agentique/bastion"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full px-8 py-3 text-sm font-medium font-sans transition-all duration-150 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border)', textDecoration: 'none' }}
            >
              GitHub
            </a>
          </div>

          {/* EVM Status */}
          <div
            className="animate-fade-rise-delay-2 mt-10 mx-auto max-w-sm rounded-xl p-5 opacity-60"
            style={{ background: 'var(--bg-subtle)', border: '1px dashed var(--border)' }}
          >
            <div className="flex items-center gap-3 mb-2">
              <span style={{ fontSize: '1.3em', filter: 'grayscale(1)' }}>⟠</span>
              <span className="font-sans text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                EVM (Celo / Base / Polygon)
              </span>
              <span
                className="font-mono text-[9px] px-2 py-0.5 rounded-full ml-auto"
                style={{ background: 'rgba(107,114,128,0.15)', color: '#6B7280', border: '1px solid rgba(107,114,128,0.25)' }}
              >
                In Development
              </span>
            </div>
            <p className="font-sans text-xs" style={{ color: 'var(--text-muted)' }}>
              Solidity contracts in active development. Solana is our primary deployment target.
              EVM support (ERC-7579 validator, EIP-712 audit trail) coming soon.
            </p>
          </div>
        </section>

        {/* Sections */}
        <div className="space-y-20 pb-20" id="install">
          <InstallSection />
          <QuickStartSection />
          <ReputationSection />
          <McpSection />
          <PricingSection />
          <PersistentSetup />
          <ApiReference />
          <ChainSupportSection />
          <LiveTest />
        </div>
      </main>
    </div>
  );
}
