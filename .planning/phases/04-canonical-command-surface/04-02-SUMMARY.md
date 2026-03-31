---
phase: 04-canonical-command-surface
plan: 02
subsystem: cli
tags: [node, typescript, cli, remediation, setup]
requires:
  - phase: 04-01
    provides: centralized cli-surface helpers and canonical aco help/version/unknown-command formatting
provides:
  - stale wrapper entrypoints fail fast with one-step aco remediation
  - bare invocation exits cleanly with aco help guidance
  - setup-managed tmux comments use aco while preserving .wrapper.json
affects: [phase-05-runtime-contract, stale-invocation-recovery, setup-surface]
tech-stack:
  added: []
  patterns: [basename-based legacy entrypoint detection, one-step command remediation]
key-files:
  created: []
  modified:
    - test/canonical-command-surface.test.ts
    - test/setup.test.ts
    - src/cli.ts
    - src/commands/setup.ts
key-decisions:
  - "Rejected wrapper as a compatibility alias and instead fail fast only when the invoked executable basename is wrapper."
  - "Kept remediation text to one direct next step by reusing cli-surface helpers for help vs setup guidance."
patterns-established:
  - "Legacy command remediation should branch on process.argv[1] basename before normal dispatch."
  - "Setup wording can switch to the canonical command without renaming deferred .wrapper* runtime paths."
requirements-completed: [WRAP-03, CMD-02]
duration: 5min
completed: 2026-03-31
---

# Phase 04 Plan 02: Canonical Command Surface Summary

**Stale `wrapper` entrypoints now fail fast to `aco`, bare invocation recovers cleanly, and setup-managed tmux comments use `aco` while the `.wrapper*` runtime contract stays intact**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-31T02:23:00Z
- **Completed:** 2026-03-31T02:27:46Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added RED-first regressions for stale `wrapper` invocation, zero-arg recovery, canonical unknown-command output, and `aco`-branded setup comments.
- Classified legacy `wrapper` entrypaths in `src/cli.ts` before normal dispatch so the CLI now fails fast with exactly one `aco` recovery step.
- Updated setup-managed tmux comments to say `aco setup` while keeping `.wrapper.json` and the rest of the deferred runtime contract unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend regression coverage for stale `wrapper` recovery and setup wording** - `fd211e1` (test)
2. **Task 2: Implement stale-invocation remediation and keep `.wrapper*` runtime paths intact** - `547b7b2` (feat)

## Files Created/Modified
- `test/canonical-command-surface.test.ts` - Added symlink-based stale `wrapper` entrypoint coverage plus zero-arg recovery assertions.
- `test/setup.test.ts` - Locked setup-managed comments to `aco` while preserving the `.wrapper.json` reference.
- `src/cli.ts` - Added basename-based legacy entrypoint detection and an explicit no-subcommand remediation branch.
- `src/commands/setup.ts` - Switched the managed tmux comment text from `wrapper setup` to `aco setup`.

## Decisions Made
- Used `path.basename(process.argv[1] ?? '')` as the narrow stale-invocation detector so raw `node dist/cli.js <command>` remains usable for development/tests while `wrapper` fails fast.
- Reused the Phase 04-01 `cli-surface` helpers for recovery messaging instead of duplicating `aco help` / `aco setup` strings in `src/cli.ts`.
- Left `.wrapper.json`, `.wrapper/`, `wrapper.lock`, and `WRAPPER_CAO_BASE_URL` untouched because those runtime-contract renames are explicitly deferred to Phase 05.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 04 is complete: install/help/version/error/stale-remediation now present a single canonical `aco` command surface.
- Phase 05 can focus on the deferred `.wrapper*` runtime contract and built-ins-over-alias behavior without reopening public command naming.
- Machine-level verification after `npm link` confirmed `aco help` succeeds and any lingering `wrapper help` path now returns `Use aco help.`

## Self-Check: PASSED

- Verified summary file exists on disk.
- Verified task commits `fd211e1` and `547b7b2` exist in git history.
