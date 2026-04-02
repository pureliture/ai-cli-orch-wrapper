---
phase: 06-adapter-infrastructure
plan: 02
subsystem: infra
tags: [bash, adapter, gemini-cli, copilot-cli, command-v]

requires:
  - phase: 06-01
    provides: ".claude/aco/lib/ directory and RED test stubs"
provides:
  - "adapter.sh with aco_adapter_available, aco_adapter_version, aco_check_adapter, aco_adapter_invoke"
  - "Gemini CLI invocation via --yolo flag"
  - "Copilot CLI invocation via --allow-all-tools --silent flags"
affects: [06-03, 07, 08]

tech-stack:
  added: []
  patterns: [bash-adapter-library, command-v-resolution, guard-before-invoke]

key-files:
  created:
    - .claude/aco/lib/adapter.sh
  modified: []

key-decisions:
  - "Use command -v exclusively (never 'which') for POSIX-portable binary resolution"
  - "Copilot content embedded in -p arg (no stdin piping) per research findings"
  - "Guard pattern: aco_adapter_invoke calls aco_check_adapter before spawning"

patterns-established:
  - "Adapter key mapping: _aco_binary_for_key maps logical keys to binary names"
  - "Install hints: _aco_install_hint provides per-adapter npm install commands on stderr"
  - "Version check is non-fatal: always exits 0, prints 'unavailable' if missing"

requirements-completed: [ADPT-01, ADPT-02, ADPT-03]

duration: 4min
completed: 2026-04-02
---

# Plan 06-02: adapter.sh Core Functions Summary

**Shared bash adapter library with availability checks, version queries, error messages, and CLI invocation for Gemini and Copilot**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-02T00:09:00Z
- **Completed:** 2026-04-02T00:13:00Z
- **Tasks:** 2 (combined into single file creation)
- **Files modified:** 1

## Accomplishments
- Four public functions: aco_adapter_available, aco_adapter_version, aco_check_adapter, aco_adapter_invoke
- Two internal helpers: _aco_binary_for_key, _aco_install_hint
- smoke-adapters.sh exits GREEN (gemini + copilot both available and version returned)
- test-error-handling.sh exits GREEN (nonexistent adapter gives clear named error with "not installed")
- No hardcoded binary paths; all resolution via command -v

## Task Commits

1. **Task 1+2: Implement adapter.sh** - `20da8ab` (feat)

## Files Created/Modified
- `.claude/aco/lib/adapter.sh` - 139-line bash library with 4 public + 2 internal functions

## Decisions Made
- Combined Task 1 and Task 2 into a single file creation since both functions are part of the same file
- Used $(command -v gemini) and $(command -v copilot) for all binary resolution

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- adapter.sh ready for _read_routing_adapter addition in Plan 06-03
- test-routing.sh still RED (expected — routing function comes next)
- Phases 7-8 can source adapter.sh immediately after Plan 06-03

---
*Phase: 06-adapter-infrastructure*
*Completed: 2026-04-02*
