# Bastion SDK

TypeScript SDK for interacting with the Bastion on-chain audit program and REST API.

## Installation

```bash
npm install @bastion-agentique/sdk
pnpm add @bastion-agentique/sdk
yarn add @bastion-agentique/sdk
```

## Quick Start

```typescript
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { BastionClient, AGENT_CAPABILITIES, DECISION } from "@bastion-agentique/sdk";

const connection = new Connection("https://api.devnet.solana.com");
const client = new BastionClient({ connection });
const wallet = Keypair.generate();

// Register an agent on-chain
const registerTx = await client.registerAgent(wallet, "MyAgent", AGENT_CAPABILITIES.TRANSFER);
await connection.sendTransaction(registerTx, [wallet]);

// Stake SOL for higher transaction limits
const stakeTx = await client.stakeLamports(wallet, 5_000_000_000);
await connection.sendTransaction(stakeTx, [wallet]);

// Set security policy
const jupiter = new PublicKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");
const policyTx = await client.setPolicy(wallet, [jupiter], 1, 10);
await connection.sendTransaction(policyTx, [wallet]);

// Log an audit decision
const logTx = await client.logAudit(wallet, DECISION.ALLOWED, new Array(32).fill(0), "Transaction passed all checks");
await connection.sendTransaction(logTx, [wallet]);

// Emergency pause
const pauseTx = await client.emergencyPause(wallet);
await connection.sendTransaction(pauseTx, [wallet]);
```

## API Reference

### Agent Operations

| Method | Description |
|--------|-------------|
| `registerAgent(signer, name, capabilities)` | Register agent on-chain |
| `fetchAgent(authority)` | Get agent by authority |
| `fetchAllAgents()` | Get all agents (getProgramAccounts) |
| `getAgentAddress(authority)` | Derive agent PDA |
| `getAgentDID(authority)` | Get W3C DID (`did:bastion:solana:{pda}`) |
| `getAuditEntryAddress(index)` | Derive audit entry PDA |

### Staking

| Method | Description |
|--------|-------------|
| `stakeLamports(signer, amount)` | Stake SOL for higher limits |
| `requestUnstake(signer)` | Start 7-day unstake cooldown |
| `claimUnstake(signer)` | Claim SOL after cooldown |
| `fetchAgentStake(authority)` | Get agent stake status |

### Policy

| Method | Description |
|--------|-------------|
| `setPolicy(signer, programs, maxSol, rateLimit)` | Set on-chain policy |
| `fetchPolicy()` | Get current policy |
| `getPolicyAddress()` | Derive policy PDA |

### Audit

| Method | Description |
|--------|-------------|
| `logAudit(signer, decision, simResult, reason, programId?)` | Log audit on-chain |
| `fetchAuditState()` | Get audit stats (total, allowed, blocked) |
| `getAuditStateAddress()` | Derive audit state PDA |

### Circuit Breaker

| Method | Description |
|--------|-------------|
| `emergencyPause(signer)` | Pause protocol |
| `emergencyResume(signer)` | Resume protocol |

### Events

| Method | Description |
|--------|-------------|
| `addEventListener(name, callback)` | Subscribe to on-chain events |
| `removeEventListener(id)` | Remove subscription |

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `AGENT_CAPABILITIES.TRANSFER` | `1 << 0` | Token transfers |
| `AGENT_CAPABILITIES.SWAP` | `1 << 1` | DEX swaps |
| `AGENT_CAPABILITIES.NFT_MINT` | `1 << 2` | NFT minting |
| `AGENT_CAPABILITIES.STAKE` | `1 << 4` | Staking |
| `AGENT_CAPABILITIES.DELEGATE` | `1 << 5` | Spawn sub-agents |
| `DECISION.ALLOWED` | `0` | Transaction allowed |
| `DECISION.BLOCKED` | `1` | Transaction blocked |
| `DECISION.PENDING` | `2` | Awaiting HITL override |

## Program ID

```
A29V5MUVs73y7XBHHxPpPcAW7h4gGHupbDdwYSwA2n9D
```

Deployed on Solana devnet. Program source at [github.com/bastion-agentique/bastion](https://github.com/bastion-agentique/bastion).

## Delegation

Parent agents can spawn sub-agents with delegated authority:

```typescript
// Delegate to child agent
const delegateTx = await client.delegateAgent(
  parentWallet,
  childWallet,
  "SubAgent-ETH",
  AGENT_CAPABILITIES.TRANSFER,       // restricted capabilities
  Math.floor(Date.now() / 1000) + 86400  // 24h expiry
);

// Revoke delegation
const revokeTx = await client.revokeDelegation(parentWallet, childAuthority);

// Fetch delegation tree
const tree = await client.fetchAgentTree(wallet.publicKey);
```

## Staking

Stake SOL to unlock higher transaction limits via StakeWeighted policy:

```typescript
// Stake 5 SOL
const tx = await client.stakeLamports(wallet, 5_000_000_000);

// 48h minimum before unstake, 7-day cooldown
const unstakeTx = await client.requestUnstake(wallet);

// After 7 days, claim your SOL
const claimTx = await client.claimUnstake(wallet);

// Effective limit = base * (1 + stake/min_stake * multiplier) * decay^depth
// Capped at 10x, floored at 0.1x
```

## License

Apache-2.0
