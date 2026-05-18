# Bastion SDK

TypeScript SDK for interacting with the Bastion on-chain audit program.

## Installation

```bash
npm install @bastion/sdk
```

## Usage

```typescript
import { Connection } from "@solana/web3.js";
import { BastionClient, AGENT_CAPABILITIES, DECISION } from "@bastion/sdk";

const connection = new Connection("https://api.devnet.solana.com");

const client = new BastionClient({
  connection,
});

// Get PDA addresses
const auditState = client.getAuditStateAddress();
const agent = client.getAgentAddress(wallet.publicKey);
const policy = client.getPolicyAddress();

// Initialize audit state
const initTx = await client.initialize(wallet);
const signature = await connection.sendTransaction(initTx, [wallet]);

// Register an agent
const registerTx = await client.registerAgent(
  wallet,
  "MyTradingBot",
  AGENT_CAPABILITIES.TRANSFER | AGENT_CAPABILITIES.SWAP
);
await connection.sendTransaction(registerTx, [wallet]);

// Set policy
const policyTx = await client.setPolicy(
  wallet,
  [jupiterProgram, tokenProgram],
  5,  // max 5 SOL per tx
  10   // rate limit: 10 tx/min
);
await connection.sendTransaction(policyTx, [wallet]);

// Emergency circuit breaker
const pauseTx = await client.emergencyPause(wallet);
await connection.sendTransaction(pauseTx, [wallet]);
```

## API

### Client Methods

| Method | Description |
|--------|-------------|
| `initialize()` | Initialize audit state PDA |
| `logAudit()` | Log transaction audit |
| `registerAgent()` | Register agent on-chain |
| `updateAgentReputation()` | Update agent reputation |
| `setPolicy()` | Set on-chain policy |
| `emergencyPause()` | Pause protocol (circuit breaker) |
| `emergencyResume()` | Resume protocol |
| `getAuditStateAddress()` | Get audit state PDA |
| `getAgentAddress()` | Get agent PDA |
| `getPolicyAddress()` | Get policy PDA |

### Constants

| Constant | Value |
|----------|-------|
| `BASTION_PROGRAM_ID` | `BaStion111...` |
| `AGENT_CAPABILITIES.TRANSFER` | Transfer tokens |
| `AGENT_CAPABILITIES.SWAP` | DEX swaps |
| `AGENT_CAPABILITIES.NFT_MINT` | Mint NFTs |
| `AGENT_CAPABILITIES.STAKE` | Staking |
| `DECISION.ALLOWED` | 0 |
| `DECISION.BLOCKED` | 1 |

## Program ID

```
BaStion11111111111111111111111111111111
```

## License

MIT