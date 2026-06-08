# Bastion Dashboard

The Bastion dashboard provides real-time monitoring and control over your
AI agent firewall.

## Dashboard Sections

- **Audit Logs** — View all transaction decisions with timestamps, signatures, and reasoning
- **Pending Approvals** — Human-in-the-loop queue for suspicious transactions
- **Policy** — Configure allowed programs, SOL caps, rate limits, and blockint rules
- **Circuit Breaker** — Emergency pause/resume for the entire protocol

## API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| GET `/logs` | Fetch paginated audit entries |
| GET `/pending` | List transactions awaiting human approval |
| POST `/override` | Approve or reject pending transactions |
| GET `/policy` | Read current policy configuration |
| POST `/policy` | Update policy settings |
| GET `/circuit-breaker/status` | Check if circuit breaker is engaged |
| POST `/circuit-breaker/engage` | Activate emergency pause |
| POST `/circuit-breaker/disengage` | Resume protocol |

## Links

- **Home**: /
- **Integrate**: /integrate
- **GitHub**: https://github.com/bastion-agentique/bastion
