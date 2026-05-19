import { useState } from 'react';

interface AgentPlatform {
  name: string;
  icon: string;
  description: string;
  setup: string;
  code: string;
}

const PLATFORMS: AgentPlatform[] = [
  {
    name: 'Claude Code',
    icon: '◇',
    description: 'User-wide plugin. Auto-fetches Bastion SDK context.',
    setup: 'Add to marketplace and install',
    code: `/plugin marketplace add bastion-defend/bastion
/plugin install bastion@bastion-defend`,
  },
  {
    name: 'Cursor',
    icon: '▷',
    description: 'Per-repo rule. Auto-loads on every session.',
    setup: 'Create .cursor/rules/bastion.mdc',
    code: `---
description: Bastion agent firewall for Solana transactions
alwaysApply: true
---
Before signing any Solana transaction, validate it through Bastion.
Use @bastion-agentic-defense/sdk for agent registration and policy config.
Import { BastionClient } from "@bastion-agentic-defense/sdk".`,
  },
  {
    name: 'Codex',
    icon: '⬡',
    description: 'Per-repo pointer. Codex fetches on each task.',
    setup: 'Add to AGENTS.md',
    code: `# AGENTS.md
Use @bastion-agentic-defense/sdk for all Solana transaction security.
Import { BastionClient, AGENT_CAPABILITIES }
from "@bastion-agentic-defense/sdk".

Before signing, pass the transaction through
Bastion middleware at POST /simulate.
Only sign if response is ALLOW.`,
  },
  {
    name: 'OpenClaw',
    icon: '◆',
    description: 'Per-project clone. Skills live on disk.',
    setup: 'Run in terminal',
    code: `clawhub install bastion`,
  },
];

function AgentPlatformCard({ platform }: { platform: AgentPlatform }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(platform.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow)' }}
    >
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xl" style={{ color: 'var(--accent)' }}>
          {platform.icon}
        </span>
        <div>
          <h4 className="font-sans font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            {platform.name}
          </h4>
          <p className="font-sans text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {platform.description}
          </p>
        </div>
      </div>

      <p className="font-sans text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
        {platform.setup}
      </p>

      <div
        className="rounded-lg overflow-hidden relative"
        style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
      >
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 font-sans text-xs font-medium px-2 py-0.5 rounded transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          style={{ color: copied ? '#22c55e' : 'var(--text-muted)', background: 'var(--bg)' }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
        <pre className="p-4 overflow-x-auto">
          <code className="font-mono text-xs leading-relaxed block" style={{ color: 'var(--text-primary)' }}>
            {platform.code}
          </code>
        </pre>
      </div>
    </div>
  );
}

export default function PersistentSetup() {
  return (
    <section className="max-w-3xl mx-auto" aria-labelledby="persistent-heading">
      <h3
        id="persistent-heading"
        className="font-sans text-sm uppercase tracking-wider mb-4"
        style={{ color: 'var(--text-muted)' }}
      >
        Persistent Setup
      </h3>

      <p className="font-sans text-sm mb-6 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        Configure your coding agent once. Bastion loads on every session.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {PLATFORMS.map((p) => (
          <AgentPlatformCard key={p.name} platform={p} />
        ))}
      </div>
    </section>
  );
}
