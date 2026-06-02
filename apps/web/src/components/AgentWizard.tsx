import { useState } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';

interface Props {
  chain: 'solana' | 'celo';
}

const CAPABILITIES = [
  { key: 'TRANSFER', label: 'Token Transfer', bit: 1 << 0, icon: '→' },
  { key: 'SWAP', label: 'DEX Swap', bit: 1 << 1, icon: '⇄' },
  { key: 'NFT_MINT', label: 'NFT Mint', bit: 1 << 2, icon: '◆' },
  { key: 'STAKE', label: 'Staking', bit: 1 << 4, icon: '⊞' },
];

const STEPS = [
  { num: '01', title: 'Install SDK', desc: 'Add the Bastion SDK to your agent project' },
  { num: '02', title: 'Register Agent', desc: 'Create an on-chain identity for your AI agent' },
  { num: '03', title: 'Set Policy', desc: 'Configure transaction limits and allowed programs' },
  { num: '04', title: 'Simulate', desc: 'Send a test transaction through the firewall' },
];

export default function AgentWizard({ chain }: Props) {
  const [step, setStep] = useState(0);
  const [agentName, setAgentName] = useState('');
  const [capabilities, setCapabilities] = useState(0);
  const [maxSolPerTx, setMaxSolPerTx] = useState(1);
  const [rateLimit, setRateLimit] = useState(60);
  const [allowedPrograms, setAllowedPrograms] = useState('');
  const [simTx, setSimTx] = useState('');
  const [simResult, setSimResult] = useState<string | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const { connection } = useConnection();

  const capabilityBitmask = CAPABILITIES.reduce((mask, c) => capabilities & c.bit ? mask | c.bit : mask, 0);

  const installCmd = chain === 'solana'
    ? 'pnpm add @bastion-agentic-defense/sdk @coral-xyz/anchor @solana/web3.js'
    : 'pnpm add viem wagmi';

  const registerCode = chain === 'solana'
    ? `import { BastionClient, AGENT_CAPABILITIES } from "@bastion-agentic-defense/sdk";

const client = new BastionClient({ connection });
const tx = await client.registerAgent(
  wallet,
  "${agentName || 'my-agent'}",
  ${capabilityBitmask}
);`
    : `// EVM agent registration coming soon`;

  const policyCode = chain === 'solana'
    ? `const programs = [
  new PublicKey("${allowedPrograms.split('\n')[0]?.trim() || 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'}"),
];
const tx = await client.setPolicy(
  wallet, programs, ${maxSolPerTx}, ${rateLimit}
);`
    : '';

  const simCode = chain === 'solana'
    ? `// Send a base64 transaction through the sidecar
const response = await fetch("http://localhost:3000/simulate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    transaction: "${simTx || 'BASE64_TX_HERE'}",
    intent: "test transaction from Bastion agent wizard"
  })
});
const result = await response.json();`
    : '';

  async function handleSimulate() {
    setSimLoading(true);
    setSimResult(null);
    try {
      const res = await fetch('http://localhost:3000/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction: simTx, intent: 'wizard test transaction' }),
      });
      const data = await res.json();
      setSimResult(JSON.stringify(data, null, 2));
    } catch (e) {
      setSimResult(`Error: ${String(e)}`);
    }
    setSimLoading(false);
  }

  return (
    <div className="space-y-8">
      {/* Step indicator */}
      <div className="flex gap-2 mb-8">
        {STEPS.map((s, i) => (
          <button
            key={s.num}
            onClick={() => setStep(i)}
            className={`flex-1 rounded-xl p-4 text-left transition-all ${i === step ? 'border-white/20 bg-white/[0.04]' : 'border-white/[0.04] bg-transparent'}`}
            style={{ border: '1px solid', borderColor: i === step ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.04)', opacity: i > step ? 0.4 : 1 }}
          >
            <span className="font-mono text-[10px] text-zinc-600 block mb-1">{s.num}</span>
            <span className="font-sans text-sm font-medium text-white">{s.title}</span>
            <span className="font-sans text-[11px] text-zinc-500 mt-1 block">{s.desc}</span>
          </button>
        ))}
      </div>

      {/* Step 1: Install SDK */}
      {step === 0 && (
        <div className="space-y-4">
          <p className="font-sans text-sm text-zinc-400">Install the Bastion SDK into your agent project. The SDK wraps the Solana Anchor program and the sidecar REST API.</p>
          <div className="rounded-xl p-4" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)' }}>
            <pre className="font-mono text-xs text-zinc-300 overflow-x-auto">{installCmd}</pre>
          </div>
          <p className="font-sans text-[11px] text-zinc-500">After installing, create a BastionClient instance with your Solana connection.</p>
          <button onClick={() => setStep(1)} className="rounded-full bg-white text-black px-8 py-3 text-sm font-medium hover:bg-zinc-200 transition-colors">Next: Register Agent →</button>
        </div>
      )}

      {/* Step 2: Register Agent */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="font-sans text-sm text-zinc-400">Register your AI agent on Solana. This creates an on-chain PDA with your agent's name and capability bitmask.</p>
          <input value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="Agent name (e.g. trading-bot-42)" className="w-full p-3 rounded-lg font-mono text-sm outline-none" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' }} />
          <div className="flex flex-wrap gap-2">
            {CAPABILITIES.map((c) => (
              <button
                key={c.key}
                onClick={() => setCapabilities((p) => p ^ c.bit)}
                className={`px-3 py-2 rounded-lg font-sans text-xs transition-colors ${capabilities & c.bit ? 'bg-white/10 text-white border-white/20' : 'bg-transparent text-zinc-500 border-white/[0.04]'}`}
                style={{ border: '1px solid', borderColor: capabilities & c.bit ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.04)' }}
              >
                <span className="mr-1">{c.icon}</span>{c.label}
              </button>
            ))}
          </div>
          <div className="rounded-xl p-4" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)' }}>
            <pre className="font-mono text-xs text-zinc-300 overflow-x-auto whitespace-pre-wrap">{registerCode}</pre>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(0)} className="rounded-full border border-zinc-700 text-zinc-400 px-6 py-3 text-sm font-medium hover:border-zinc-500 transition-colors">← Back</button>
            <button onClick={() => setStep(2)} className="rounded-full bg-white text-black px-8 py-3 text-sm font-medium hover:bg-zinc-200 transition-colors">Next: Set Policy →</button>
          </div>
        </div>
      )}

      {/* Step 3: Set Policy */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-sans text-xs text-zinc-400 mb-1">Max SOL per Tx</label>
              <input type="number" value={maxSolPerTx} onChange={(e) => setMaxSolPerTx(Number(e.target.value))} className="w-full p-3 rounded-lg font-mono text-sm outline-none" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' }} />
            </div>
            <div>
              <label className="block font-sans text-xs text-zinc-400 mb-1">Rate Limit (tx/min)</label>
              <input type="number" value={rateLimit} onChange={(e) => setRateLimit(Number(e.target.value))} className="w-full p-3 rounded-lg font-mono text-sm outline-none" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' }} />
            </div>
          </div>
          <div>
            <label className="block font-sans text-xs text-zinc-400 mb-1">Allowed Programs (one per line)</label>
            <textarea value={allowedPrograms} onChange={(e) => setAllowedPrograms(e.target.value)} rows={3} placeholder="TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" className="w-full p-3 rounded-lg font-mono text-sm resize-y outline-none" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' }} />
          </div>
          <div className="rounded-xl p-4" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)' }}>
            <pre className="font-mono text-xs text-zinc-300 overflow-x-auto whitespace-pre-wrap">{policyCode}</pre>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="rounded-full border border-zinc-700 text-zinc-400 px-6 py-3 text-sm font-medium transition-colors">← Back</button>
            <button onClick={() => setStep(3)} className="rounded-full bg-white text-black px-8 py-3 text-sm font-medium hover:bg-zinc-200 transition-colors">Next: Simulate →</button>
          </div>
        </div>
      )}

      {/* Step 4: Simulate */}
      {step === 3 && (
        <div className="space-y-4">
          <p className="font-sans text-sm text-zinc-400">Paste a base64-encoded Solana transaction and send it through the Bastion firewall.</p>
          <textarea value={simTx} onChange={(e) => setSimTx(e.target.value)} rows={3} placeholder="Paste base64-encoded transaction here..." className="w-full p-3 rounded-lg font-mono text-sm resize-y outline-none" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' }} />
          <button onClick={handleSimulate} disabled={simLoading || !simTx.trim()} className="rounded-full bg-white text-black px-8 py-3 text-sm font-medium hover:bg-zinc-200 transition-colors disabled:opacity-50">
            {simLoading ? 'Simulating...' : 'Run Simulation'}
          </button>
          {simResult && (
            <div className="rounded-xl p-4" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)' }}>
              <pre className="font-mono text-xs text-zinc-300 overflow-x-auto whitespace-pre-wrap max-h-64">{simResult}</pre>
            </div>
          )}
          <div className="rounded-xl p-4" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)' }}>
            <pre className="font-mono text-xs text-zinc-300 overflow-x-auto whitespace-pre-wrap">{simCode}</pre>
          </div>
          <button onClick={() => setStep(2)} className="rounded-full border border-zinc-700 text-zinc-400 px-6 py-3 text-sm font-medium transition-colors">← Back</button>
        </div>
      )}
    </div>
  );
}
