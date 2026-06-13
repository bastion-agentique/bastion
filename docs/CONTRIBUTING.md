# Contributing to Bastion

## Prerequisites

- **Rust** 1.85+ (stable) — `rustup default stable`
- **Node.js** 20+ — `node --version`
- **pnpm** — `npm install -g pnpm`
- **Anchor CLI** 0.30.1 — `avm install 0.30.1 && avm use 0.30.1`
- **Foundry** (for EVM) — `curl -L https://foundry.paradigm.xyz | bash`
- **Docker** (optional, for containerized deployment)

## Getting Started

```bash
# Clone
git clone https://github.com/bastion-agentique/bastion.git
cd bastion

# Install JS dependencies
pnpm install

# Build all Rust crates
cargo build

# Run all Rust tests
cargo test

# Build and test EVM contracts
cd evm && forge build && forge test && cd ..

# Build dashboard
cd apps/web && pnpm build && cd ../..
```

## Repository Structure

```
bastion/
├── crates/core/          → cargo test -p bastion-core
├── crates/sidecar/       → cargo test -p bastion-sidecar
├── crates/web2-firewall/ → cargo test -p bastion-web2-firewall
├── crates/correlation/   → cargo test -p bastion-correlation
├── crates/solana/        → cd crates/solana && anchor test
├── evm/                  → cd evm && forge test
├── apps/web/             → cd apps/web && pnpm dev
├── packages/sdk/         → cd packages/sdk && pnpm build && pnpm test
└── packages/web2-sdk/    → cd packages/web2-sdk && pnpm build && pnpm test
```

## Development Workflow

### Rust (crates/)

```bash
# Check compilation
cargo check

# Run all tests
cargo test

# Run specific crate tests
cargo test -p bastion-core
cargo test -p bastion-sidecar
cargo test -p bastion-web2-firewall

# Format
cargo fmt

# Lint
cargo clippy -- -D warnings
```

### Solana (crates/solana/)

```bash
cd crates/solana

# Build Anchor program
anchor build

# Run Anchor tests (requires local validator)
anchor test

# Deploy to devnet
anchor deploy --provider.cluster devnet
```

### EVM (evm/)

```bash
cd evm

# Install dependencies
forge install

# Build
forge build

# Run tests
forge test -vvv

# Gas report
forge test --gas-report

# Deploy to Base Sepolia
forge script script/DeployBastion.s.sol --rpc-url base_sepolia --broadcast --verify
```

### Dashboard (apps/web/)

```bash
cd apps/web

# Dev server
pnpm dev

# Build
pnpm build

# Preview
pnpm preview
```

### TypeScript SDK (packages/sdk/)

```bash
cd packages/sdk

# Build
pnpm build

# Run tests (jest)
pnpm test
```

### Web2 SDK (packages/web2-sdk/)

```bash
cd packages/web2-sdk

# Build
pnpm build

# Run tests (jest)
pnpm test
```

## Testing Guidelines

- **Unit tests** go in the same file as the code (`#[cfg(test)] mod tests` for Rust)
- **TypeScript tests** use jest with ts-jest, co-located in `src/*.test.ts`
- **Integration tests** go in `tests/` directory at crate root
- **Policy tests** should cover: pass, block, HITL trigger for each rule type
- **EVM tests** should use Foundry's cheatcodes for state manipulation
- **Ensure all tests pass before opening a PR**

## Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — new feature
- `fix:` — bug fix
- `chore:` — maintenance, dependencies
- `docs:` — documentation
- `test:` — test additions or changes
- `refactor:` — code restructuring without behavior change

## Pull Request Checklist

- [ ] All Rust tests pass (`cargo test -p bastion-core -p bastion-web2-firewall`)
- [ ] All TypeScript tests pass (`pnpm -r test`)
- [ ] All builds succeed (`pnpm -r build`)
- [ ] Code is formatted (`cargo fmt && forge fmt`)
- [ ] No new clippy warnings (`cargo clippy -p bastion-core -p bastion-sidecar -p bastion-web2-firewall -- -D warnings`)
- [ ] PR targets `main` branch
- [ ] Commit messages follow conventional commits
- [ ] Commits are GPG signed

## CI

GitHub Actions runs on every push and PR (see `.github/workflows/ci.yml`):

- Rust: `cargo fmt --check`, `cargo clippy`, `cargo test` (core, sidecar, web2-firewall, correlation, solana)
- EVM: `forge build`, `forge test -vvv`
- Dashboard: `pnpm install`, `pnpm --filter bastion-dashboard build`
- SDK: `pnpm install`, `pnpm --filter @bastion-agentique/sdk build`

## Security

If you discover a security vulnerability, please do NOT open a public issue.
Email the maintainers directly. See [SECURITY.md](../SECURITY.md) for details.

## License

Apache-2.0 — see the [LICENSE](../LICENSE) file.
