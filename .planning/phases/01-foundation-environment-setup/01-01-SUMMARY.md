---
phase: 01-foundation-environment-setup
plan: 01
subsystem: cli
tags: [typescript, node, setup, tmux, spawnSync, child_process]

# Dependency graph
requires: []
provides:
  - "src/cli.ts: entry point dispatching setup/help/version only"
  - "src/commands/setup.ts: setupCommand() — idempotent prereq check, ai-cli.conf write, tmux.conf injection"
  - "test/setup.test.ts: unit tests covering SETUP-01 through SETUP-04 with temp-HOME fixture"
affects:
  - 01-02
  - 02-foundation-environment-setup

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "spawnSync('which', [tool]) for PATH existence checks — no shell builtin dependency"
    - "homedir() for all home-directory path resolution — no process.env.HOME direct access in production code"
    - "mkdirSync with recursive:true for idempotent directory creation"
    - "content.includes(target) guard before appendFileSync for idempotent file injection"
    - "temp-HOME fixture: mkdtempSync + process.env.HOME override per test"

key-files:
  created:
    - src/commands/setup.ts
    - test/setup.test.ts
  modified:
    - src/cli.ts

key-decisions:
  - "Deleted download PoC (download.ts, lockfile.ts, types.ts, index.ts) — unrelated to project goal"
  - "No src/index.ts barrel — project is CLI-only, no library consumers"
  - "spawnSync('which') over execSync('command -v') — avoids shell:true requirement"
  - "appendFileSync only for ~/.tmux.conf — never full rewrite; source-file check via content.includes()"

patterns-established:
  - "Command handler pattern: export async function <name>Command(): Promise<void>"
  - "Idempotency pattern: existsSync check before write, content.includes check before append"
  - "Test isolation pattern: mkdtempSync temp-HOME + process.env.HOME override restored in finally"

requirements-completed: [SETUP-01, SETUP-02, SETUP-03, SETUP-04]

# Metrics
duration: 2min
completed: 2026-03-24
---

# Phase 01 Plan 01: Foundation Environment Setup — Source Rewrite Summary

**`wrapper setup` command with idempotent prereq validation, ai-cli.conf creation, and tmux.conf source-line injection using spawnSync + homedir() + appendFileSync guard**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-24T06:30:23Z
- **Completed:** 2026-03-24T06:32:16Z
- **Tasks:** 3
- **Files modified:** 3 modified/created, 4 deleted

## Accomplishments

- Deleted all PoC files (download.ts, lockfile.ts, types.ts, index.ts) and rewrote src/cli.ts to dispatch setup/help/version only
- Created src/commands/setup.ts implementing full idempotent bootstrap: prereq check via spawnSync, ai-cli.conf write, tmux.conf source-line injection
- Created test/setup.test.ts with 5 tests covering SETUP-01–SETUP-04 using temp-HOME fixture (mkdtempSync + process.env.HOME override)

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete PoC files and rewrite src/cli.ts** - `53af6c7` (chore)
2. **Task 2: Create src/commands/setup.ts** - `af164ae` (feat)
3. **Task 3: Create test/setup.test.ts** - `a9071cf` (test)

## Files Created/Modified

- `src/cli.ts` - Rewrote to import setupCommand and dispatch setup/help/version only
- `src/commands/setup.ts` - New: setupCommand() with prereq check, ai-cli.conf write, tmux.conf injection
- `test/setup.test.ts` - New: 5 tests covering SETUP-01–SETUP-04 with temp-HOME fixture
- `src/commands/download.ts` - Deleted (PoC)
- `src/registry/lockfile.ts` - Deleted (PoC)
- `src/registry/types.ts` - Deleted (PoC)
- `src/index.ts` - Deleted (CLI-only project, no barrel needed)

## Decisions Made

- Used `spawnSync('which', [tool])` instead of `execSync('command -v ...')` — `command` is a shell builtin requiring `shell: true`, which adds unnecessary risk
- Used `homedir()` from `node:os` throughout — never `process.env.HOME` in production code (per research anti-patterns)
- Used `appendFileSync` with `content.includes(AI_CLI_CONF)` guard for tmux.conf — never rewrites the file, fully non-invasive
- Removed `src/index.ts` barrel — project is CLI-only, no external library consumers needed

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- src/commands/setup.ts is complete and type-correct (npm run lint passes)
- test/setup.test.ts is ready to run after `npm run build` (Plan 02)
- Plan 02 (build + verification) can proceed immediately: compile TypeScript, run tests, verify binary

## Self-Check: PASSED

- src/cli.ts: FOUND
- src/commands/setup.ts: FOUND
- test/setup.test.ts: FOUND
- 01-01-SUMMARY.md: FOUND
- Commit 53af6c7: FOUND
- Commit af164ae: FOUND
- Commit a9071cf: FOUND

---
*Phase: 01-foundation-environment-setup*
*Completed: 2026-03-24*
