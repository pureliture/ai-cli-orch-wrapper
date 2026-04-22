# Ultrareview Findings — aco-v2-context-sync-layer

**Branch:** chore/remove-copilot-legacy-src-and-ci  
**Scope:** 48 files changed, 301 insertions(+), 1750 deletions(-)  
**Date:** 2026-04-22

---

## severity: normal

### bug_034 — CodexProvider no longer forwards --reasoning-effort
**File:** `internal/provider/codex.go:42-48`  
**Issue:** `CodexProvider.BuildArgs` previously forwarded `--reasoning-effort <value>` when `opts.ReasoningEffort` was set, but this PR removed that block and pipes `opts.ExtraArgs` through `filterUnsupportedArgs`, which unconditionally strips `--reasoning-effort`.  
**Resolution:** **WONTFIX** — `design.md` Decision 6 explicitly states: "Neither provider runtime SHALL pass `--reasoning-effort`." The `reasoningEffort` field is mapped to `.codex/agents/*.toml` as `model_reasoning_effort` (config-level), not CLI flag. The ultrareview claim that Codex CLI supports `--reasoning-effort` as a native flag contradicts the verified CLI surface table (design.md line 14: "Reasoning effort flag | no `--reasoning-effort` CLI flag").

### bug_019 — Env var contract doc contradicts itself
**File:** `docs/contract/go-node-boundary.md:33, 113-137`  
**Issue:** Section 6 states only `ACO_TIMEOUT_SECONDS` is passed and `PATH`/`HOME`/`USER`/`GEMINI_API_KEY`/`ANTHROPIC_API_KEY` are blocked, while the new "Environment Variable Allowlist" section lists all of them as allowed.  
**Resolution:** **PENDING** — Not introduced by this PR. The doc inconsistency pre-exists. Should be fixed in a separate doc-maintenance PR.

---

## severity: normal (merged findings)

### merged_bug_002 — filterUnsupportedArgs has two defects
**File:** `internal/provider/errors.go:86-104`  
**Issues:**
1. **Value leak:** When `--reasoning-effort` is matched, `continue` skips only the flag; the loop counter `i++` still advances, so the following value (e.g. `high`) is kept as a stray positional arg.
2. **Equals-form miss:** Map keys `--reasoning-effort=` only match literal empty-value string, so `--reasoning-effort=high` passes through untouched.
**Also:** `providerName` parameter and `ValidationError` type are unused (dead scaffolding).  
**Resolution:** **FIXED** — Applied the suggested fix. Also removed unused `providerName` parameter and updated call sites in `codex.go` and `gemini_cli.go`. Added `strings` import. See commit.

### merged_bug_001 — sync-engine module import (LIKELY FALSE POSITIVE)
**File:** `packages/wrapper/src/cli.ts:20`, `packages/wrapper/src/commands/pack-install.ts:8`  
**Claim:** `sync/` directory does not exist, breaking `tsc` and `npm test`.  
**Status:** False positive — `packages/wrapper/src/sync/` exists with all required files.

---

## severity: nit

### bug_029 — TestGeminiProvider_BuildArgs_ModelSet asserts nothing meaningful
**File:** `internal/provider/gemini_test.go:108-120`  
**Issue:** Only assertion is `len(args) != 0`, which is always true. Comment claims `Model` is "used to construct the combined prompt" but `gemini.go` never reads `opts.Model`.  
**Resolution:** **FIXED** — Renamed to `TestGeminiProvider_BuildArgs_ModelNotPassed` and added real assertion: `--model` must not appear in args. Removed misleading comment.

### bug_014 — CI verification step can never fail
**File:** `.github/workflows/ci.yml:72-73`  
**Issue:** `test -f aco || test -f aco-linux-amd64 || ls cmd/aco/` — the `ls cmd/aco/` clause always exits 0 because checkout populates the source directory.  
**Resolution:** **FIXED** — Replaced `ls cmd/aco/` with `{ echo "go build produced no binary"; exit 1; }`.

### bug_013 — Dead for-loop in cmdSync warnings block
**File:** `packages/wrapper/src/cli.ts:391-397`  
**Issue:** `for (const out of outputs) {}` has only a comment in the body; `out` is never used. The loop is a no-op.  
**Resolution:** **FIXED** — Removed dead loop. Also removed unused `outputs` destructuring from `cmdSync`. Kept warning count + manifest path output.

---

## Action Items — Resolution Summary

| Bug | Severity | Status | Resolution |
|-----|----------|--------|------------|
| merged_bug_002 | normal | **FIXED** | `filterUnsupportedArgs` value leak + equals-form fixed; removed unused `providerName` param |
| bug_034 | normal | **WONTFIX** | Design explicitly forbids `--reasoning-effort` CLI flag for both providers |
| bug_013 | nit | **FIXED** | Removed dead loop + unused `outputs` destructuring in `cli.ts` |
| bug_014 | nit | **FIXED** | CI verification step now fails properly with `exit 1` |
| bug_029 | nit | **FIXED** | Test renamed + real assertion added (`--model` must not appear) |
| bug_019 | normal | **PENDING** | Pre-existing doc inconsistency, not introduced by this PR |
| merged_bug_001 | normal | **N/A** | False positive — `sync/` directory exists |
