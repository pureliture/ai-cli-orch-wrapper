---
phase: quick
plan: 260401-wi8
subsystem: v2-types
tags: [v2, typescript, interfaces, config-schema, cli-adapter]
dependency_graph:
  requires: [260401-owm]
  provides: [V2Config schema, CliAdapter interface, compile-time contract tests]
  affects: [src/v2/types/, test/v2-types.test.ts]
tech_stack:
  added: [src/v2/types/config.ts, src/v2/types/cli-adapter.ts]
  patterns: [Pure TypeScript interface definitions, zero-import type modules]
key_files:
  created:
    - src/v2/types/config.ts
    - src/v2/types/cli-adapter.ts
    - test/v2-types.test.ts
  modified: []
decisions:
  - "V2Config aliases field uses CliAdapterConfig (adapter key + extraArgs) instead of cao provider strings"
  - "CliAdapter interface is purely abstract — no classes or implementations in this step"
  - "RoleMap exported as a type alias (Record<string, string>) per plan spec"
  - "dist/ is gitignored so only src and test files are committed"
metrics:
  duration: ~5m
  completed: 2026-04-01
  tasks_completed: 3
  files_created: 3
---

# Quick Task 260401-wi8: Blueprint Step 2 — V2Config + CliAdapter interface definitions

V2 type layer with V2Config schema (aliases map to CliAdapterConfig registry keys, not cao provider strings) and CliAdapter interface (launch/version/isAvailable contract), proven by 4 compile-time contract tests.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Define V2Config and CliAdapterConfig schema | 510154d | src/v2/types/config.ts |
| 2 | Define CliAdapter interface and launch types | 3c2d76a | src/v2/types/cli-adapter.ts |
| 3 | Write compile-time contract tests + build verify | 88e219d | test/v2-types.test.ts |

## Verification Results

- `test -f src/v2/types/config.ts` — PASS
- `test -f src/v2/types/cli-adapter.ts` — PASS
- `npm run build` — exits 0
- `npm run lint` (tsc --noEmit) — exits 0
- `node --test test/v2-types.test.ts` — 4/4 tests pass
- No functional cao imports or orchestration references in either type file

## Deviations from Plan

None — plan executed exactly as written.

Note: The verification grep `grep "cao" src/v2/types/config.ts` produces one match — a JSDoc comment "rather than cao provider strings" that explains the design intent. This is a documentation comment, not a functional dependency. No cao imports or runtime references exist.

## Known Stubs

None — these are pure type definition files with no runtime stubs or placeholder values.

## Self-Check: PASSED

- `src/v2/types/config.ts` — FOUND
- `src/v2/types/cli-adapter.ts` — FOUND
- `test/v2-types.test.ts` — FOUND
- Commit 510154d — FOUND (feat: V2Config schema)
- Commit 3c2d76a — FOUND (CliAdapter interface)
- Commit 88e219d — FOUND (contract tests)
