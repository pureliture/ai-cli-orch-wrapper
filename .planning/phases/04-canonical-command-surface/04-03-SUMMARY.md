---
phase: 04-canonical-command-surface
plan: 03
subsystem: cli
tags: [node, npm, cli, install-state, relink]
requires:
  - phase: 04-02
    provides: stale wrapper runtime remediation and canonical aco-only public command behavior
provides:
  - ownership-aware cleanup for stale package-owned wrapper shims in the global npm bin directory
  - one explicit maintainer refresh path for already-linked machines
  - postinstall cleanup that preserves unrelated wrapper executables
affects: [phase-04-uat, install-surface, relink-workflow]
tech-stack:
  added: []
  patterns: [resolved-target ownership checks for global bin cleanup, explicit refresh script plus postinstall reuse]
key-files:
  created:
    - test/install-state-cleanup.test.ts
    - scripts/cleanup-legacy-bin.mjs
  modified:
    - package.json
    - README.md
key-decisions:
  - "Treat a legacy wrapper shim as package-owned only when its resolved target matches this package's dist/cli.js or the canonical aco shim target."
  - "Expose one explicit cleanup:legacy-bin refresh command and reuse the same script from postinstall without reintroducing wrapper in package metadata."
patterns-established:
  - "Machine-state cleanup must prove ownership from resolved executable targets before deleting a legacy shim."
  - "Canonical command cutovers can use an explicit maintainer refresh script plus postinstall reuse instead of compatibility aliases."
requirements-completed: [CMD-01, WRAP-03]
duration: 5min
completed: 2026-03-31
---

# Phase 04 Plan 03: Canonical Command Surface Summary

**Ownership-aware global-bin cleanup removes stale package-linked `wrapper` shims during refresh/reinstall while leaving `aco` as the only supported public command**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-31T08:38:32Z
- **Completed:** 2026-03-31T08:43:02Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added isolated regression coverage for stale global-bin cleanup, safe unrelated-wrapper skips, and no-op behavior when no legacy shim exists.
- Implemented a dependency-free cleanup script that removes only package-owned `wrapper` shims by comparing resolved targets against this package's canonical CLI path.
- Wired one explicit `npm run cleanup:legacy-bin` refresh path, reused it from `postinstall`, and documented the narrow relink flow for pre-`aco` machines.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add RED coverage and define the stale-bin cleanup script contract** - `74cc5c3` (test)
2. **Task 2: Implement safe install-state cleanup and wire the relink refresh path** - `2c0b29e` (feat)

## Files Created/Modified
- `test/install-state-cleanup.test.ts` - Adds isolated install-state cleanup regressions using temp package roots and prefix overrides.
- `scripts/cleanup-legacy-bin.mjs` - Resolves the effective package root/global prefix, proves shim ownership from resolved targets, and removes only stale package-owned `wrapper` executables.
- `package.json` - Adds the named refresh script and reuses the same cleanup during `postinstall`.
- `README.md` - Documents the one-command cleanup plus relink path for machines that still have a pre-`aco` global link state.

## Decisions Made
- Cleanup only deletes `wrapper` when ownership is provable from the resolved target, using either this package's `dist/cli.js` or the installed `aco` shim target.
- The public bin surface remains `aco`-only; install-state cleanup is handled through a postinstall/manual refresh path instead of reintroducing `wrapper` as metadata or a compatibility alias.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first RED test pass exposed a temp-path normalization mismatch on macOS (`/private` vs `/var`), so the assertions were corrected to compare realpaths before keeping the suite in the intended failing state.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 04 now closes the UAT gap: real-machine relink/install state no longer leaves a package-owned `wrapper` shim behind.
- Runtime stale-invocation remediation in `src/cli.ts` remains intact as a fallback if a legacy path survives outside package-owned cleanup scope.
- README and package scripts now give maintainers one narrow refresh path for older linked machines without reopening deferred `.wrapper*` runtime-contract renames.

## Self-Check: PASSED

- Verified summary and key implementation files exist on disk.
- Verified task commits `74cc5c3` and `2c0b29e` exist in git history.
