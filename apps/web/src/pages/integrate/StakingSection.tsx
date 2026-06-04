export default function StakingSection() {
  return (
    <section className="max-w-3xl mx-auto" aria-labelledby="staking-heading">
      <h3
        id="staking-heading"
        className="font-sans text-sm uppercase tracking-wider mb-4"
        style={{ color: 'var(--text-muted)' }}
      >
        Staking & Stake-Weighted Policy
      </h3>

      <p className="font-sans text-sm mb-6 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        Stake SOL into your AgentStake PDA to unlock higher transaction limits. The more you stake, the more your agent can transact.
      </p>

      <div className="space-y-4">
        {/* Pricing tiers */}
        <div
          className="rounded-xl p-5"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
        >
          <h4 className="font-sans text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
            How it works
          </h4>
          <div className="space-y-2 font-mono text-xs">
            <div className="flex items-center gap-2">
              <span className="text-amber-400">1.</span>
              <span style={{ color: 'var(--text-primary)' }}>Stake SOL</span>
              <span style={{ color: 'var(--text-muted)' }}>→ 48h minimum before first unstake</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-amber-400">2.</span>
              <span style={{ color: 'var(--text-primary)' }}>Higher limits</span>
              <span style={{ color: 'var(--text-muted)' }}>→ Effective limit = base * (1 + stake/min * multiplier) * decay^depth</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-amber-400">3.</span>
              <span style={{ color: 'var(--text-primary)' }}>Capped at 10x</span>
              <span style={{ color: 'var(--text-muted)' }}>→ Maximum multiplier is 10x base limit</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-amber-400">4.</span>
              <span style={{ color: 'var(--text-primary)' }}>Unstake</span>
              <span style={{ color: 'var(--text-muted)' }}>→ 7-day cooldown, stake still counts during cooldown</span>
            </div>
          </div>
        </div>

        {/* SDK example */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
        >
          <div className="px-4 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>agent-staking.ts</span>
          </div>
          <pre className="p-4 font-mono text-xs overflow-x-auto" style={{ color: 'var(--text-primary)' }}>
{`import { BastionClient } from "@bastion-agentique/sdk";

const client = new BastionClient({ connection });

// Stake 5 SOL
const stakeTx = await client.stakeLamports(wallet, 5_000_000_000);
await connection.sendTransaction(stakeTx, [wallet]);

// Request unstake (7-day cooldown starts)
const unstakeTx = await client.requestUnstake(wallet);
await connection.sendTransaction(unstakeTx, [wallet]);

// After 7 days, claim your SOL back
const claimTx = await client.claimUnstake(wallet);
await connection.sendTransaction(claimTx, [wallet]);

// Check your stake status
const stake = await client.fetchAgentStake(wallet.publicKey);
console.log(\`Staked: \${stake.stakedLamports} SOL\`);`}
          </pre>
        </div>

        {/* Depth decay table */}
        <div
          className="rounded-xl p-5"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
        >
          <h4 className="font-sans text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
            Depth Decay
          </h4>
          <div className="space-y-1 font-mono text-xs">
            <div className="flex justify-between" style={{ color: 'var(--text-primary)' }}>
              <span>Depth 0 (root agent)</span><span>100% stake weight</span>
            </div>
            <div className="flex justify-between" style={{ color: 'var(--text-muted)' }}>
              <span>Depth 1 (sub-agent)</span><span>50% stake weight</span>
            </div>
            <div className="flex justify-between" style={{ color: 'var(--text-muted)' }}>
              <span>Depth 2 (sub-sub-agent)</span><span>25% stake weight</span>
            </div>
          </div>
          <p className="font-sans text-[10px] mt-3" style={{ color: 'var(--text-muted)' }}>
            Formula: <code className="text-zinc-400">max_delegation = staked * (1 / 2^depth)</code>
          </p>
        </div>
      </div>
    </section>
  );
}
