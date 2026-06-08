# Integrate Bastion — SDK & API

Bastion provides a TypeScript SDK and REST API for integrating the
AI agent firewall into your application.

## Install the SDK

```bash
npm install @bastion-agentique/sdk
```

## Basic Usage (SDK)

```typescript
import { BastionClient } from "@bastion-agentique/sdk";

const client = new BastionClient({ baseUrl: "https://bastion-agentique.fly.dev/" });

// Simulate a transaction
const result = await client.simulate({
  transaction: base64Tx,
  intent: "Swap 1 SOL for USDC on Jupiter",
});

if (result.status === "allowed") {
  // Proceed to sign and broadcast
} else if (result.blockId) {
  // Human approval needed — show block_id to user
  console.log("Block reason:", result.error);
}
```

## REST API

```bash
# Simulate a transaction
curl -X POST https://bastion-agentique.fly.dev//simulate \
  -H "Content-Type: application/json" \
  -d '{"transaction": "...", "intent": "Swap 1 SOL for USDC"}'

# Get current policy
curl https://bastion-agentique.fly.dev//policy

# Get audit logs
curl https://bastion-agentique.fly.dev//logs?limit=50

# Human override
curl -X POST https://bastion-agentique.fly.dev//override \
  -H "Content-Type: application/json" \
  -d '{"block_id": "...", "action": "ALLOW"}'
```

## Supported Chains

- Solana (primary)
- Celo (EVM)
- Midnight (Compact/ZK)
- Base, Ethereum, Polygon, Arbitrum (via chain-agnostic core)

## Links

- **NPM**: https://www.npmjs.com/package/@bastion-agentique/sdk
- **API Reference**: https://github.com/bastion-agentique/bastion#readme
