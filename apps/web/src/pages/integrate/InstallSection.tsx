import { useState } from 'react';

const SOLANA_INSTALL = `npm install @bastion-agentique/sdk @solana/web3.js @coral-xyz/anchor`;
const SOLANA_DEPS = `# or
pnpm add @bastion-agentique/sdk @solana/web3.js @coral-xyz/anchor
# or
yarn add @bastion-agentique/sdk @solana/web3.js @coral-xyz/anchor`;

export default function InstallSection() {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(SOLANA_INSTALL);
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
        className="rounded-xl overflow-hidden mb-4"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
      >
        <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>Solana — Terminal</span>
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
            {SOLANA_INSTALL}
          </code>
        </pre>
        <pre className="px-4 pb-4 overflow-x-auto">
          <code className="font-mono text-sm leading-relaxed block" style={{ color: 'var(--text-muted)' }}>
            {SOLANA_DEPS}
          </code>
        </pre>
      </div>

      {/* EVM — Foundry Contracts */}
      <div
        className="rounded-xl p-4 opacity-70"
        style={{ background: 'var(--bg-subtle)', border: '1px dashed var(--border)' }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>Foundry</span>
          <span className="font-sans text-xs" style={{ color: 'var(--text-muted)' }}>EVM Contracts — 6 Solidity files</span>
        </div>
        <code className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
          cd evm && forge build && forge test -vvv
        </code>
      </div>
    </section>
  );
}
