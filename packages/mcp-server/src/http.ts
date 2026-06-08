/**
 * MCP HTTP Server — SSE transport for browser-native access.
 * Supports both pay.sh proxied requests (X-Api-Key pre-verified) and
 * direct browser requests (x402 payment required for paid tools).
 * 
 * Usage:
 *   BASTION_SIDECAR_URL=https://bastion-agentique.fly.dev/ \
 *   BASTION_API_KEY=your-key \
 *   SOLANA_RPC_URL=https://api.devnet.solana.com \
 *   tsx src/http.ts
 */

import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createToolDefinitions, SIDECAR_URL as SIDECAR } from './index.js';
import { getPricingTable } from './pricing.js';
import { createServer } from 'http';
import { URL } from 'url';

const PORT = parseInt(process.env.BASTION_MCP_PORT || '3001', 10);
const TREASURY = process.env.BASTION_TREASURY || 'E9PsSz9XWgNR3TmSC57NHC2ZxJzF5NmbrWsDKEe7A7yM';
const SIDECAR_URL = SIDECAR;

const server = new McpServer({
  name: 'bastion-mcp',
  version: '0.3.0',
  description: 'Bastion AI Agent Firewall — simulate, audit, and secure every transaction before signing.',
});

// Register all 15 tools + 3 prompts
createToolDefinitions(server);

// In-memory transport map: sessionId → SSEServerTransport
const transports = new Map<string, SSEServerTransport>();

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Api-Key, X-Payment, X-Payment-Chain, X-Agent-Id');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.method === 'GET' && url.pathname === '/mcp/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      transport: 'sse',
      port: PORT,
      sidecar: SIDECAR_URL,
      version: '0.3.0',
    }));
    return;
  }

  // Pricing endpoint
  if (req.method === 'GET' && url.pathname === '/mcp/pricing') {
    const pricing = getPricingTable();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      treasury: TREASURY,
      free_tier_note: 'Free tier resets on 1st of each month. Payment via Solana SOL transfer to treasury address.',
      x402_header: 'X-Payment: <tx_hash>, X-Payment-Chain: solana',
      tools: pricing,
    }));
    return;
  }

  // SSE connection endpoint (GET for establishing SSE stream)
  if (req.method === 'GET' && url.pathname === '/mcp/sse') {
    const transport = new SSEServerTransport('/mcp/messages', res);
    transports.set(transport.sessionId, transport);
    res.on('close', () => transports.delete(transport.sessionId));
    await server.connect(transport);
    return;
  }

  // MCP message endpoint (POST for sending messages)
  if (req.method === 'POST' && url.pathname === '/mcp/messages') {
    const sessionId = url.searchParams.get('sessionId') || '';
    const transport = transports.get(sessionId);
    if (!transport) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No active SSE session. Connect via GET /mcp/sse first.' }));
      return;
    }
    await transport.handlePostMessage(req, res);
    return;
  }

  // Direct MCP endpoint (legacy — redirect to SSE)
  if (req.method === 'POST' && url.pathname === '/mcp') {
    res.writeHead(302, { Location: '/mcp/sse' });
    res.end();
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found. Use GET /mcp/sse for SSE connection, POST /mcp/messages for MCP messages.' }));
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[bastion-mcp] SSE MCP server listening on 0.0.0.0:${PORT}`);
  console.log(`[bastion-mcp] SSE endpoint: http://localhost:${PORT}/mcp/sse`);
  console.log(`[bastion-mcp] Messages endpoint: http://localhost:${PORT}/mcp/messages`);
  console.log(`[bastion-mcp] Sidecar: ${SIDECAR_URL}`);
  console.log(`[bastion-mcp] Auth: x402 (pay.sh pre-verifies, direct calls use X-Payment header)`);
  console.log(`[bastion-mcp] Treasury: ${TREASURY}`);
});

export { SIDECAR_URL, TREASURY };

