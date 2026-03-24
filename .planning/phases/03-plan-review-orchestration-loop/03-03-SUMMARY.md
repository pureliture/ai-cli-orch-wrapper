---
phase: 03-plan-review-orchestration-loop
plan: 03
subsystem: orchestration
tags: [typescript, cao, workflow-runner, http, planner-reviewer-loop]

requires:
  - phase: 03-01
    provides: resolved workflow definitions and strict review.status.json parsing
  - phase: 03-02
    provides: repo-local artifact helpers and exact planner/reviewer prompt builders
provides:
  - Fetch-based CAO HTTP client for health, session, terminal, input, output, and exit endpoints
  - Shared workflow runner that executes planner-reviewer iterations with fresh sessions
  - Exit-code handling for approval, max-iteration exhaustion, and protocol failure
  - Integration tests for CAO query contracts and loop behavior
affects: [03-04, workflow-command, workflow-run-command, end-to-end-smoke-tests]

tech-stack:
  added: []
  patterns:
    - "Fresh-session loop pattern: every planner and reviewer step creates a new CAO session"
    - "Protocol-failure pattern: missing or malformed review.status.json converts the run into exit code 1 with preserved artifacts"

key-files:
  created:
    - src/orchestration/cao-client.ts
    - src/orchestration/workflow-runner.ts
    - test/cao-client.test.ts
    - test/workflow-runner.test.ts
    - .planning/phases/03-plan-review-orchestration-loop/03-03-SUMMARY.md
  modified: []

key-decisions:
  - "Wrapped CAO with a thin fetch client instead of shelling out, matching the confirmed HTTP API from research"
  - "Created run directories before execution so protocol failures still leave debuggable state artifacts on disk"
  - "Stored nextAction guidance in state.json for max-iteration exits so rerun guidance is visible without reading code"

patterns-established:
  - "CAO seam pattern: URL and query building is isolated in cao-client.ts and verified with a fake node:http server"
  - "Runner artifact pattern: every iteration writes prompt, status, and terminal metadata files before returning a final exit code"

requirements-completed: [ORCH-01, ORCH-02, ORCH-03]

duration: 7min
completed: 2026-03-24
---

# Phase 3 Plan 03: CAO Client and Workflow Runner Summary

**A CAO-backed planner-reviewer loop now runs through repo-local artifacts with distinct exit codes for approval, max iterations, and protocol failure**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-24T14:31:20Z
- **Completed:** 2026-03-24T14:38:17Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added integration tests that lock the exact CAO endpoint/query contract and the planner-reviewer loop behavior.
- Implemented `CaoHttpClient` with health checks, session creation, polling, output reads, and best-effort terminal cleanup.
- Implemented `runWorkflow()` to create repo-local artifacts, execute fresh planner/reviewer sessions, and return `0`, `1`, or `2` based on the loop result.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Wave 0 integration tests for the CAO seam and workflow loop** - `5cba1ee` (test)
2. **Task 2: Implement the CAO HTTP client and shared workflow runner** - `1ae56aa` (feat)

**Plan metadata:** (docs commit — this summary)

## Files Created/Modified

- `test/cao-client.test.ts` - Verifies CAO endpoint paths, query parameter names, polling, and startup failure messaging.
- `test/workflow-runner.test.ts` - Verifies approval, iterative revision, max-iteration exit, and protocol-failure behavior.
- `src/orchestration/cao-client.ts` - Implements the fetch-based CAO API seam.
- `src/orchestration/workflow-runner.ts` - Implements the shared planner-reviewer loop over repo-local artifacts.

## Decisions Made

- Kept the CAO integration as a thin HTTP client boundary so the wrapper owns orchestration logic while CAO keeps provider/session mechanics.
- Persisted workflow state even on failures, so missing artifacts or malformed status files still leave enough information for debugging and reruns.
- Added human-readable rerun guidance to `state.json` for max-iteration exits to make non-approved runs self-explanatory on disk.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The shared loop engine is ready to be exposed through `wrapper workflow` and `wrapper workflow-run`.
- Final Phase 3 work is now the CLI surface and end-to-end verification path.

---
*Phase: 03-plan-review-orchestration-loop*
*Completed: 2026-03-24*
