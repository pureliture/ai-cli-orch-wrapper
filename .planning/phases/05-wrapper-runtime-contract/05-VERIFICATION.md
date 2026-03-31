# Phase 05 Verification: Wrapper Runtime Contract

## Goal Achievement
- [x] Rename internal configuration symbols to `AcoConfig` while maintaining `.wrapper.json` disk contract.
- [x] Rename internal artifact symbols to `Aco` prefix while maintaining `.wrapper/` disk contract.
- [x] Preserve built-ins-first dispatch even when `.wrapper.json` defines reserved alias names.
- [x] Align `aco setup` output and file headers with new branding.
- [x] Implement environment variable fallbacks for `ACO_CAO_BASE_URL` (prefer) and `WRAPPER_CAO_BASE_URL` (fallback).

## Must-Haves Verification
- **CMD-03**: `aco` CLI keeps built-in commands ahead of aliases, even when `.wrapper.json` defines reserved names.
  - *Verified via tests: `built-in command "setup" is not shadowed by alias in config`, `workflow missing-workflow still dispatches to the built-in command when workflow is shadowed by an alias`, `workflow-run still dispatches to the built-in command when workflow-run is shadowed by an alias`, and `reserved alias names do not block built-in help output`.*
- **WRAP-01**: `aco setup` still initializes repo-local config through `.wrapper.json` without requiring a rename.
  - *Verified via `test/setup.test.ts` and manual smoke runs that created or preserved `.wrapper.json`.*
- **WRAP-02**: Alias and workflow entrypoints still write artifacts under the `.wrapper/` contract.
  - *Verified via `test/artifacts.test.ts`, `test/workflow-runner.test.ts`, and `workflow named command passes overrides through to the command layer`.*
- **D-01/02/03/04/05/06**: Decisions implemented.
  - *Verified via manual code review of src/config/aco-config.ts, src/orchestration/artifacts.ts, src/cli.ts, src/orchestration/workflow-runner.ts*

## Automated Checks
- `npm run build`: PASSED
- `node --test test/canonical-command-surface.test.ts test/workflow-cli.test.ts test/setup.test.ts test/config.test.ts test/artifacts.test.ts test/workflow-runner.test.ts test/alias.test.ts test/workflow-config.test.ts`: PASSED (45 tests)

## Human Verification Required
None. All runtime contract changes are internal-facing and verified via automated test suite.

## Status: passed
