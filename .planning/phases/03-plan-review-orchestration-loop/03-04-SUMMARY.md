---
phase: 03-plan-review-orchestration-loop
plan: 04
subsystem: orchestration
tags: [typescript, cao, workflow-cli, prompts, artifact-driven-completion, smoke-test]

requires:
  - phase: 03-01
    provides: strict workflow config resolution and review.status.json validation
  - phase: 03-02
    provides: exact artifact paths and prompt contract files
  - phase: 03-03
    provides: shared workflow runner and CAO HTTP client seam
provides:
  - Real CAO-backed approval runs for both named and ad-hoc workflow commands
  - Artifact-driven completion logic that waits for plan/review files instead of trusting transient terminal states
  - Stronger planner/reviewer prompts that write files directly before exploring
  - Extra regression coverage for initial-idle terminals and delayed artifact creation
affects: [milestone-complete, verify-work, workflow-smoke-tests, provider-runtime-behavior]

tech-stack:
  added: []
  patterns:
    - "Artifact-authoritative completion: workflow steps advance only after required files exist on disk"
    - "Direct-write prompt pattern: planner and reviewer prompts tell providers to write files first and avoid unrelated exploration"

key-files:
  created:
    - .planning/phases/03-plan-review-orchestration-loop/03-04-SUMMARY.md
  modified:
    - src/orchestration/cao-client.ts
    - src/orchestration/prompts.ts
    - src/orchestration/workflow-runner.ts
    - test/artifacts.test.ts
    - test/cao-client.test.ts
    - test/workflow-runner.test.ts

key-decisions:
  - "Stopped treating early CAO terminal state changes as authoritative completion; required on-disk artifacts instead"
  - "Strengthened planner/reviewer prompts to write files immediately because real providers spent too long exploring the repo"
  - "Raised the default live-run timeout budget to five minutes to match real provider behavior during smoke tests"

patterns-established:
  - "Real-provider hardening pattern: keep fake-client unit tests, then add regression coverage for the exact runtime race discovered in smoke tests"
  - "Smoke-test evidence pattern: validate named and ad-hoc runs through run.json, state.json, iteration.json, review.md, and review.status.json"

requirements-completed: [ORCH-01, ORCH-02, ORCH-03, ORCH-04]

duration: 28min
completed: 2026-03-25
---

# Phase 3 Plan 04: Workflow CLI Smoke-Test Hardening Summary

**Named and ad-hoc workflow commands now complete real CAO-backed approval runs because the wrapper waits for artifacts, uses stronger direct-write prompts, and tolerates slower provider execution**

## Performance

- **Duration:** 28 min
- **Started:** 2026-03-25T00:00:00Z
- **Completed:** 2026-03-25T00:28:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Verified the existing `workflow` and `workflow-run` CLI surface against full automated coverage plus real CAO-backed named and ad-hoc approval runs.
- Fixed a real runtime race where transient CAO terminal states let the runner fail before `plan.md` or reviewer artifacts existed.
- Tightened planner/reviewer prompts and timeout defaults so live providers write artifacts reliably within the workflow loop.

## Task Commits

No new commits were created in this verification-heavy completion pass. The 03-04 finish work remains in the working tree.

## Files Created/Modified

- `src/orchestration/cao-client.ts` - Guards against treating an initial `idle` terminal state as completed work and increases default live timeout budget.
- `src/orchestration/workflow-runner.ts` - Waits for required artifacts on disk before advancing planner/reviewer steps.
- `src/orchestration/prompts.ts` - Pushes providers to write the required files directly and avoid unrelated exploration.
- `test/cao-client.test.ts` - Covers the initial-idle completion race.
- `test/workflow-runner.test.ts` - Covers delayed planner artifact creation after an early idle status.
- `test/artifacts.test.ts` - Locks the stronger planner/reviewer prompt contract.

## Decisions Made

- Artifact existence, not transient terminal status, is the authoritative signal for planner/reviewer step completion in real runs.
- Real providers needed a stronger instruction contract than the original minimal prompts; explicit direct-write guidance is now part of the prompt surface.
- Five minutes is a safer default live-run timeout than two minutes for real provider smoke tests in this environment.

## Deviations from Plan

### Auto-fixed Issues

**1. Runtime hardening beyond the original CLI-surface scope**
- **Found during:** Task 3 (real CAO-backed smoke tests)
- **Issue:** Real planner sessions could report transient completion states before `plan.md` existed, causing false failures.
- **Fix:** Changed the runner to wait for required artifacts and added regression coverage for the race.
- **Files modified:** `src/orchestration/workflow-runner.ts`, `src/orchestration/cao-client.ts`, `test/cao-client.test.ts`, `test/workflow-runner.test.ts`
- **Verification:** `npm run build`, `npm run lint`, `node --test`, named CAO run approved, ad-hoc CAO run approved

**2. Prompt/timing hardening for live providers**
- **Found during:** Task 3 (real CAO-backed smoke tests)
- **Issue:** Planner and reviewer providers spent too long exploring before writing required files, and the previous timeout budget was too short.
- **Fix:** Strengthened direct-write prompt instructions and raised the default live timeout budget to five minutes.
- **Files modified:** `src/orchestration/prompts.ts`, `src/orchestration/cao-client.ts`, `src/orchestration/workflow-runner.ts`, `test/artifacts.test.ts`
- **Verification:** Re-ran named and ad-hoc CAO smoke tests successfully after the prompt/timeout update

---

**Total deviations:** 2 auto-fixed (2 runtime hardening)
**Impact on plan:** Both deviations were required to make the already-wired CLI surface pass real-provider smoke tests. No product-scope expansion.

## Issues Encountered

- The first live reviewer session surfaced a one-time in-pane skills enablement prompt; after acknowledging it, subsequent reviewer runs proceeded normally.

## User Setup Required

- A first-run provider session may surface a one-time skills enablement prompt inside the tmux pane. This was acknowledged during smoke testing and did not reappear on the second reviewer run.

## Next Phase Readiness

- Phase 03 now has full automated coverage plus successful named/ad-hoc CAO smoke tests.
- All roadmap phases are complete; the project is ready for milestone completion / archive flow.

---
*Phase: 03-plan-review-orchestration-loop*
*Completed: 2026-03-25*
