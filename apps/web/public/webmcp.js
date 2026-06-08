/**
 * Bastion WebMCP — Exposes Bastion tools to AI agents via navigator.modelContext.provideContext()
 * 
 * When loaded in a browser with WebMCP support, this script registers Bastion's tools
 * so AI agents can directly interact with Bastion through the Model Context Protocol
 * in-browser (no separate server needed).
 */
(function() {
  if (typeof navigator === 'undefined' || !navigator.modelContext) return;

  const SIDECAR_URL = 'https://bastion-agentique.fly.dev/';
  const MCP_URL = 'https://bastion-agentique.fly.dev/';

  navigator.modelContext.provideContext({
    tools: [
      {
        name: 'bastion_simulate_transaction',
        description: 'Simulate a Solana transaction through Bastion firewall. Returns Pass/Block/PendingHITL with decision reasoning, simulation logs, and blockint rule violations.',
        inputSchema: {
          type: 'object',
          properties: {
            transaction: { type: 'string', description: 'Base64-encoded Solana transaction' },
            intent: { type: 'string', description: 'What the transaction is trying to do (for audit trail)' }
          },
          required: ['transaction']
        },
        async execute(args) {
          const res = await fetch(`${SIDECAR_URL}/simulate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(args)
          });
          return await res.json();
        }
      },
      {
        name: 'bastion_get_policy',
        description: 'Read current Bastion firewall policy (allowlists, caps, rate limits).',
        inputSchema: { type: 'object', properties: {} },
        async execute() {
          const res = await fetch(`${SIDECAR_URL}/policy`);
          return await res.json();
        }
      },
      {
        name: 'bastion_get_audit_logs',
        description: 'Retrieve paginated audit trail of all transaction decisions.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'integer', description: 'Max entries (default 50)' },
            offset: { type: 'integer', description: 'Pagination offset' }
          }
        },
        async execute(args) {
          const limit = args.limit || 50;
          const offset = args.offset || 0;
          const res = await fetch(`${SIDECAR_URL}/logs?limit=${limit}&offset=${offset}`);
          return await res.json();
        }
      },
      {
        name: 'bastion_get_audit_stats',
        description: 'Get aggregate audit statistics (total, allowed, blocked).',
        inputSchema: { type: 'object', properties: {} },
        async execute() {
          const res = await fetch(`${SIDECAR_URL}/audit/stats`);
          return await res.json();
        }
      },
      {
        name: 'bastion_health',
        description: 'Check if Bastion sidecar and MCP server are healthy.',
        inputSchema: { type: 'object', properties: {} },
        async execute() {
          const [sidecar, mcp] = await Promise.all([
            fetch(`${SIDECAR_URL}/health`).then(r => r.json()),
            fetch(`${MCP_URL}/mcp/health`).then(r => r.json()).catch(() => ({ status: 'offline' }))
          ]);
          return { sidecar, mcp };
        }
      }
    ]
  });

  console.log('[bastion-webmcp] Registered 5 Bastion tools via WebMCP');
})();
