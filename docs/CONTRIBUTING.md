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
├── crates/core/       → cargo test -p bastion-core
├── crates/sidecar/    → cargo test -p bastion-sidecar
├── crates/solana/     → cd crates/solana && anchor test
├── evm/               → cd evm && forge test
├── midnight/          → see midnight/README.md
├── apps/web/          → cd apps/web && pnpm dev
└── packages/sdk/      → cd packages/sdk && pnpm build
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

# Run tests
pnpm test
```

## Testing Guidelines

- **Unit tests** go in the same file as the code (`#[cfg(test)] mod tests` for Rust)
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

- [ ] All tests pass (`cargo test && cd evm && forge test`)
- [ ] Code is formatted (`cargo fmt && forge fmt`)
- [ ] No new clippy warnings (`cargo clippy -- -D warnings`)
- [ ] PR targets `main` branch
- [ ] Commit messages follow conventional commits

## CI

GitHub Actions runs on every push and PR:

- Rust: `cargo fmt --check`, `cargo clippy`, `cargo test`
- EVM: `forge build`, `forge test`
- Dashboard: `pnpm build`

## Security

If you discover a security vulnerability, please do NOT open a public issue.
Email the maintainers directly. See [SECURITY.md](../SECURITY.md) for details.

## License

MIT — see the [LICENSE](../LICENSE) file (forthcoming).
