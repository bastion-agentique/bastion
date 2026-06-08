export default function McpSection() {
  return (
    <section className="max-w-3xl mx-auto" aria-labelledby="mcp-heading">
      <h3
        id="mcp-heading"
        className="font-sans text-sm uppercase tracking-wider mb-4"
        style={{ color: 'var(--text-muted)' }}
      >
        MCP Server (Browser-Native)
      </h3>

      <p className="font-sans text-sm mb-6 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        Bastion exposes a Model Context Protocol (MCP) server with SSE transport on port 3001.
        AI agents connect via MCP to access 15 security tools: simulate transactions, read policy,
        override blocks, manage cases, and more.
      </p>

      <div className="space-y-4">
        {/* SSE Connection */}
        <div
          className="rounded-xl p-5"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
        >
          <h4 className="font-sans text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
            SSE Endpoints
          </h4>
          <div className="space-y-2 font-mono text-xs">
            <div className="flex items-center gap-2">
              <span className="text-green-400 text-[10px]">GET</span>
              <code className="text-zinc-300">https://bastion-agentique.fly.dev/mcp/sse</code>
              <span className="text-zinc-600 text-[10px]">SSE connection</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-amber-400 text-[10px]">POST</span>
              <code className="text-zinc-300">https://bastion-agentique.fly.dev/mcp/messages</code>
              <span className="text-zinc-600 text-[10px]">MCP JSON-RPC messages</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400 text-[10px]">GET</span>
              <code className="text-zinc-300">https://bastion-agentique.fly.dev/mcp/health</code>
              <span className="text-zinc-600 text-[10px]">Health check</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400 text-[10px]">GET</span>
              <code className="text-zinc-300">https://bastion-agentique.fly.dev/mcp/pricing</code>
              <span className="text-zinc-600 text-[10px]">Tool pricing + free tier info</span>
            </div>
          </div>
        </div>

        {/* Start command */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
        >
          <div className="px-4 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>Terminal</span>
          </div>
          <pre className="p-4 font-mono text-xs overflow-x-auto" style={{ color: 'var(--text-primary)' }}>
{`# Start MCP HTTP server (SSE transport on port 3001)
BASTION_SIDECAR_URL=https://bastion-agentique.fly.dev \\
pnpm --filter @bastion/mcp-server dev:http

# For stdio transport (Claude Desktop / Cursor / Codex)
pnpm --filter @bastion/mcp-server dev`}
          </pre>
        </div>

        {/* Auth modes */}
        <div
          className="rounded-xl p-5"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
        >
          <p className="font-sans text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
            <strong style={{ color: 'var(--text-primary)' }}>Two auth modes:</strong>
          </p>
          <ul className="font-sans text-xs space-y-1" style={{ color: 'var(--text-muted)' }}>
            <li><span className="text-green-400">pay.sh gateway:</span> X-Api-Key header injected by pay.sh after verifying payment. Trusted — skip x402.</li>
            <li><span className="text-amber-400">Direct browser:</span> No X-Api-Key → x402 payment required for paid tools. Provide X-Payment header with Solana tx hash.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
