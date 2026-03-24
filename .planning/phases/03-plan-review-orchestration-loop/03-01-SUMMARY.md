---
phase: 03-plan-review-orchestration-loop
plan: 01
subsystem: orchestration
tags: [typescript, workflow-config, review-status, wrapper-config, validation]

requires:
  - phase: 02-03
    provides: committed .wrapper.json plus role mapping conventions for orchestrator and reviewer
provides:
  - Minimal workflow resolution for named and ad-hoc workflow runs
  - Provider lookup through config.roles with one-run overrides
  - Strict review.status.json parser that only accepts schemaVersion 1
  - Phase 3 test coverage for workflow resolution and approval contract errors
affects: [03-02, 03-03, 03-04, workflow-runner, workflow-cli]

tech-stack:
  added: []
  patterns:
    - "Role-based workflow config: workflows reference logical roles and resolve providers through config.roles"
    - "Machine-readable approval contract: reviewer approval is trusted only from review.status.json"

key-files:
  created:
    - src/orchestration/workflow-config.ts
    - src/orchestration/status-file.ts
    - test/workflow-config.test.ts
    - test/status-file.test.ts
    - .planning/phases/03-plan-review-orchestration-loop/03-01-SUMMARY.md
  modified:
    - src/config/wrapper-config.ts

key-decisions:
  - "Kept .wrapper.json minimal by adding only an optional workflows section; no wrapper-owned workflow DSL was introduced"
  - "Workflow resolution validates role references at runtime and merges one-run overrides deterministically"
  - "Approval parsing stays fully separate from review prose and only trusts review.status.json"

patterns-established:
  - "Workflow resolution pattern: named workflows and ad-hoc overrides normalize into one resolved runtime shape"
  - "Strict file contract pattern: malformed or missing review.status.json throws actionable errors instead of silently defaulting"

requirements-completed: [ORCH-02, ORCH-04]

duration: 12min
completed: 2026-03-24
---

# Phase 3 Plan 01: Workflow Config and Review Status Summary

**Role-based workflow resolution with one-run overrides and strict `review.status.json` validation now defines the Phase 3 runtime contract**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-24T13:43:48Z
- **Completed:** 2026-03-24T13:55:51Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added Wave 0 tests that lock named workflow resolution, ad-hoc override handling, and strict approval-file validation.
- Extended `WrapperConfig` with an optional `workflows` section while preserving existing alias and role behavior from Phase 2.
- Implemented `resolveNamedWorkflow`, `resolveAdHocWorkflow`, and `readReviewStatusFile()` so later phases can depend on a stable runtime contract.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Wave 0 tests for workflow config resolution and review status parsing** - `28192d1` (test)
2. **Task 2: Implement minimal workflow config resolution and strict review status parsing** - `1776a3a` (feat)

**Plan metadata:** (docs commit — this summary)

## Files Created/Modified

- `test/workflow-config.test.ts` - Verifies named and ad-hoc workflow resolution plus override behavior.
- `test/status-file.test.ts` - Verifies `review.status.json` schema, status values, and failure modes.
- `src/config/wrapper-config.ts` - Adds optional `workflows` support without changing existing config fallback behavior.
- `src/orchestration/workflow-config.ts` - Resolves workflow definitions into a normalized runtime shape.
- `src/orchestration/status-file.ts` - Parses and validates the machine-readable reviewer status file.

## Decisions Made

- Kept the workflow surface minimal by extending `.wrapper.json` with only `workflows`, leaving prompt bodies and execution details in code.
- Derived providers exclusively through `config.roles` so named workflows stay role-based rather than provider-hardcoded.
- Rejected every malformed review status path explicitly, so the orchestration loop can fail clearly instead of guessing approval state.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Workflow resolution and approval parsing are ready for the artifact/prompt layer and the loop runner.
- Phase 3 can now build run directories and prompts on top of a stable workflow definition shape.

---
*Phase: 03-plan-review-orchestration-loop*
*Completed: 2026-03-24*
