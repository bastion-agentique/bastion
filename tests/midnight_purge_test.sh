#!/bin/bash
# TDD Test: Midnight Purge Verification
# This script verifies that ALL Midnight blockchain references have been
# removed from the Bastion codebase. Only "UTC midnight" (time-of-day)
# references are allowed.
#
# Exit code 0 = PASS, 1 = FAIL

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAIL=0

echo "=== Midnight Purge Verification Test ==="
echo "Repo: $REPO_ROOT"
echo ""

# ─── Test 1: No Midnight references in Rust source (outside midnight/ dir) ───
echo "TEST 1: No Midnight references in Rust source files"
HITS=$(grep -rn "[Mm]idnight" --include="*.rs" "$REPO_ROOT/crates/" 2>/dev/null || true)
if [ -n "$HITS" ]; then
    echo "  FAIL: Found Midnight references in Rust source:"
    echo "$HITS"
    FAIL=1
else
    echo "  PASS"
fi

# ─── Test 2: No Midnight references in TypeScript source (outside midnight/ dir) ───
echo "TEST 2: No Midnight references in TypeScript source files"
HITS=$(grep -rn "[Mm]idnight" --include="*.ts" --include="*.tsx" "$REPO_ROOT/packages/" "$REPO_ROOT/apps/" 2>/dev/null || true)
if [ -n "$HITS" ]; then
    echo "  FAIL: Found Midnight references in TypeScript source:"
    echo "$HITS"
    FAIL=1
else
    echo "  PASS"
fi

# ─── Test 3: No midnight/ directory exists ───
echo "TEST 3: midnight/ directory does not exist"
if [ -d "$REPO_ROOT/midnight" ]; then
    echo "  FAIL: midnight/ directory still exists"
    FAIL=1
else
    echo "  PASS"
fi

# ─── Test 4: No Midnight in docs/ (excluding rewrite.md plan file and "UTC midnight") ───
echo "TEST 4: No Midnight references in docs/ files"
HITS=$(grep -rn "[Mm]idnight" --include="*.md" "$REPO_ROOT/docs/" 2>/dev/null \
    | grep -v "rewrite.md" \
    | grep -v "UTC midnight" \
    | grep -v "utc midnight" \
    || true)
if [ -n "$HITS" ]; then
    echo "  FAIL: Found Midnight references in docs:"
    echo "$HITS"
    FAIL=1
else
    echo "  PASS"
fi

# ─── Test 5: No Midnight in root .md files ───
echo "TEST 5: No Midnight references in root .md files"
HITS=$(grep -rn "[Mm]idnight" --include="*.md" "$REPO_ROOT/"*.md 2>/dev/null \
    | grep -v "UTC midnight" \
    | grep -v "utc midnight" \
    || true)
if [ -n "$HITS" ]; then
    echo "  FAIL: Found Midnight references in root .md files:"
    echo "$HITS"
    FAIL=1
else
    echo "  PASS"
fi

# ─── Test 6: No Midnight in apps/web/public/ ───
echo "TEST 6: No Midnight references in apps/web/public/"
HITS=$(grep -rn "[Mm]idnight" --include="*.md" --include="*.html" "$REPO_ROOT/apps/web/public/" 2>/dev/null || true)
if [ -n "$HITS" ]; then
    echo "  FAIL: Found Midnight references in public files:"
    echo "$HITS"
    FAIL=1
else
    echo "  PASS"
fi

# ─── Test 7: No Midnight in .agents/skills/ ───
echo "TEST 7: No Midnight references in .agents/skills/"
HITS=$(grep -rn "[Mm]idnight" --include="*.md" "$REPO_ROOT/.agents/skills/" 2>/dev/null || true)
if [ -n "$HITS" ]; then
    echo "  FAIL: Found Midnight references in skills:"
    echo "$HITS"
    FAIL=1
else
    echo "  PASS"
fi

# ─── Test 8: Chain enum does not contain Midnight ───
echo "TEST 8: Chain enum in normalized.rs has no Midnight variant"
HITS=$(grep -n "Midnight" "$REPO_ROOT/crates/core/src/transaction/normalized.rs" 2>/dev/null || true)
if [ -n "$HITS" ]; then
    echo "  FAIL: Midnight found in Chain enum:"
    echo "$HITS"
    FAIL=1
else
    echo "  PASS"
fi

# ─── Test 9: No bastion-enterprise references ───
echo "TEST 9: No bastion-enterprise references in source code"
HITS=$(grep -rn "bastion-enterprise\|bastion_enterprise\|Bastion Enterprise" --include="*.rs" --include="*.ts" --include="*.tsx" --include="*.toml" "$REPO_ROOT/" 2>/dev/null \
    | grep -v node_modules \
    || true)
if [ -n "$HITS" ]; then
    echo "  FAIL: Found bastion-enterprise references in source:"
    echo "$HITS"
    FAIL=1
else
    echo "  PASS"
fi

# ─── Test 10: Arcium MXE is in tech stack ───
echo "TEST 10: Arcium MXE present in AGENTS.md tech stack"
if grep -q "Arcium MXE" "$REPO_ROOT/AGENTS.md" 2>/dev/null; then
    echo "  PASS"
else
    echo "  FAIL: Arcium MXE not found in AGENTS.md tech stack"
    FAIL=1
fi

# ─── Summary ───
echo ""
if [ $FAIL -eq 0 ]; then
    echo "=== ALL TESTS PASSED ==="
    exit 0
else
    echo "=== SOME TESTS FAILED ==="
    exit 1
fi
