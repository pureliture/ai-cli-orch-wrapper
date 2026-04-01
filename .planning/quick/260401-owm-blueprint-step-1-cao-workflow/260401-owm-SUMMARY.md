---
phase: quick
plan: 260401-owm
subsystem: cli
tags: [typescript, cao, workflow, strip, v2]

requires: []
provides:
  - Cao/workflow layer removed; build-clean, lint-clean baseline for v2 bridge architecture
affects: [v2-bridge, orchestration]

tech-stack:
  added: []
  patterns: [Thin CLI dispatcher: setup + alias dispatch + meta commands only]

key-files:
  created: []
  modified:
    - src/cli.ts
    - src/config/wrapper-config.ts
    - test/config.test.ts

key-decisions:
  - "Strip all cao-workflow infrastructure in one atomic commit to keep build green at baseline"
  - "WrapperConfig retains only aliases field; roles and workflows fields removed"
  - "config.test.ts updated to remove roles assertions matching stripped WrapperConfig interface"

requirements-completed: [OWM-STEP1]

duration: 10min
completed: 2026-04-01
---

# Quick Task 260401-owm: Blueprint Step 1 - cao Workflow Layer Removal Summary

**Deleted 14 cao/workflow source+test files and stripped cli.ts + wrapper-config.ts to produce a build-clean, lint-clean v2 baseline with only setup+alias+meta commands remaining**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-01
- **Completed:** 2026-04-01
- **Tasks:** 3 (merged into 1 atomic commit)
- **Files modified:** 3 modified, 14 deleted

## Accomplishments

- Deleted all 6 `src/orchestration/` files (cao-client, workflow-runner, status-file, workflow-config, artifacts, prompts)
- Deleted `src/commands/workflow.ts` and `src/commands/workflow-run.ts`
- Deleted 6 corresponding test files
- Rewrote `src/cli.ts`: removed `workflowCommand` and `workflowRunCommand` imports and dispatch branches
- Rewrote `src/config/wrapper-config.ts`: removed `WorkflowDefinitionInput` import, `workflows` and `roles` fields
- Updated `test/config.test.ts`: removed `roles` assertions to match stripped interface
- `npm run build`, `npm run lint` both pass with zero errors
- 9/10 tests pass; `setup.test.ts` fails due to `cao` not in PATH (pre-existing environment issue, unrelated to this task)

## Task Commits

1. **All tasks (1+2+3 combined)** - `ccf6b36` (feat(v2-cao-strip): remove cao workflow layer)

## Files Created/Modified

- `src/cli.ts` - Removed workflow imports and dispatch branches; retains setup, help, version, alias dispatch
- `src/config/wrapper-config.ts` - Removed `WorkflowDefinitionInput` import, `workflows` and `roles` fields; `WrapperConfig` now has only `aliases`
- `test/config.test.ts` - Updated assertions to match stripped `WrapperConfig` (removed `roles` checks)

## Decisions Made

- Kept `wrapper-config.ts` filename (not renamed to `aco-config.ts`) because actual codebase uses `wrapper-config.ts` and tests import `dist/config/wrapper-config.js`
- Updated `config.test.ts` alongside the interface change to keep the test suite green
- The `setup.test.ts` failure is a pre-existing environment issue (cao not installed) not introduced by this task

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan referenced aco-config.ts but actual file is wrapper-config.ts**
- **Found during:** Task 2
- **Issue:** Plan's file list said `src/config/aco-config.ts` but the actual codebase file is `src/config/wrapper-config.ts`
- **Fix:** Applied changes to `wrapper-config.ts` and kept the existing filename
- **Files modified:** src/config/wrapper-config.ts
- **Verification:** npm run lint passes, imports resolve correctly
- **Committed in:** ccf6b36

**2. [Rule 1 - Bug] Plan did not mention updating config.test.ts after removing roles field**
- **Found during:** Task 3 (test run)
- **Issue:** `config.test.ts` asserted `config.roles['orchestrator']` which would fail after removing `roles` from `WrapperConfig`
- **Fix:** Updated `config.test.ts` to remove the `roles` field assertions
- **Files modified:** test/config.test.ts
- **Verification:** npm test shows all config tests pass
- **Committed in:** ccf6b36

---

**Total deviations:** 2 auto-fixed (both Rule 1 - bug/mismatch between plan and actual codebase state)
**Impact on plan:** Both fixes were necessary for correctness. No scope creep.

## Issues Encountered

- `src/cli-surface.ts` mentioned in plan does not exist in the actual codebase (v1.1 has no such file). The help text trimming was done directly in `src/cli.ts` `printHelp()` function instead.

## Next Phase Readiness

- Clean baseline established for v2 bridge layer development
- `src/orchestration/` directory is fully removed
- `src/cli.ts` has minimal dispatch: setup, help, version, alias lookup
- `WrapperConfig` has only `aliases` field

---
*Phase: quick*
*Completed: 2026-04-01*
