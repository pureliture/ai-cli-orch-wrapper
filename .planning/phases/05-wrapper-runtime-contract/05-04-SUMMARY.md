---
phase: 05-wrapper-runtime-contract
plan: 04
subsystem: CLI Entry & Runtime
tags: [aco, branding, fallback, conflict-protection]
requires: [CMD-03, WRAP-01]
affects: [src/cli.ts, src/commands/setup.ts, src/orchestration/workflow-runner.ts, test/canonical-command-surface.test.ts]
tech-stack: [Node.js, TypeScript]
key-files: [src/cli.ts, src/commands/setup.ts, src/orchestration/workflow-runner.ts, test/canonical-command-surface.test.ts]
decisions:
  - Prefer 'ACO_CAO_BASE_URL' with fallback to 'WRAPPER_CAO_BASE_URL' for branding transition
  - Add '_comment' field to '.wrapper.json' for branding during setup
  - Protect built-in command names from alias overrides
metrics:
  duration: 25m
  completed_date: "2026-03-31"
---

# Phase 05 Plan 04: Wrapper Runtime Contract Alignment Summary

## One-liner
Implement alias conflict protection, branding alignment for 'aco' setup, and environment variable fallbacks for 'cao-server' connection.

## Key Changes

### 1. Alias Conflict Protection (CMD-03, Task 1)
- Implemented a check in `src/cli.ts` to ensure that user-defined aliases in `.wrapper.json` do not override built-in `aco` subcommands (`setup`, `help`, `version`, `workflow`, `workflow-run`, `alias`).
- CLI now prints a descriptive error and exits with code 1 if a conflict is detected.

### 2. Branding Alignment (Task 2)
- Updated `src/commands/setup.ts` to use `aco` branding in user-facing output and tmux config headers.
- Added a `_comment` field to the generated `.wrapper.json` file as a branded header.
- Cleaned up remaining legacy `WrapperConfig` and `readWrapperConfig` references in `src/cli-surface.ts`, `src/commands/alias.ts`, `src/commands/workflow.ts`, and `src/orchestration/workflow-config.ts`.

### 3. Environment Variable Fallbacks (Task 3)
- Updated `src/orchestration/workflow-runner.ts` to prefer `ACO_CAO_BASE_URL` with a fallback to `WRAPPER_CAO_BASE_URL`.
- Added a test case in `test/canonical-command-surface.test.ts` to verify the alias conflict protection.

## Deviations from Plan

- **Task 2 Header Implementation:** Instead of a `#` comment header for `.wrapper.json` (which is standard JSON), a `_comment` field was added to provide branding without breaking JSON parsing.
- **Wider Branding Cleanup:** Cleaned up several uncommitted `WrapperConfig` and `readWrapperConfig` renames that were found in the working tree, as they directly aligned with the goal of Task 2.

## Verification

### Automated Tests
- Ran `npm test test/canonical-command-surface.test.ts`.
- All tests passed, including the newly added `alias conflict with built-in command causes immediate exit 1` test case.

### Manual Verification
- `npm run build` executed successfully.

## Self-Check: PASSED
- [x] All tasks executed
- [x] Each task committed individually
- [x] SUMMARY.md created in plan directory
- [x] STATE.md updated with position and decisions
- [x] ROADMAP.md updated with plan progress (via `roadmap update-plan-progress`)
