import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const SIDECAR_URL = process.env.BASTION_SIDECAR_URL || "http://localhost:3000";

async function sidecarFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${SIDECAR_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    return { error: (err as any).error || `HTTP ${res.status}` };
  }
  return res.json();
}

const server = new McpServer({
  name: "bastion-mcp",
  version: "0.1.0",
});

// ── Tool: Simulate Transaction ──

server.tool(
  "bastion_simulate_transaction",
  "Simulate a Solana transaction through the Bastion firewall. Returns Pass, Block, or PendingHITL with detailed reasoning and simulation logs.",
  {
    transaction: z.string().describe("Base64-encoded Solana transaction"),
    intent: z.string().optional().describe("Human-readable description of what the transaction is trying to do"),
  },
  async ({ transaction, intent }) => {
    const result = await sidecarFetch("/simulate", {
      method: "POST",
      body: JSON.stringify({ transaction, intent }),
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ── Tool: Get Audit Logs ──

server.tool(
  "bastion_get_audit_logs",
  "Retrieve the Bastion audit trail. Returns paginated logs of all transactions processed through the firewall with decisions, timestamps, and reasoning.",
  {
    limit: z.number().optional().default(50).describe("Maximum number of log entries to return"),
    offset: z.number().optional().default(0).describe("Pagination offset"),
  },
  async ({ limit, offset }) => {
    const result = await sidecarFetch(`/logs?limit=${limit}&offset=${offset}`);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ── Tool: Get Policy ──

server.tool(
  "bastion_get_policy",
  "Retrieve the current Bastion firewall policy configuration, including allowed programs, token caps, rate limits, blockint rules, and blocked addresses.",
  {},
  async () => {
    const result = await sidecarFetch("/policy");
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ── Tool: Register Agent ──

server.tool(
  "bastion_register_agent",
  "Register a new AI agent on the Solana blockchain through Bastion. Creates an on-chain PDA identity with agent name and capability bitmask.",
  {
    name: z.string().describe("Human-readable agent name"),
    capabilities: z.number().optional().default(1).describe("Bitmask of agent capabilities. 1=Transfer, 2=Swap, 4=NFT Mint, 8=NFT Transfer, 16=Stake, 32=Delegate, 64=Create Program"),
  },
  async ({ name, capabilities }) => {
    const result = await sidecarFetch("/api/v2/evaluate", {
      method: "POST",
      body: JSON.stringify({
        type: "register_agent",
        name,
        capabilities,
      }),
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ── Tool: Override Block ──

server.tool(
  "bastion_override_block",
  "Human-in-the-loop override. Approve or reject a blocked transaction that is pending review.",
  {
    block_id: z.string().describe("The UUID block ID of the pending transaction to override"),
    action: z.enum(["ALLOW", "REJECT"]).describe("Whether to allow or reject the blocked transaction"),
  },
  async ({ block_id, action }) => {
    const result = await sidecarFetch("/override", {
      method: "POST",
      body: JSON.stringify({ block_id, action }),
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ── Tool: Correlation Alerts ──

server.tool(
  "bastion_get_correlation_alerts",
  "Retrieve correlation alerts from the SIEM engine. Shows detected threat patterns with severity and MITRE ATT&CK mappings.",
  {},
  async () => {
    const result = await sidecarFetch("/audit/stats");
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ── Prompt: Verify Transaction ──

server.prompt(
  "bastion_verify_transaction",
  "Verify a transaction before signing. Run it through the Bastion firewall to check for security issues.",
  {
    transaction: z.string().describe("Base64-encoded transaction to verify"),
  },
  ({ transaction }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Please verify this Solana transaction before I sign it. Run it through Bastion's firewall simulation.\n\nTransaction: ${transaction}\n\nUse the bastion_simulate_transaction tool to check if this transaction is safe. Return the decision (ALLOWED, BLOCKED, or PENDING), the reasoning, and any simulation logs.`,
      },
    }],
  })
);

// ── Prompt: Audit History ──

server.prompt(
  "bastion_audit_history",
  "Review the Bastion audit history for compliance reporting or security investigation.",
  {
    limit: z.number().optional().default(50).describe("Number of audit entries to review"),
  },
  ({ limit }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Please review the last ${limit} audit entries from Bastion. Use the bastion_get_audit_logs tool.\n\nSummarize:\n- Total allowed vs blocked transactions\n- Any suspicious patterns or repeated blocked transactions\n- Correlation alerts that require investigation\n- Recommendations for policy adjustments`,
      },
    }],
  })
);

// ── Start ──

async function main() {
  const transport = new StdioServerTransport();

  console.error("[bastion-mcp] Starting MCP server...");
  console.error(`[bastion-mcp] Sidecar URL: ${SIDECAR_URL}`);
  console.error("[bastion-mcp] Connected to Claude/Cursor via stdio");

  await server.connect(transport);
}

main().catch((err) => {
  console.error("[bastion-mcp] Fatal error:", err);
  process.exit(1);
});
