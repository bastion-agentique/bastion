import { useState } from 'react';

interface ApiMethod {
  method: string;
  signature: string;
  description: string;
  example: string;
}

const METHODS: ApiMethod[] = [
  {
    method: 'initialize',
    signature: 'initialize(authority: Signer): Promise<Transaction>',
    description: 'Initialize the on-chain audit state PDA. Call once when setting up Bastion for a new authority.',
    example: `const initTx = await client.initialize(wallet);
await connection.sendTransaction(initTx, [wallet]);`,
  },
  {
    method: 'registerAgent',
    signature: 'registerAgent(signer, name, capabilities): Promise<Transaction>',
    description: 'Register an AI agent on-chain with a name and capability bitmask. PDA derived from authority key.',
    example: `const tx = await client.registerAgent(
  wallet,
  "MyTradingBot",
  AGENT_CAPABILITIES.TRANSFER | AGENT_CAPABILITIES.SWAP
);
await connection.sendTransaction(tx, [wallet]);`,
  },
  {
    method: 'setPolicy',
    signature: 'setPolicy(signer, programs[], maxSol, rateLimit): Promise<Transaction>',
    description: 'Configure the security policy. Set allowed programs, max native token per transaction, and rate limit.',
    example: `const tx = await client.setPolicy(
  wallet,
  [jupiterProgram, tokenProgram],
  1,  // max 1 SOL per tx
  10  // rate limit: 10 tx/min
);
await connection.sendTransaction(tx, [wallet]);`,
  },
  {
    method: 'logAudit',
    signature: 'logAudit(signer, decision, simResult[], reason): Promise<Transaction>',
    description: 'Log an audit decision on-chain. Called by the middleware after simulation and policy check.',
    example: `const tx = await client.logAudit(
  wallet,
  DECISION.ALLOWED,
  simHash,
  "Transaction passed all checks"
);
await connection.sendTransaction(tx, [wallet]);`,
  },
  {
    method: 'emergencyPause',
    signature: 'emergencyPause(signer): Promise<Transaction>',
    description: 'Pause all transaction processing immediately. Circuit breaker for emergencies.',
    example: `const tx = await client.emergencyPause(wallet);
await connection.sendTransaction(tx, [wallet]);`,
  },
  {
    method: 'emergencyResume',
    signature: 'emergencyResume(signer): Promise<Transaction>',
    description: 'Resume transaction processing after a pause. Restores normal operation.',
    example: `const tx = await client.emergencyResume(wallet);
await connection.sendTransaction(tx, [wallet]);`,
  },
  {
    method: 'fetchAuditState',
    signature: 'fetchAuditState(): Promise<AuditState>',
    description: 'Fetch the current audit state including total audits, allowed count, blocked count, and paused status.',
    example: `const state = await client.fetchAuditState();
console.log(state.totalAudits, state.allowedCount);`,
  },
  {
    method: 'fetchPolicy',
    signature: 'fetchPolicy(): Promise<Policy>',
    description: 'Fetch the current security policy configuration from on-chain.',
    example: `const policy = await client.fetchPolicy();
console.log(policy.allowedPrograms);`,
  },
  {
    method: 'getAuditStateAddress',
    signature: 'getAuditStateAddress(): PublicKey',
    description: 'Derive the PDA for the audit state account. Useful for explorers and cross-contract calls.',
    example: `const auditPda = client.getAuditStateAddress();`,
  },
  {
    method: 'getAgentAddress',
    signature: 'getAgentAddress(authority): PublicKey',
    description: 'Derive the PDA for an agent account given its authority public key.',
    example: `const agentPda = client.getAgentAddress(wallet.publicKey);`,
  },
  {
    method: 'getPolicyAddress',
    signature: 'getPolicyAddress(): PublicKey',
    description: 'Derive the PDA for the policy account.',
    example: `const policyPda = client.getPolicyAddress();`,
  },
  {
    method: 'addEventListener',
    signature: 'addEventListener<T>(event, callback): number',
    description: 'Subscribe to on-chain events emitted by the Bastion program.',
    example: `const id = client.addEventListener(
  "AgentRegistered",
  (event) => console.log(event.name)
);`,
  },
];

function ApiMethodCard({ method }: { method: ApiMethod }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(method.example);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="rounded-xl overflow-hidden transition-colors duration-150"
      style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 flex items-start justify-between gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]"
        aria-expanded={expanded}
      >
        <div className="min-w-0">
          <code className="font-mono text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {method.method}()
          </code>
          <p className="font-sans text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {method.description}
          </p>
        </div>
        <span
          className="font-mono text-xs flex-shrink-0 mt-0.5 transition-transform duration-150"
          style={{ color: 'var(--text-muted)', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          ▼
        </span>
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <div className="px-4 py-2" style={{ background: 'var(--bg-subtle)' }}>
            <code className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
              {method.signature}
            </code>
          </div>
          <div className="relative">
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 font-sans text-xs font-medium px-2 py-0.5 rounded transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] z-10"
              style={{ color: copied ? '#22c55e' : 'var(--text-muted)', background: 'var(--bg)' }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            <pre className="p-4 overflow-x-auto">
              <code className="font-mono text-sm leading-relaxed block" style={{ color: 'var(--text-primary)' }}>
                {method.example}
              </code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ApiReference() {
  return (
    <section className="max-w-3xl mx-auto" aria-labelledby="api-heading">
      <h3
        id="api-heading"
        className="font-sans text-sm uppercase tracking-wider mb-4"
        style={{ color: 'var(--text-muted)' }}
      >
        API Reference
      </h3>

      <div className="space-y-2">
        {METHODS.map((m) => (
          <ApiMethodCard key={m.method} method={m} />
        ))}
      </div>
    </section>
  );
}
