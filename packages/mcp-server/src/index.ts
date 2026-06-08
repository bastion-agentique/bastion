import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

export const SIDECAR_URL = process.env.BASTION_SIDECAR_URL || "https://bastion-agentique.fly.dev/";

export async function sidecar(path: string, init?: RequestInit) {
  const apiKey = process.env.BASTION_API_KEY;
  const headers: Record<string, string> = { "Content-Type": "application/json", ...init?.headers as Record<string, string> || {} };
  if (apiKey) headers["X-Api-Key"] = apiKey;
  const res = await fetch(`${SIDECAR_URL}${path}`, {
    ...init,
    headers,
  });
  const data = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) return { error: (data as any).error || `HTTP ${res.status}` };
  return data;
}

export function createToolDefinitions(server: McpServer) {

// ═══════════════════════════════════════════════
//  FIREWALL TOOLS
// ═══════════════════════════════════════════════

server.tool(
  "bastion_simulate_transaction",
  "Run a Solana transaction through the Bastion firewall. Returns Pass/Block/PendingHITL with decision reasoning, simulation logs, and blockint rule violations.",
  {
    transaction: z.string().describe("Base64-encoded Solana transaction"),
    intent: z.string().optional().describe("What the transaction is trying to do (for audit trail)"),
  },
  async ({ transaction, intent }) => ({
    content: [{ type: "text", text: JSON.stringify(await sidecar("/simulate", { method: "POST", body: JSON.stringify({ transaction, intent }) }), null, 2) }],
  }),
);

server.tool(
  "bastion_ingest_event",
  "Ingest a universal SIEM event into Bastion. Accepts any security event from cloud, syslog, API logs, or blockchain sources. The event is normalized, policy-checked, and routed to the correlation engine.",
  {
    source: z.string().describe("Source system (e.g. aws-cloudtrail, syslog, github-webhook, solana-rpc)"),
    classification: z.enum(["authentication","authorization","transaction","configuration","network","audit"]).describe("Event classification"),
    description: z.string().optional().describe("Human-readable event description"),
    principal: z.string().optional().describe("Who initiated the event (user, agent, address)"),
    target: z.string().optional().describe("What was acted upon (resource, contract, endpoint)"),
    severity: z.enum(["info","low","medium","high","critical"]).optional().default("info"),
    payload: z.record(z.unknown()).optional().describe("Source-specific JSON payload"),
  },
  async (args) => ({
    content: [{ type: "text", text: JSON.stringify(await sidecar("/ingest", { method: "POST", body: JSON.stringify(args) }), null, 2) }],
  }),
);

// ═══════════════════════════════════════════════
//  POLICY TOOLS
// ═══════════════════════════════════════════════

server.tool(
  "bastion_get_policy",
  "Retrieve the current Bastion firewall policy: allowed programs, SOL caps, rate limits, blocked addresses, blockint security rules, and simulation settings.",
  {},
  async () => ({
    content: [{ type: "text", text: JSON.stringify(await sidecar("/policy"), null, 2) }],
  }),
);

server.tool(
  "bastion_update_policy",
  "Update the Bastion firewall policy. Configure SOL caps, rate limits, allowed programs, blocked addresses, and toggle blockint security checks (flash loan detection, high slippage, mint/freeze authority, risk-labeled addresses).",
  {
    max_sol_per_tx: z.number().optional().describe("Maximum SOL allowed per transaction"),
    rate_limit_per_minute: z.number().optional().describe("Maximum transactions per minute per agent"),
    allowed_programs: z.array(z.string()).optional().describe("List of allowed Solana program IDs"),
    blocked_addresses: z.array(z.string()).optional().describe("List of blocked wallet addresses"),
    simulation_checks_enabled: z.boolean().optional().describe("Enable or disable Helius simulation"),
    blockint_flash_loan_check: z.boolean().optional().describe("Detect flash loan attack patterns"),
    blockint_high_slippage_check: z.boolean().optional().describe("Detect high slippage trades"),
    blockint_mint_authority_blocked: z.boolean().optional().describe("Block mint authority changes"),
    blockint_freeze_authority_blocked: z.boolean().optional().describe("Block freeze authority changes"),
  },
  async (args) => ({
    content: [{ type: "text", text: JSON.stringify(await sidecar("/policy/full", { method: "POST", body: JSON.stringify(args) }), null, 2) }],
  }),
);

// ═══════════════════════════════════════════════
//  AUDIT TOOLS
// ═══════════════════════════════════════════════

server.tool(
  "bastion_get_audit_logs",
  "Retrieve the Bastion immutable audit trail. Every transaction that passes through the firewall is recorded with decision, timestamp, agent, intent, reasoning, and simulation logs. Supports pagination and filtering.",
  {
    limit: z.number().optional().default(50).describe("Maximum entries to return"),
    offset: z.number().optional().default(0).describe("Pagination offset"),
    result: z.enum(["ALLOWED","BLOCKED"]).optional().describe("Filter by decision result"),
  },
  async ({ limit, offset, result }) => {
    let url = `/logs?limit=${limit}&offset=${offset}`;
    if (result) url += `&result=${result}`;
    return { content: [{ type: "text", text: JSON.stringify(await sidecar(url), null, 2) }] };
  },
);

server.tool(
  "bastion_get_audit_stats",
  "Get aggregate audit statistics: total transactions, allowed count, blocked count, and block rate percentage.",
  {},
  async () => ({
    content: [{ type: "text", text: JSON.stringify(await sidecar("/audit/stats"), null, 2) }],
  }),
);

// ═══════════════════════════════════════════════
//  CIRCUIT BREAKER TOOLS
// ═══════════════════════════════════════════════

server.tool(
  "bastion_circuit_breaker_status",
  "Check whether the Bastion circuit breaker is currently engaged. When engaged, all agent transactions are paused fleet-wide.",
  {},
  async () => ({
    content: [{ type: "text", text: JSON.stringify(await sidecar("/circuit-breaker/status"), null, 2) }],
  }),
);

server.tool(
  "bastion_circuit_breaker_toggle",
  "Engage or disengage the Bastion circuit breaker. Engaging pauses all transaction processing across the entire agent fleet. Disengaging resumes normal operations. Designed for emergency security response.",
  {
    engage: z.boolean().describe("true = pause all transactions, false = resume normal operations"),
  },
  async ({ engage }) => {
    const path = engage ? "/circuit-breaker/engage" : "/circuit-breaker/disengage";
    return { content: [{ type: "text", text: JSON.stringify(await sidecar(path, { method: "POST" }), null, 2) }] };
  },
);

// ═══════════════════════════════════════════════
//  HITL OVERRIDE TOOLS
// ═══════════════════════════════════════════════

server.tool(
  "bastion_get_pending_approvals",
  "Get all transactions that are currently blocked and waiting for human review. Each pending approval has a block_id, timestamp, intent, and reasoning.",
  {},
  async () => ({
    content: [{ type: "text", text: JSON.stringify(await sidecar("/pending"), null, 2) }],
  }),
);

server.tool(
  "bastion_override_block",
  "Human-in-the-loop override. Approve or reject a specific blocked transaction. The decision is recorded in the immutable audit trail regardless of outcome.",
  {
    block_id: z.string().describe("UUID of the blocked transaction to override"),
    action: z.enum(["ALLOW", "REJECT"]).describe("Approve or reject the blocked transaction"),
  },
  async ({ block_id, action }) => ({
    content: [{ type: "text", text: JSON.stringify(await sidecar("/override", { method: "POST", body: JSON.stringify({ block_id, action }) }), null, 2) }],
  }),
);

// ═══════════════════════════════════════════════
//  SIEM CASE MANAGEMENT TOOLS
// ═══════════════════════════════════════════════

server.tool(
  "bastion_list_cases",
  "List all investigation cases. Each case tracks a security incident from creation through resolution, with evidence hashes linking to on-chain audit entries.",
  {},
  async () => ({
    content: [{ type: "text", text: JSON.stringify(await sidecar("/cases"), null, 2) }],
  }),
);

server.tool(
  "bastion_create_case",
  "Create a new investigation case from a blocked or suspicious event. Cases track SOC analyst workflow through open, in-progress, resolved, and closed states.",
  {
    title: z.string().describe("Case title summarizing the security incident"),
    description: z.string().optional().describe("Detailed description of the incident and initial findings"),
    event_ids: z.array(z.string()).optional().describe("IDs of related audit events to link to this case"),
  },
  async (args) => ({
    content: [{ type: "text", text: JSON.stringify(await sidecar("/cases", { method: "POST", body: JSON.stringify(args) }), null, 2) }],
  }),
);

server.tool(
  "bastion_update_case",
  "Update an investigation case. Assign an analyst, change status (in_progress/resolved/closed), or add evidence hashes linking to on-chain audit entries.",
  {
    case_id: z.string().describe("Case ID to update"),
    status: z.enum(["in_progress","resolved","closed"]).optional().describe("New case status"),
    assigned_to: z.string().optional().describe("Analyst identifier to assign the case to"),
    evidence_tx_hash: z.string().optional().describe("On-chain transaction hash to attach as evidence"),
  },
  async ({ case_id, status, assigned_to, evidence_tx_hash }) => {
    if (status || assigned_to) {
      await sidecar(`/cases/${case_id}`, { method: "PATCH", body: JSON.stringify({ status, assigned_to }) });
    }
    if (evidence_tx_hash) {
      await sidecar(`/cases/${case_id}/evidence`, { method: "POST", body: JSON.stringify({ tx_hash: evidence_tx_hash }) });
    }
    const updated = await sidecar("/cases");
    return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };
  },
);

// ═══════════════════════════════════════════════
//  IDENTITY & DID TOOLS
// ═══════════════════════════════════════════════

server.tool(
  "bastion_resolve_did",
  "Resolve a W3C DID identifier to its DID Document. Supports did:bastion:solana: (Solana PDA-based) and did:bastion:midnight: (ZK commitment-based) identifiers.",
  {
    did: z.string().describe("Full DID identifier, e.g. did:bastion:solana:BaSZuLcwj...Cb"),
  },
  async ({ did }) => ({
    content: [{ type: "text", text: JSON.stringify(await sidecar(`/did/resolve/${did}`), null, 2) }],
  }),
);

server.tool(
  "bastion_get_correlation_alerts",
  "Get recent correlation alerts from the SIEM engine. Shows detected threat patterns with severity levels and MITRE ATT&CK technique mappings.",
  {},
  async () => ({
    content: [{ type: "text", text: JSON.stringify(await sidecar("/audit/stats"), null, 2) }],
  }),
);

// ═══════════════════════════════════════════════
//  ALCHEMY ENHANCED TOOLS
// ═══════════════════════════════════════════════

server.tool(
  "bastion_get_token_balances",
  "Fetch all SPL token balances for a Solana wallet address using Alchemy Enhanced API. Returns token mint, amount, decimals, and USD value if available.",
  {
    address: z.string().describe("Solana wallet address to check token balances for"),
  },
  async ({ address }) => ({
    content: [{ type: "text", text: JSON.stringify(await sidecar(`/token-balances?address=${encodeURIComponent(address)}`), null, 2) }],
  }),
);

// ═══════════════════════════════════════════════
//  ROBOT / PHYSICAL AGENT TOOLS
// ═══════════════════════════════════════════════

server.tool(
  "bastion_register_robot",
  "Register a physical robot (drone, rover, AGV) as a Bastion agent. Creates a DID with device-type metadata, firmware version, and GPS location.",
  {
    did: z.string().describe("The DID identifier (e.g. did:bastion:solana:{pda})"),
    authority_pubkey: z.string().describe("Solana public key of the robot's authority wallet"),
    device_type: z.enum(["drone","rover","industrial_arm","agv","marine","custom"]).optional().describe("Physical device type"),
    firmware_version: z.string().optional().describe("Current firmware version (e.g. v1.4.2)"),
    location: z.tuple([z.number(), z.number()]).optional().describe("GPS coordinates as [latitude, longitude]"),
  },
  async ({ did, authority_pubkey, device_type, firmware_version, location }) => ({
    content: [{ type: "text", text: JSON.stringify(await sidecar("/agents", {
      method: "POST",
      body: JSON.stringify({ did, authority_pubkey, device_type, firmware_version, last_known_location: location }),
    }), null, 2) }],
  }),
);

server.tool(
  "bastion_robot_telemetry",
  "Submit telemetry data from a physical robot (battery, GPS, firmware). Creates an audit event in the SIEM trail.",
  {
    did: z.string().describe("The agent DID to report telemetry for"),
    battery_level: z.number().min(0).max(100).optional().describe("Battery level 0-100"),
    location: z.tuple([z.number(), z.number()]).optional().describe("GPS coordinates [lat, lon]"),
    firmware_version: z.string().optional().describe("Current firmware version"),
  },
  async ({ did, battery_level, location, firmware_version }) => ({
    content: [{ type: "text", text: JSON.stringify(await sidecar(`/robots/${encodeURIComponent(did)}/telemetry`, {
      method: "POST",
      body: JSON.stringify({ battery_level, location, firmware_version }),
    }), null, 2) }],
  }),
);

// ═══════════════════════════════════════════════
//  PROMPTS
// ═══════════════════════════════════════════════

server.prompt(
  "bastion_verify_transaction",
  "Verify a Solana transaction before signing. Run it through Bastion's firewall to check for policy violations, balance drain, simulation errors, and blockint security risks.",
  {
    transaction: z.string().describe("Base64-encoded Solana transaction to verify"),
  },
  ({ transaction }) => ({
    messages: [{
      role: "user",
      content: { type: "text", text: `Verify this Solana transaction through Bastion before I sign it.\n\nTransaction: ${transaction}\n\nUse bastion_simulate_transaction. Report:\n- Decision (ALLOWED/BLOCKED/PENDING)\n- Which policy rules triggered (if blocked)\n- Simulation logs and balance changes\n- Blockint rule violations (flash loan, slippage, authority changes)\n- Recommendation: should I sign this?` },
    }],
  }),
);

server.prompt(
  "bastion_security_review",
  "Full security review of recent agent activity. Check the audit trail, correlation alerts, pending approvals, and policy configuration for a comprehensive security posture assessment.",
  {
    limit: z.number().optional().default(50).describe("Number of recent audit entries to review"),
  },
  ({ limit }) => ({
    messages: [{
      role: "user",
      content: { type: "text", text: `Run a full Bastion security review.\n\n1. Use bastion_get_audit_stats to get aggregate numbers\n2. Use bastion_get_audit_logs with limit=${limit} to check recent transactions\n3. Use bastion_get_pending_approvals to check for blocked transactions needing review\n4. Use bastion_get_policy to verify current firewall settings\n5. Use bastion_list_cases to check open investigations\n6. Use bastion_get_correlation_alerts to check for threat patterns\n\nSummarize the security posture and recommend any policy changes or actions.` },
    }],
  }),
);

server.prompt(
  "bastion_incident_response",
  "Incident response workflow. When a threat is detected, engage the circuit breaker to pause all transactions, investigate the blocked events, create a case, and document findings.",
  {},
  () => ({
    messages: [{
      role: "user",
      content: { type: "text", text: `INCIDENT RESPONSE WORKFLOW - Execute these steps:\n\n1. Use bastion_circuit_breaker_toggle with engage=true to pause all transactions\n2. Use bastion_get_pending_approvals to see what was blocked\n3. Use bastion_get_audit_logs to review recent activity\n4. Use bastion_create_case to document the incident\n5. Use bastion_update_case to add evidence hashes from on-chain audit entries\n6. If the threat is resolved, use bastion_circuit_breaker_toggle with engage=false to resume operations\n\nAfter completing the workflow, summarize the incident, timeline, and resolution.` },
    }],
  }),
);

// ═══════════════════════════════════════════════
//  START
// ═══════════════════════════════════════════════

async function main() {
  const transport = new StdioServerTransport();
  console.error("[bastion-mcp] Bastion MCP Server v0.1.0");
  console.error("[bastion-mcp] Sidecar:", SIDECAR_URL);
  console.error("[bastion-mcp] Specialty: Firewall enforcement, policy management, audit trail, circuit breaker, case management");
  console.error("[bastion-mcp] Companion: Daemon MCP handles OSINT, forensics, blockint skills, and threat intelligence");
  const server = new McpServer({ name: "bastion-mcp", version: "0.1.0" });
  createToolDefinitions(server);
  await server.connect(transport);
}

main().catch((e) => { console.error("[bastion-mcp] Fatal:", e); process.exit(1); });

}
