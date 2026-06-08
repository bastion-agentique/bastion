import { useState } from 'react';

const SIDECAR = "https://bastion-agentique.fly.dev";

const CODE = `// ── Step 1: Generate a DID keypair ──────────────────
const res = await fetch("${SIDECAR}/did/generate", {
  method: "POST",
});
const { did, authority_pubkey, secret_key_base64 } = await res.json();
// did: "did:bastion:solana:AbCd..."
// Store secret_key_base64 securely — shown once

// ── Step 2: Register your agent ─────────────────────
await fetch("${SIDECAR}/agents", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    did,
    authority_pubkey,
    sidecar_endpoint: "${SIDECAR}",
  }),
});

// ── Step 3: Authenticate (challenge-response) ───────
const nonceRes = await fetch("${SIDECAR}/auth/nonce", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ did }),
});
const { nonce } = await nonceRes.json();

// Sign the nonce with your Ed25519 authority key
const signature = signNonce(secret_key_base64, nonce);

// ── Step 4: Make authenticated requests ─────────────
const policyRes = await fetch("${SIDECAR}/policy/full", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-DID": did,
    "X-DID-Nonce": nonce,
    "X-DID-Signature": signature,
  },
  body: JSON.stringify({
    max_sol_per_tx: 1_000_000_000, // 1 SOL
    allowed_programs: [
      "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
    ],
  }),
});

// ── Step 5: Simulate a transaction ──────────────────
const simRes = await fetch("${SIDECAR}/simulate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ transaction: txBase64 }),
});
const result = await simRes.json();
console.log(result.decision); // "Pass" | "Block" | "PendingHITL"`;

export default function QuickStartSection() {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="max-w-3xl mx-auto" aria-labelledby="quickstart-heading">
      <h3
        id="quickstart-heading"
        className="font-sans text-xs uppercase tracking-wider mb-4"
        style={{ color: 'var(--text-muted)' }}
      >
        Step 2: Quick Start — DID Auth Flow
      </h3>

      <p className="font-sans text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
        The sidecar uses DID-based challenge-response authentication. Generate a keypair, register your agent, then sign nonces to access protected endpoints.
      </p>

      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
      >
        <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
            agent-setup.ts
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
            {CODE}
          </code>
        </pre>
      </div>
    </section>
  );
}
