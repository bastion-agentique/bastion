import { useState } from 'react';
import type { ChainId } from '../../lib/chains';

interface Props {
  chain: ChainId;
}

const SOLANA_CODE = `import { Connection, Keypair } from "@solana/web3.js";
import {
  BastionClient,
  AGENT_CAPABILITIES,
  DECISION,
} from "@bastion-agentic-defense/sdk";

const connection = new Connection(
  "https://api.devnet.solana.com"
);
const client = new BastionClient({ connection });
const wallet = Keypair.generate();

// 1. Initialize audit state
const initTx = await client.initialize(wallet);
await connection.sendTransaction(initTx, [wallet]);

// 2. Register your agent
const registerTx = await client.registerAgent(
  wallet,
  "MyTradingBot",
  AGENT_CAPABILITIES.TRANSFER | AGENT_CAPABILITIES.SWAP
);
await connection.sendTransaction(registerTx, [wallet]);

// 3. Set security policy
const jupiter = new PublicKey(
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"
);
const policyTx = await client.setPolicy(
  wallet,
  [jupiter],
  1,  // max 1 SOL per tx
  10  // rate limit: 10 tx/min
);
await connection.sendTransaction(policyTx, [wallet]);

// 4. Circuit breaker
const pauseTx = await client.emergencyPause(wallet);
await connection.sendTransaction(pauseTx, [wallet]);`;

const CELO_CODE = `// Celo support via Bastion REST API
// The middleware validates transactions before signing

const BASTION = "https://bastion.example.com";

// 1. Register your agent
await fetch(BASTION + "/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    agentId: "0x...",
    name: "MyTradingBot",
  }),
});

// 2. Set security policy
await fetch(BASTION + "/policy", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    maxNativePerTx: 1,
    rateLimitPerMinute: 10,
    allowedAddresses: ["0x..."],
  }),
});

// 3. Validate before every transaction
const res = await fetch(BASTION + "/simulate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    transaction: "0x...",
    intent: "Swap 1 CELO for USDC",
  }),
});
const { decision } = await res.json();
if (decision === "ALLOW") {
  // sign and send
}`;

export default function QuickStartSection({ chain }: Props) {
  const [copied, setCopied] = useState(false);

  const code = chain === 'solana' ? SOLANA_CODE : CELO_CODE;

  function handleCopy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="max-w-3xl mx-auto" aria-labelledby="quickstart-heading">
      <h3
        id="quickstart-heading"
        className="font-sans text-sm uppercase tracking-wider mb-4"
        style={{ color: 'var(--text-muted)' }}
      >
        Step 2: Quick Start
      </h3>

      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
      >
        <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
            {chain === 'solana' ? 'agent-setup.ts' : 'agent-setup.js'}
          </span>
          <button
            onClick={handleCopy}
            className="font-sans text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded px-2 py-0.5"
            style={{ color: copied ? '#22c55e' : 'var(--text-muted)' }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre className="p-4 overflow-x-auto max-h-96 overflow-y-auto">
          <code className="font-mono text-sm leading-relaxed block" style={{ color: 'var(--text-primary)' }}>
            {code}
          </code>
        </pre>
      </div>
    </section>
  );
}
