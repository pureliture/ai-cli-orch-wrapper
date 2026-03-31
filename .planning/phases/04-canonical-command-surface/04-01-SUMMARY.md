---
phase: 04-canonical-command-surface
plan: 01
subsystem: cli
tags: [node, typescript, cli, npm-bin, command-surface]
requires:
  - phase: 03-plan-review-orchestration-loop
    provides: built-ins-first command dispatch and .wrapper workflow contract
provides:
  - public npm bin cut over to aco
  - centralized help/version/unknown-command formatting in src/cli-surface.ts
  - regression coverage for package bin, help, version, unknown command, and README quick-start guidance
affects: [phase-04-plan-02, install-surface, stale-invocation-remediation]
tech-stack:
  added: []
  patterns: [centralized cli-surface metadata helper, package-version runtime lookup]
key-files:
  created:
    - src/cli-surface.ts
    - test/canonical-command-surface.test.ts
  modified:
    - src/cli.ts
    - package.json
    - README.md
    - test/workflow-cli.test.ts
key-decisions:
  - "Centralized public command strings in src/cli-surface.ts so help, version, and unknown-command output cannot drift independently."
  - "Kept .wrapper.json and .wrapper/workflows references intact because the runtime contract rename is explicitly deferred to Phase 05."
patterns-established:
  - "Public CLI naming lives in cli-surface.ts and should be consumed by handlers instead of inline literals."
  - "Command-surface regressions should use subprocess tests that assert canonical help/version/error wording without touching deferred runtime-path contracts."
requirements-completed: [CMD-01, CMD-02]
duration: 5min
completed: 2026-03-31
---

# Phase 04 Plan 01: Canonical Command Surface Summary

**Selective `aco` command-surface cutover with centralized CLI metadata, repo-sourced version output, and regression tests that preserve the existing `.wrapper*` runtime contract**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-31T02:17:05Z
- **Completed:** 2026-03-31T02:21:42Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added dedicated Phase 04 regressions for the `aco` package bin, help output, version output, unknown-command remediation, and README public examples.
- Centralized public command formatting in `src/cli-surface.ts` and switched `src/cli.ts` to use it for help, version, and unknown-command output.
- Flipped the public npm bin to `aco` and updated the README’s quick-start/current-command examples without renaming `.wrapper.json` or `.wrapper/workflows`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create regression coverage for the canonical `aco` surface** - `f23e656` (test)
2. **Task 2: Centralize the public command surface and cut over install/help/version to `aco`** - `3b2dc1c` (feat)

## Files Created/Modified
- `src/cli-surface.ts` - Canonical command constants plus help/version/recovery formatting helpers.
- `src/cli.ts` - Built-ins-first dispatcher now delegates user-facing help/version/error text to `cli-surface`.
- `package.json` - Public `bin` contract changed from `wrapper` to `aco`.
- `README.md` - Public quick-start and current CLI examples now use `aco`.
- `test/canonical-command-surface.test.ts` - New subprocess and file-content regressions for the canonical command surface.
- `test/workflow-cli.test.ts` - Built-ins-first coverage updated to the new help/version branding.

## Decisions Made
- Centralized public command-surface strings in `src/cli-surface.ts` so later plans can reuse the same source of truth instead of scattering literals.
- Read the displayed version directly from the repo `package.json` at runtime to eliminate the existing package-version drift in CLI output.
- Kept `.wrapper.json` and `.wrapper/workflows` wording where those refer to the real runtime contract rather than the public executable name.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The public install/help/version/error surface is now locked to `aco` with passing regressions.
- Phase `04-02` can focus on stale `wrapper` entrypath remediation and setup-managed wording without reopening the package bin/help/version cutover.
- Manual `npm link` / global-bin refresh on this machine was not run during this plan and remains a follow-up verification step outside the repository test suite.

## Self-Check: PASSED

- Verified summary file exists on disk.
- Verified task commits `f23e656` and `3b2dc1c` exist in git history.
