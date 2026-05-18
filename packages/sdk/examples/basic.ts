import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { BastionClient, AGENT_CAPABILITIES, DECISION } from "./src";

const DEMO_WALLET = Keypair.generate();
const DEMO_PROGRAM_ID = new PublicKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");

async function main() {
  const connection = new Connection("https://api.devnet.solana.com");
  
  const client = new BastionClient({
    connection,
    provider: undefined,
  });

  console.log("=== Bastion SDK Demo ===\n");

  const auditStateAddr = client.getAuditStateAddress();
  console.log("Audit State PDA:", auditStateAddr.toString());

  const agentAddr = client.getAgentAddress(DEMO_WALLET.publicKey);
  console.log("Agent PDA:", agentAddr.toString());

  const policyAddr = client.getPolicyAddress();
  console.log("Policy PDA:", policyAddr.toString());

  console.log("\n=== Capability Bitmasks ===");
  console.log("TRANSFER:", AGENT_CAPABILITIES.TRANSFER);
  console.log("SWAP:", AGENT_CAPABILITIES.SWAP);
  console.log("NFT_MINT:", AGENT_CAPABILITIES.NFT_MINT);
  console.log("STAKE:", AGENT_CAPABILITIES.STAKE);

  console.log("\n=== Decision Constants ===");
  console.log("ALLOWED:", DECISION.ALLOWED);
  console.log("BLOCKED:", DECISION.BLOCKED);
  console.log("PENDING:", DECISION.PENDING);

  console.log("\n=== Example: Build Initialize Transaction ===");
  const initTx = await client.initialize(DEMO_WALLET);
  console.log("Init transaction instructions:", initTx.instructions.length);

  console.log("\n=== Example: Build Register Agent Transaction ===");
  const registerTx = await client.registerAgent(
    DEMO_WALLET,
    "MyTradingBot",
    AGENT_CAPABILITIES.TRANSFER | AGENT_CAPABILITIES.SWAP
  );
  console.log("Register transaction instructions:", registerTx.instructions.length);

  console.log("\n=== Example: Build Set Policy Transaction ===");
  const policyTx = await client.setPolicy(
    DEMO_WALLET,
    [DEMO_PROGRAM_ID],
    5,
    10
  );
  console.log("Policy transaction instructions:", policyTx.instructions.length);

  console.log("\n=== Example: Build Emergency Pause Transaction ===");
  const pauseTx = await client.emergencyPause(DEMO_WALLET);
  console.log("Pause transaction instructions:", pauseTx.instructions.length);

  console.log("\n✅ SDK ready! Run 'npm run build' to build the SDK.");
}

main().catch(console.error);