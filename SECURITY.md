# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.2.0 | Yes |

## Reporting a Vulnerability

If you find a security vulnerability, please report it to hello@bastionagentique.com. We appreciate responsible disclosure.

## Known Issues

### Solana SDK Transitive Dependencies

Bastion uses the Solana SDK which has transitive dependencies with known advisories:

- **RUSTSEC-2026-0097**: rand 0.7.3 / 0.8.5 - unsound with custom logger (used by solana_rbpf, tungstenite)
- **RUSTSEC-2026-0012**: keccak 0.1.5 - unsound ARMv8 assembly (used by sha3 -> solana-zk-token-sdk)
- **RUSTSEC-2023-0033**: borsh 0.9.3 - unsound ZST parsing (used by solana-program)
- **RUSTSEC-2025-0010**: ring 0.16.20 - unmaintained (used by quinn, hyper)
- **RUSTSEC-2025-0134**: rustls-pemfile - unmaintained
- **RUSTSEC-2021-0145**: atty - unsound unaligned read
- **RUSTSEC-2025-0119**: number_prefix - unmaintained (used by indicatif)
- **RUSTSEC-2024-0436**: paste - unmaintained (used by ark-ff)

**Mitigation**: These are inherited from Solana's official SDK. They don't represent vulnerabilities in Bastion's code - they're known trade-offs from using Solana's infrastructure. Solana team is aware and working on updates.

## Security Architecture

Bastion provides multiple defense layers:

1. **Transaction Interception** - All transactions go through policy checks
2. **Simulation** - Helius API for outcome prediction
3. **Whitelist Mode** - Only approved programs can be called
4. **Rate Limiting** - Configurable tx/minute caps
5. **Balance Caps** - Per-transaction and total drain limits
6. **Emergency Pause** - Circuit breaker for protocol-wide safety
7. **On-Chain Audit** - Immutable audit trail for accountability
8. **Agent Reputation** - On-chain identity and reputation tracking