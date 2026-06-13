  I have a thorough understanding of the codebase. Let me now formulate the plan.
  
  Summary: You want to rewrite all project documentation and narrative content (.md files, skills files, tech stack tables, architecture descriptions) to reflect the new "Bastion Master Plan" — Pure SVM + Arcium
  architecture, EVM hub-and-spoke via Base with Arcium signature verification, Daemon BlockInt threat intelligence, and enterprise GTM — while completely removing all Midnight blockchain references from both docs
  and source code.
  
  ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  
  Implementation Plan — Bastion Master Plan Narrative Overhaul + Midnight Purge
  
  Problem Statement:
  
  The codebase still references Midnight Network throughout docs and source files. The strategic vision has shifted to a pure SVM + Arcium + Base hub-and-spoke model. All documentation, skill files, and stray
  source code references must reflect the new plan and the Midnight integration must be fully removed.
  
  Requirements gathered:
  
  - Remove ALL Midnight references from .md files, .ts, .tsx, .rs, source files
  - Delete or gut the midnight/ directory contents (or mark as archived/deleted)
  - Update README, AGENTS.md, SKILL.md, SPEC.md to reflect the Master Plan: Pure SVM + Arcium + Base EVM spoke
  - Update ARCHITECTURE.md to remove the Midnight box and add Arcium MXE layer and Base spoke
  - Update ROADMAP.md, CHANGELOG.md, CONTRIBUTING.md, POSITIONING.md to reflect new stack
  - Update tech stack tables everywhere (remove Midnight ZK, add Arcium MXEs + Arcis)
  - Update apps/web/Dashboard.tsx to remove any Midnight chain selector
  - Update crates/sidecar/src/did.rs, core_adapter.rs, normalized.rs to remove Midnight chain enum values
  - Update MCP server index.ts to remove Midnight references
  - Incorporate Solana Agent Skills, Arcium docs, and Base docs as the new canonical skill/integration references
  
  Background:
  
  - 16 .md files contain Midnight references (80 total occurrences)
  - 4 .ts files contain Midnight references (7 occurrences, mostly in midnight/ dir)
  - 6 .rs files contain Midnight references (16 occurrences, 3 in midnight/ dir, 3 in crates/)
  - 1 .toml has Midnight (in midnight/ dir)
  - 5 .tsx files (7 in midnight/ dir, 3 in apps/web)
  - The midnight/ directory is a self-contained module that should be treated as deprecated/removed
  - The crates/sidecar/src/did.rs has a Midnight DID method, normalized.rs has a Midnight chain enum value, core_adapter.rs has a Midnight reference
  - packages/mcp-server/src/index.ts has one Midnight reference
  - apps/web/src/pages/Dashboard.tsx has two Midnight references (chain selector)
  
  Proposed Solution:
  
  Replace all Midnight narrative with the four-phase Master Plan. The Arcium MXE replaces Midnight's ZK-compliance role. Base (via Arcium signature spoke) replaces the EVM bridge complexity. Remove Midnight chain
  support from source enums/DIDs. Mark the midnight/ directory as sunset.
  
  ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  
  Task Breakdown:
  
  Task 1: Update README.md
  
  - Objective: Completely rewrite README to reflect the Master Plan narrative, new tech stack (drop Midnight ZK row, add Arcium MXEs + Arcis), new architecture diagram, updated competitive table
  - Implementation: Replace "ZK Privacy: Midnight Compact" row with "Confidentiality Engine: Arcium MXEs, Arcis (Rust MPC circuits)". Update architecture section with Phase 1-4 from the Master Plan. Update the
  evm/README.md link to reflect Arcium-verified Base spoke, not a dual-VM bridge. Remove the Midnight ZK row from the tech stack table.
  - Demo: README accurately describes the new stack with no Midnight mentions
  
  Task 2: Update AGENTS.md
  
  - Objective: Remove the 3 Midnight rows from AGENTS.md — specifically the "Midnight ZK" tech stack row, the midnight/ project structure entry, and the Midnight prerequisite
  - Implementation: Remove the Midnight ZK row in the tech stack table. Remove ├── midnight/ from the project structure. Remove any Midnight-related install or getting-started step.
  - Demo: AGENTS.md tech stack table and project structure are Midnight-free
  
  Task 3: Update SKILL.md and SPEC.md
  
  - Objective: Remove Midnight references and replace with Arcium narrative
  - Implementation: In SKILL.md, replace any mention of Midnight ZK compliance with "Arcium off-chain MPC compliance via MXEs". In SPEC.md, update the roadmap and tech stack sections.
  - Demo: Both files accurately describe the Arcium-based compliance mechanism
  
  Task 4: Update docs/ARCHITECTURE.md
  
  - Objective: Remove the Midnight box from the architecture diagram and add Arcium MXE layer and Base spoke
  - Implementation: Replace │ Midnight │ in the ASCII diagram with │ Arcium │. Remove "Midnight Network" from the component list. Add a new "Arcium MXE — Confidentiality Engine" component section describing MPC
  execution, Cerberus protocol, Arcis circuits. Add "Base Spoke — EVM Hub-and-Spoke" describing the Arcium signature verification pattern. Remove ├── midnight/ from the structure.
  - Demo: Architecture diagram and component descriptions match the Master Plan exactly
  
  Task 5: Update remaining docs/ files
  
  - Objective: Remove Midnight references from ROADMAP.md, PRD_SIEM_EXPANSION.md, LITEBEAM_COMPETITIVE_ANALYSIS.md, WEB2_EXPANSION_PLAN.md, CHANGELOG.md, CONTRIBUTING.md, DELEGATION_SYSTEM.md
  - Implementation: Replace Midnight mentions with Arcium where applicable, remove sunset items, update competitive analysis to reflect "no dual-VM complexity" as a Bastion advantage
  - Demo: All docs/ files are Midnight-free
  
  Task 6: Update other root-level files
  
  - Objective: Remove Midnight from SECURITY.md, SESSION_SUMMARY.md, POSITIONING.md, chat.md, and apps/web/public/integrate.md
  - Implementation: Strip Midnight references; replace with Arcium/Base narrative where contextually appropriate
  - Demo: All root .md files and web app public docs are Midnight-free
  
  Task 7: Remove Midnight from source code — Rust crates
  
  - Objective: Remove Midnight chain variant from crates/core/src/transaction/normalized.rs, remove Midnight DID method from crates/sidecar/src/did.rs, remove Midnight reference from
  crates/sidecar/src/core_adapter.rs
  - Implementation: In normalized.rs, remove Midnight from the Chain enum. In did.rs, remove any did:midnight:* resolution branch. In core_adapter.rs, remove the Midnight chain mapping.
  - Test: The project still compiles (cargo check) with Midnight removed from enums
  - Demo: cargo check passes, no Midnight chain support in the policy engine
  
  Task 8: Remove Midnight from source code — TypeScript
  
  - Objective: Remove Midnight reference from packages/mcp-server/src/index.ts and apps/web/src/pages/Dashboard.tsx
  - Implementation: In index.ts, remove the one Midnight mention. In Dashboard.tsx, remove the Midnight chain selector option (2 references). Replace with Base chain option if a chain selector exists.
  - Test: pnpm build passes for affected packages
  - Demo: Dashboard no longer shows Midnight as a chain option; MCP server has no Midnight mentions
  
  Task 9: Gut/archive the midnight/ directory
  
  - Objective: Mark the midnight/ directory as fully sunsetted per Phase 1 of the Master Plan
  - Implementation: Replace midnight/README.md with a single deprecation notice: "This directory has been sunset as of the Bastion Master Plan Phase 1 (Midnight Purge). All ZK-compliance functionality has
  migrated to Arcium MXEs." Remove or stub the content of midnight/SPEC.md, midnight/sdk/, midnight/dashboard/, midnight/middleware/, midnight/contract/ — leaving only tombstone README files so git history is
  preserved. Do NOT delete files (git history is valuable); replace their content with a one-liner deprecation notice.
  - Demo: The midnight/ directory exists but contains only deprecation notices, no functional code
  
  Task 10: Update skills files and .agents/skills
  
  - Objective: Add Arcium and Base skill references to the skills ecosystem; remove any Midnight skill references
  - Implementation: Check .agents/skills/ for any Midnight-referencing skill files and update them. Add references to the Solana Agent Skills (from the context), Arcium docs skill, and Base docs skill in SKILL.md
  and README.md skill sections.
  - Demo: Skills section references Arcium and Base canonical docs, no Midnight skills remain
  
  Does this plan look good, or would you like me to adjust anything?
