# Bastion — Multichain AI Agent Firewall

Bastion is a high-performance security middleware for autonomous AI agents
on Solana, Celo, and EVM chains. It acts as a deterministic barrier between
an agent's non-deterministic logic and its wallet.

## What Bastion does

- **Transaction simulation** — Predicts balance changes via Helius before signing
- **Policy engine** — Program whitelists, SOL caps, rate limits, blockint rules
- **On-chain audit** — Immutable audit trail on Solana (Anchor program)
- **Agent registry** — On-chain agent identity and reputation
- **Human-in-the-loop** — Manual override for suspicious transactions
- **Circuit breaker** — Emergency pause for the entire protocol
- **GrondOSINT oracle** — Address risk scoring via agentic OSINT pipeline

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/simulate` | Simulate and evaluate a transaction |
| GET | `/policy` | Get current policy configuration |
| POST | `/policy` | Update policy settings |
| GET | `/logs` | Retrieve audit logs |
| POST | `/override` | Human override for blocked transactions |
| GET | `/health` | Server health check |
| GET | `/circuit-breaker/status` | Check circuit breaker state |
| POST | `/circuit-breaker/engage` | Activate circuit breaker |
| POST | `/circuit-breaker/disengage` | Deactivate circuit breaker |
| POST | `/api/v2/evaluate` | Chain-agnostic policy evaluation |

## Quick Start

```bash
git clone https://github.com/bastion-agentic-defense/bastion.git
cd bastion
cargo build --release
export HELIUS_API_KEY="your-api-key"
export GROND_API_URL="http://localhost:8000"  # optional
cargo run --release
```

## Links

- **GitHub**: https://github.com/bastion-agentic-defense/bastion
- **Docs**: https://github.com/bastion-agentic-defense/bastion#readme
- **SDK**: https://www.npmjs.com/package/@bastion-agentique/sdk
- **Grond OSINT**: https://github.com/daemon-blockint-tech/Grond
