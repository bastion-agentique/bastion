import { useState } from 'react';
import type { ChainId } from '../../lib/chains';

interface Props {
  chain: ChainId;
}

const SOLANA_INSTALL = `npm install @bastion-agentic-defense/sdk @solana/web3.js @coral-xyz/anchor`;
const SOLANA_DEPS = `# or
pnpm add @bastion-agentic-defense/sdk @solana/web3.js @coral-xyz/anchor
# or
yarn add @bastion-agentic-defense/sdk @solana/web3.js @coral-xyz/anchor`;

const CELO_INSTALL = `# Celo support via Bastion REST API
# No npm package required -- use fetch()

# For full EVM SDK (coming soon):
# npm install @bastion-agentic-defense/sdk-evm viem`;

export default function InstallSection({ chain }: Props) {
  const [copied, setCopied] = useState(false);

  const code = chain === 'solana' ? SOLANA_INSTALL : CELO_INSTALL;
  const deps = chain === 'solana' ? SOLANA_DEPS : null;

  function handleCopy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="max-w-3xl mx-auto" aria-labelledby="install-heading">
      <h3
        id="install-heading"
        className="font-sans text-sm uppercase tracking-wider mb-4"
        style={{ color: 'var(--text-muted)' }}
      >
        Step 1: Install
      </h3>

      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
      >
        <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>Terminal</span>
          <button
            onClick={handleCopy}
            className="font-sans text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded px-2 py-0.5"
            style={{ color: copied ? '#22c55e' : 'var(--text-muted)' }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre className="p-4 overflow-x-auto">
          <code className="font-mono text-sm leading-relaxed block" style={{ color: 'var(--text-primary)' }}>
            {code}
          </code>
        </pre>
        {deps && (
          <pre className="px-4 pb-4 overflow-x-auto">
            <code className="font-mono text-sm leading-relaxed block" style={{ color: 'var(--text-muted)' }}>
              {deps}
            </code>
          </pre>
        )}
      </div>
    </section>
  );
}
