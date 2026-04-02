# Plan 09-01 Summary — Scaffolding: Background Task Helpers + Wave 0 Test Stubs

**Phase**: 09-result-cancel
**Plan**: 01
**Status**: Complete

## What Was Built

### Task 1: adapter.sh — Background Task Helpers

Appended six new functions to `.claude/aco/lib/adapter.sh`:

- `aco_bg_task_dir` — returns (and creates) the task state directory (`~/.gsd-tasks` or `$ACO_TASKS_DIR`)
- `aco_bg_task_id <adapter> <cmd>` — generates a unique ID matching `<adapter>-<cmd>-<ts>-<hex8>`
- `aco_bg_task_launch <task-id> <adapter> <prompt> [stdin_content]` — spawns adapter in background, writes `.pid`/`.status`/`.output` files
- `aco_bg_task_status <task-id>` — returns `running|complete|cancelled|error|not_found` with live PID validation
- `aco_bg_task_result <task-id>` — prints output or status message based on current task state
- `aco_bg_task_cancel <task-id>` — kills running process, marks status as `cancelled`

### Task 2: test-review-commands.sh — Phase 9 Tests

Added 14 behavioral tests (all PASS) + 4 Wave 0 stubs (intentionally RED until Plan 09-02):
- BG-01: task dir creation, ID format, ID uniqueness
- BG-02: status transitions (not_found, complete, cancelled), result messages
- BG-03: cancel on running task, cancel on non-running task, running+live PID status
- Wave 0 stubs: checks for result.md and cancel.md existence (turn GREEN in Plan 09-02)

## Verification

```
bash .claude/aco/lib/adapter.sh  # syntax OK
Results: 40 passed, 4 failed  # exactly 4 Wave 0 stubs RED
```

## Commits

- `feat(09-01): add background task helpers to adapter.sh (BG-01, BG-02, BG-03)`
- `test(09-01): add Phase 9 behavioral tests + Wave 0 RED stubs (BG-01, BG-02, BG-03)`
