---
phase: 05-wrapper-runtime-contract
plan: 02
subsystem: config
tags: [refactoring, branding]
requires: [05-01]
provides: [AcoConfig]
affects: [src/config/aco-config.ts, src/cli.ts, src/orchestration/workflow-config.ts, test/config.test.ts]
tech-stack: [TypeScript, Node.js]
key-files: [src/config/aco-config.ts, src/cli.ts, test/config.test.ts]
decisions: [D-03, D-04]
metrics:
  duration: 15m
  tasks: 3
  completed_at: 2026-03-31T05:30:00Z
---

# Phase 05 Plan 02: Rename Config symbols and module Summary

## One-liner
Renamed internal `WrapperConfig` symbols and the config loader file to `AcoConfig` and `aco-config.ts` while maintaining the `.wrapper.json` on-disk contract.

## Accomplishments
- **Task 1: Rename Config symbols and file**: Renamed `src/config/wrapper-config.ts` to `src/config/aco-config.ts` and updated internal symbols (`WrapperConfig` -> `AcoConfig`, `readWrapperConfig` -> `readAcoConfig`).
- **Task 2: Update Config imports and usages across src/**: Updated all references in `src/` to use the new `aco-config.js` import path and renamed symbols.
- **Task 3: Update Config tests**: Refactored `test/config.test.ts`, `test/alias.test.ts`, and `test/workflow-config.test.ts` to use `readAcoConfig` and `aco-config.js`.

## Deviations from Plan
None - plan executed exactly as written.

## Key Decisions
- **[D-03] Branding Alignment**: Renamed internal configuration structures to use `Aco` prefix to align with the new canonical CLI name.
- **[D-04] Contract Preservation**: Maintained `.wrapper.json` as the on-disk configuration filename to ensure backward compatibility with existing repositories.

## Self-Check: PASSED
- [x] `src/config/aco-config.ts` exists and contains `AcoConfig` and `readAcoConfig`.
- [x] All imports in `src/` and `test/` use `aco-config.js`.
- [x] `npm run build` succeeds.
- [x] `npm test` passes all 15 tests (config, alias, and workflow-config).
