export default function ReputationSection() {
  return (
    <section className="max-w-3xl mx-auto" aria-labelledby="reputation-heading">
      <h3
        id="reputation-heading"
        className="font-sans text-sm uppercase tracking-wider mb-4"
        style={{ color: 'var(--text-muted)' }}
      >
        Agent Reputation
      </h3>

      <p className="font-sans text-sm mb-6 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        Every agent has an on-chain reputation score that accrues over time. Higher reputation unlocks trust gated marketplaces, agent scoring, and portable identity across the Solana ecosystem. Staking has been removed in favor of reputation as the universal chain agnostic primitive.
      </p>

      <div className="space-y-4">
        <div
          className="rounded-xl p-5"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
        >
          <h4 className="font-sans text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
            How reputation works
          </h4>
          <div className="space-y-2 font-mono text-xs">
            <div className="flex items-center gap-2">
              <span className="text-amber-400">1.</span>
              <span style={{ color: 'var(--text-primary)' }}>Register</span>
              <span style={{ color: 'var(--text-muted)' }}>→ Your agent receives a did:bastion identifier and a 100 point base reputation</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-amber-400">2.</span>
              <span style={{ color: 'var(--text-primary)' }}>Transact</span>
              <span style={{ color: 'var(--text-muted)' }}>→ Allowed transactions accrue positive reputation. Blocked transactions may reduce it.</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-amber-400">3.</span>
              <span style={{ color: 'var(--text-primary)' }}>Unlock</span>
              <span style={{ color: 'var(--text-muted)' }}>→ Higher reputation unlocks elevated transaction limits and trust gated features.</span>
            </div>
          </div>
        </div>

        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
        >
          <div className="px-4 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>agent-reputation.ts</span>
          </div>
          <pre className="p-4 font-mono text-xs overflow-x-auto" style={{ color: 'var(--text-primary)' }}>
{`import { BastionClient } from "@bastion-agentique/sdk";

const client = new BastionClient({ connection });

// Register with capabilities
await client.registerAgent(wallet, "MyBot", AGENT_CAPABILITIES.TRANSFER);

// Fetch your reputation
const agent = await client.fetchAgent(wallet.publicKey);
console.log(\`Reputation: \${agent.reputationScore}\`);

// Update reputation (authority only)
await client.updateAgentReputation(wallet, agentAuthority, 10);`}
          </pre>
        </div>
      </div>
    </section>
  );
}
