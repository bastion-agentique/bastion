# Bastion EVM

On-chain transaction firewall for autonomous AI agents on Ethereum. ERC-7579 compatible validator module. Policy engine with per-agent rules. Immutable audit trail with EIP-712 typed data.

**Status:** v0.1.0 | Solidity 0.8.28 | Foundry | via-ir optimized

## Architecture

```
AI Agent Wallet (ERC-7579 Smart Account)
       │
       ▼
┌─────────────────────┐
│  BastionFirewall    │  ← ERC-7579 Validator Module
│  • validateUserOp() │
│  • onInstall()      │
│  • onUninstall()    │
└──────┬──────────────┘
       │ checks
       ▼
┌─────────────────────┐     ┌─────────────────────┐
│  BastionPolicy      │     │  BastionAudit        │
│  • allowlist bitmap │     │  • EIP-712 entries   │
│  • value limits     │     │  • append-only       │
│  • rate limits      │     │  • per-agent query   │
│  • cooldown         │     │  • signature trail   │
└─────────────────────┘     └─────────────────────┘
       │
       ▼
┌─────────────────────┐
│  BastionRegistry    │
│  • agent directory  │
│  • target directory │
│  • verified targets │
└─────────────────────┘
```

## Contracts

| Contract | Description | Standards |
|----------|-------------|-----------|
| `BastionFirewall` | ERC-7579 validator that gates agent transactions | ERC-7579, ERC-4337, ERC-712 |
| `BastionPolicy` | Per-agent rules: targets, selectors, value limits, rate limits, cooldown | ERC-7579 hooks |
| `BastionAudit` | Immutable on-chain audit log with EIP-712 typed data | EIP-712 |
| `BastionRegistry` | Directory of agents, targets, and verified contracts | Custom |

## Quick Start

```bash
# Install dependencies
forge install

# Build
forge build

# Run tests
forge test -vvv

# Gas report
forge test --gas-report

# Deploy to Base
forge script script/DeployBastion.s.sol --rpc-url base --broadcast --verify -vvvv

# Deploy to Polygon
forge script script/DeployBastion.s.sol --rpc-url polygon --broadcast --verify -vvvv
```

## How It Works

1. An AI agent deploys an ERC-7579 smart account and installs BastionFirewall as a validator module
2. The agent owner registers a policy: which contracts the agent can call, which functions, max value per tx, max gas, daily tx limit, cooldown period
3. Every user operation passes through `validateUserOp()` which checks the policy bitmap in O(1)
4. Allowed transactions are recorded in BastionAudit with a verifiable EIP-712 signature
5. Blocked transactions are also recorded with the rejection reason for auditability
6. The Registry provides discoverability: which agents exist, which targets are verified

## Gas Optimization

- Selector allowlist uses bitmap packing: `uint256` bitmask for O(1) selector checks
- Policy engine stateless-view for checkTransaction (firewall handles state mutation)
- via-ir compilation pipeline enabled
- 2000 optimizer runs
- SLOAD/SSTORE minimized in hot path (validateUserOp)

## Grant Compatibility

This contract suite is designed for:
- **Base Builder Grants** (1-5 ETH, tooling & infra)
- **Polygon Community Grants** (building on Polygon)
- **Arbitrum Foundation Grants** (impactful DApps on Arbitrum)

## License

MIT
