# Bastion — Production Roadmap

> Target: Production-ready by **2026-06-18** (one week from 2026-06-11)

---

## Strategic Decisions (Locked)

| Decision | Rationale |
|---|---|
| **Remove staking mechanism** | SOL-lamport PDAs are Solana-only. Staking duplicates `reputation_score` which already exists on `Agent`. True multichain means chain-agnostic primitives only. |
| **Migrate Solana program to Quasar** | `#![no_std]` + zero-copy reduces binary size ~50–70%, lowering mainnet deployment cost from ~2 SOL → ~0.8–1 SOL. Smaller binary = lower CU per instruction. |
| **Reputation as the universal primitive** | `reputation_score: u64` on `Agent` is representable on Solana (Anchor/Quasar), EVM (uint256 in registry), and Base (via Arcium). All limit enforcement runs through `crates/core` policy engine, not on-chain staking. |

---

## Week of 2026-06-11 → 2026-06-18

### Day 1–2: Remove Staking (Solana Program Cleanup) — DONE

**Goal:** Trim the on-chain program to the minimum viable audit surface.

**What to delete from `crates/solana/programs/bastion-audit/src/lib.rs`:**
- Instructions: `stake_lamports`, `request_unstake`, `claim_unstake`, `slash_stake`
- Context structs: `StakeLamports`, `RequestUnstake`, `ClaimUnstake`, `SlashStake`
- Account: `AgentStake`
- Events: `StakeChanged`, `UnstakeRequested`, `StakeSlashed`
- Errors: `InsufficientStake`, `StakeTooRecent`, `StakeCooldownNotMet`, `NoUnstakeRequested`, `MaxDelegationDepth`

**What stays:** `initialize`, `log_audit`, `register_agent`, `update_agent_reputation`, `set_policy`, `emergency_pause`, `emergency_resume` — the pure audit/identity/policy surface.

**Also remove** the `stake_lamports` instruction reference from `README.md` on-chain table, `packages/sdk/src/index.ts`, and `packages/sdk/src/types.ts`.

**Acceptance:** `cargo check -p bastion-audit` passes, IDL regenerates cleanly, SDK builds.

---

### Day 2–3: Quasar Migration (Solana Program) — BLOCKED on crate maturity

**Status:** Attempted migration to `quasar-lang` v0.0.0 on 2026-06-12. The crate compiles (`#[derive(Accounts)]`, `#[program]`, `Ctx<T>`, `#![no_std]` all resolve) but the published version is missing features documented on quasar-lang.com:

| Feature (docs) | v0.0.0 status |
|---|---|
| `quasar_lang::String<N>` | Not exported |
| `quasar_lang::Vec<T, N>` | Not exported |
| `Clock::get()` via `Sysvar` | Trait not in scope |
| Seed field shorthand (`agent` vs `agent.key().as_ref()`) | Partial |
| `Option<[u8; 32]>: WriteBytes` | Not implemented |
| PodU64/PodBool ergonomic `.into()` | Manual `.into()` needed everywhere |

**When ready:** The migration guide at `quasar-lang.com/docs/getting-started/migrating-from-anchor` is production-quality and the API is well-designed. The program was fully ported (see git history) and will compile once the crate reaches parity with the docs.

**Estimated savings:** Binary size ~50-70% smaller, deploy cost ~2 SOL → ~0.8-1 SOL.

**Steps:**

1. Add `quasar-lang` to `crates/solana/programs/bastion-audit/Cargo.toml`, remove `anchor-lang`.
2. Replace `use anchor_lang::prelude::*` → `use quasar_lang::prelude::*`.
3. Replace `#[program]` module + `pub fn` handlers with `#[instruction(discriminator = N)]` pattern.
4. Replace `#[derive(Accounts)]` structs with Quasar's `#[derive(Accounts)]` (API is similar but constraints differ — see [Quasar accounts docs](https://quasar-lang.com/docs/core-concepts/accounts-and-validation)).
5. Replace `#[account]` data structs — use `&'a str` tail fields where possible (e.g. `AuditEntry.reasoning`, `Agent.name`) to avoid length-prefix overhead.
6. Replace `emit!` → `emit_cpi!` (Quasar event model).
7. Add `#![no_std]` at crate root.
8. Replace `std::mem::size_of` in `space` calculations with explicit byte counts (already done in most places).
9. Regenerate IDL with `quasar build` (outputs compatible JSON — verify against SDK types).
10. Update `crates/solana/Anchor.toml` or replace with `quasar.toml` per Quasar project config.

**Key differences from Anchor to watch:**
- Quasar uses `Ctx<T>` not `Context<T>`
- Discriminators are explicit (`#[instruction(discriminator = N)]`), not hash-derived
- `Result<(), ProgramError>` not `Result<()>` (Anchor's re-export)
- No `require!` macro — use standard `if !cond { return Err(...) }`
- Build for production without `--debug` flag (strips validation log overhead)

**Acceptance:** `quasar build` succeeds, binary is <200 KB, IDL JSON diff is minimal (field names/types unchanged), SDK still compiles against new IDL.

---

### Day 3–4: Wire Reputation as the Cross-Chain Limit Gate

**Goal:** Replace the staking-based limit override with reputation-based limits in `crates/core`.

The staking mechanism gated higher `max_sol_per_tx` by staked SOL amount. Replace this with a `ReputationWeighted` policy rule in the chain-agnostic engine:

**In `crates/core/src/policy/types.rs`**, add:
```rust
/// Scale transaction limits by agent reputation score.
/// Works on any chain — no SOL staking required.
ReputationWeighted {
    /// Base limit (applied when reputation_score = 0)
    base_limit_lamports: u64,
    /// Additional lamports per reputation point
    lamports_per_point: u64,
    /// Hard cap regardless of reputation
    max_limit_lamports: u64,
},
```

**In `crates/sidecar/src/lib.rs`**, populate `NormalizedTransaction.agent_reputation` from `AgentStore` before calling the evaluator (not from the stake PDA, just the sidecar's local agent store or on-chain `Agent.reputation_score`).

**Acceptance:** A simulated transaction from an agent with `reputation_score = 100` passes a higher limit than one with `reputation_score = 0`, with no on-chain staking involved.

---

### Day 4–5: SDK + IDL Sync

**Goal:** Ensure `packages/sdk` reflects the trimmed program surface.

- Remove `stakeAgent()`, `requestUnstake()`, `claimUnstake()` from `packages/sdk/src/index.ts`
- Remove `AgentStake` from `packages/sdk/src/types.ts`
- Update `packages/sdk/src/idl.json` with the new Quasar-generated IDL
- Bump SDK version to `0.6.0` in `packages/sdk/package.json`
- Update `packages/sdk/README.md` if it references staking

**Acceptance:** `pnpm --filter @bastion-agentique/sdk build` passes with no type errors.

---

### Day 5–6: Dashboard Cleanup + Mainnet Config

**Goal:** Remove staking UI, add mainnet deploy config.

**Dashboard (`apps/web`):**
- Remove any staking-related UI from `Dashboard.tsx` or `Integrate.tsx`
- Update on-chain instruction table in `README.md` to reflect final instruction set
- Add `VITE_SOLANA_CLUSTER=mainnet-beta` to `.env.production`

**Deployment prep:**
```bash
# Verify binary size after Quasar build
quasar build
ls -lh target/deploy/bastion_audit.so

# Dry-run mainnet deploy cost estimate
solana program deploy --dry-run target/deploy/bastion_audit.so --url mainnet-beta
```

**Acceptance:** Dashboard builds (`pnpm --filter bastion-dashboard build`), no console errors referencing removed staking instructions.

---

### Day 6–7: Mainnet Deploy + Smoke Test

**Goal:** Program live on mainnet, all CI green.

1. Fund deployer wallet with ~2.5 SOL (buffer above estimated cost)
2. `anchor deploy --provider.cluster mainnet-beta` (or `quasar deploy` if migration is complete)
3. Update `declare_id!` in `lib.rs` with new mainnet program ID
4. Update `packages/sdk/src/idl.json` and `apps/web/src/idl.json` with mainnet program ID
5. Push to `main` → CI runs all 7 jobs → Netlify/Vercel auto-deploy
6. Smoke test: `POST /simulate` against fly.dev sidecar with a real devnet tx, verify audit entry lands on mainnet

---

## Post-Production Backlog (after 2026-06-18)

These are from `IMPROVEMENTS.md` — prioritized but not blocking production:

| # | Feature | Notes |
|---|---|---|
| 1 | Reputation feedback loop (auto-strike on block) | `~100 lines Rust`, closes on-chain accountability gap |
| 2 | Webhook on block events | `~80 lines Rust`, immediate operator value |
| 3 | HITL approval UI in dashboard | Completes `PendingHITL` flow that already exists in core |
| 4 | AI intent scoring (heuristic) | Differentiates from rule-only firewalls |
| 5 | EVM hooks wired in dashboard | `useBastionEVM.ts` stubs need `useReadContract`/`useWriteContract` |
| 6 | Behavioral baseline per agent | Requires data pipeline, strongest long-term moat |

---

## Invariants (don't break these)

- `crates/core` must stay chain-agnostic — no Solana or EVM imports
- On-chain program must only contain audit/identity/policy primitives — no financial instruments
- SDK major version bump required if IDL instruction set changes
- `main` branch must always pass all 7 CI jobs before merge
