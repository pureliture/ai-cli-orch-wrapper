---
phase: 03-plan-review-orchestration-loop
plan: 02
subsystem: orchestration
tags: [typescript, artifacts, prompts, workflow-files, review-status]

requires: []
provides:
  - Repo-local workflow artifact root under .wrapper/workflows
  - Deterministic run and iteration path helpers for planner/reviewer handoff files
  - JSON snapshot/state writers for persisted run metadata
  - Planner and reviewer prompt builders tied to exact file paths
affects: [03-03, 03-04, workflow-runner, workflow-cli]

tech-stack:
  added: []
  patterns:
    - "Repo-local artifact pattern: every workflow run stays under <repo>/.wrapper/workflows/<workflow>/runs/<run-id>"
    - "Deterministic iteration pattern: iterations use zero-padded directories with dedicated planner/reviewer prompt and output files"

key-files:
  created:
    - src/orchestration/artifacts.ts
    - src/orchestration/prompts.ts
    - test/artifacts.test.ts
    - .planning/phases/03-plan-review-orchestration-loop/03-02-SUMMARY.md
  modified: []

key-decisions:
  - "Anchored all workflow artifacts to the provided repo root instead of any global or home-directory path"
  - "Preserved prior iteration outputs by creating isolated zero-padded iteration directories rather than reusing files"
  - "Embedded exact file-path instructions and status schema examples directly in prompt builders to keep config minimal"

patterns-established:
  - "Artifact helper pattern: create directories eagerly, then return exact paths for runner and human inspection"
  - "Prompt contract pattern: prompts must mention exact plan/review/status file paths and only valid status values"

requirements-completed: [ORCH-03]

duration: 4min
completed: 2026-03-24
---

# Phase 3 Plan 02: Artifact and Prompt Contract Summary

**Repo-local workflow run helpers and exact planner/reviewer file prompts now make the orchestration handoff deterministic and auditable**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-24T13:59:40Z
- **Completed:** 2026-03-24T14:03:36Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added Wave 0 tests that lock the `.wrapper/workflows` directory contract and the exact iteration filenames used by the loop.
- Implemented artifact helpers that create deterministic run and iteration directories without overwriting previous iterations.
- Implemented planner and reviewer prompt builders that encode exact file handoff paths, including `review.status.json` and the only valid statuses.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Wave 0 tests for repo-local artifact layout** - `659b01c` (test)
2. **Task 2: Implement artifact helpers and prompt builders for file-based handoff** - `29bacf0` (feat)

**Plan metadata:** (docs commit — this summary)

## Files Created/Modified

- `test/artifacts.test.ts` - Verifies repo-local run paths, iteration filenames, JSON writers, and prompt contracts.
- `src/orchestration/artifacts.ts` - Creates deterministic run and iteration artifact paths under `.wrapper/workflows`.
- `src/orchestration/prompts.ts` - Builds planner and reviewer prompts that point at exact artifact files.

## Decisions Made

- Normalized all workflow run paths to absolute paths inside the provided repo root so the loop never escapes into a global directory.
- Used zero-padded iteration directory names (`01`, `02`, ...) to make on-disk history easy to inspect and predictable for later runner code.
- Kept reviewer approval schema examples in code-generated prompts instead of `.wrapper.json`, preserving the minimal config contract from planning.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first planner prompt wording missed the test's expected phrase casing. Adjusted the prompt sentence and re-ran the targeted tests.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 3 runner work can now create plan/review/status files for each iteration using stable path helpers.
- CAO client and workflow loop implementation can consume the prompt builders directly in Wave 2.

---
*Phase: 03-plan-review-orchestration-loop*
*Completed: 2026-03-24*
