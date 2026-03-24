---
phase: 02-cli-aliases-workflow-config
plan: "02"
subsystem: config
tags: [typescript, config, alias, cao, spawnSync]

requires:
  - phase: 02-01
    provides: test files (test/config.test.ts, test/alias.test.ts) created as RED-phase TDD fixtures

provides:
  - WrapperConfig and AliasEntry TypeScript interfaces in src/config/wrapper-config.ts
  - readWrapperConfig() function with graceful fallback (empty aliases/roles on missing or malformed JSON)
  - aliasCommand() dispatcher that invokes spawnSync('cao', ['launch', '--provider', ..., '--agents', ...])

affects:
  - 02-03 (cli.ts wiring — imports aliasCommand and readWrapperConfig, fixes test 1 unknown-alias path)

tech-stack:
  added: []
  patterns:
    - "Graceful config fallback: readWrapperConfig returns DEFAULT_CONFIG on any read/parse error (mirrors readLockFile pattern)"
    - "Transparent subprocess passthrough: stdio inherit so cao output goes directly to user terminal"
    - "ENOENT guard before status check: result.error checked first, then result.status ?? 1 null-safety"

key-files:
  created:
    - src/config/wrapper-config.ts
    - src/commands/alias.ts
  modified: []

key-decisions:
  - "DEFAULT_CONFIG constant (not inline literal) used as fallback return — avoids object identity issues and is explicit"
  - "aliasName parameter included in aliasCommand even though only used in error message — required for user-friendly ENOENT output"
  - "result.error checked before result.status — correct order avoids null dereference when cao not on PATH"
  - "test 1 (unknown alias exits 1) remains RED in this plan — cli.ts wiring is Plan 03 work as designed"

patterns-established:
  - "Config reader pattern: try/catch around readFileSync + JSON.parse, return DEFAULT_CONFIG on any error"
  - "Subprocess dispatch pattern: spawnSync with stdio inherit, ENOENT guard first, null-safe exit code"

requirements-completed: [ALIAS-01, ALIAS-02, CONFIG-01, CONFIG-02, CONFIG-03]

duration: 3min
completed: "2026-03-24"
---

# Phase 02 Plan 02: Config Reader and Alias Dispatcher Summary

**WrapperConfig/AliasEntry typed interfaces and readWrapperConfig() graceful-fallback reader plus aliasCommand() cao-launch dispatcher — config.test.ts all 4 GREEN**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-24T07:57:11Z
- **Completed:** 2026-03-24T08:00:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `src/config/wrapper-config.ts` created with `WrapperConfig`, `AliasEntry` interfaces and `readWrapperConfig()` function that returns empty defaults on missing/malformed config files
- `src/commands/alias.ts` created with `aliasCommand()` that dispatches to `spawnSync('cao', ['launch', '--provider', entry.provider, '--agents', entry.agent, ...passthroughArgs])`
- All 4 `test/config.test.ts` assertions GREEN; alias tests 2-5 pass (test 1 deferred to Plan 03 as designed)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create src/config/wrapper-config.ts** - `2b438ba` (feat)
2. **Task 2: Create src/commands/alias.ts** - `d7f0ce2` (feat)

## Files Created/Modified

- `src/config/wrapper-config.ts` — WrapperConfig and AliasEntry interfaces, readWrapperConfig() with graceful fallback, CONFIG_FILE_NAME constant
- `src/commands/alias.ts` — aliasCommand() dispatcher using spawnSync('cao') with ENOENT guard and null-safe exit code

## Decisions Made

- DEFAULT_CONFIG constant used as the fallback return value (explicit, avoids inline object creation on every error path)
- aliasName parameter retained in aliasCommand signature for user-friendly ENOENT error messages even though it does not affect dispatch logic
- result.error checked before result.status to avoid null dereference when cao binary is not on PATH
- Test 1 of alias.test.ts ("unknown alias exits 1") intentionally deferred — cli.ts unknown-command path is Plan 03 work

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `src/config/wrapper-config.ts` and `src/commands/alias.ts` are fully implemented and compilable
- Plan 03 can now wire `aliasCommand` and `readWrapperConfig` into `cli.ts` to complete the dispatch loop
- Once Plan 03 wires cli.ts, test 1 of alias.test.ts (unknown-alias exit 1) will also go GREEN

---
*Phase: 02-cli-aliases-workflow-config*
*Completed: 2026-03-24*

## Self-Check: PASSED

- FOUND: src/config/wrapper-config.ts
- FOUND: src/commands/alias.ts
- FOUND: 02-02-SUMMARY.md
- FOUND: commit 2b438ba (feat(02-02): create WrapperConfig reader)
- FOUND: commit d7f0ce2 (feat(02-02): create aliasCommand dispatcher)
