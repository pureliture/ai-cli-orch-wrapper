# Plan 09-02 Summary — Commands: --background flag + result + cancel

**Phase**: 09-result-cancel
**Plan**: 02
**Status**: Complete

## What Was Built

### Task 1: --background flag on review and adversarial commands (4 files)

Updated all four command files with the strip-then-dispatch pattern:
- `.claude/commands/gemini/review.md`
- `.claude/commands/copilot/review.md`
- `.claude/commands/gemini/adversarial.md`
- `.claude/commands/copilot/adversarial.md`

Pattern applied consistently:
1. Parse `--background` from `$ARGUMENTS` early (before `--focus`)
2. Strip the flag from remaining args (whitespace-trimmed)
3. If `BG_FLAG=true`: generate task ID with `aco_bg_task_id`, call `aco_bg_task_launch`, exit
4. If `BG_FLAG=false`: existing foreground path runs unchanged

### Task 2: result.md and cancel.md for gemini and copilot (4 new files)

Created four thin wrapper commands:
- `.claude/commands/gemini/result.md` — calls `aco_bg_task_result "$TASK_ID"`
- `.claude/commands/copilot/result.md` — calls `aco_bg_task_result "$TASK_ID"`
- `.claude/commands/gemini/cancel.md` — calls `aco_bg_task_cancel "$TASK_ID"`
- `.claude/commands/copilot/cancel.md` — calls `aco_bg_task_cancel "$TASK_ID"`

Each validates that a task ID was provided, then delegates to the adapter helper.

## Verification

```
bash .claude/aco/tests/test-review-commands.sh
Results: 44 passed, 0 failed
```

All Wave 0 stubs from Plan 09-01 turned GREEN.

## Commits

- `feat(09-02): add --background flag to review and adversarial commands (BG-01)`
- `feat(09-02): add result and cancel commands for gemini and copilot (BG-02, BG-03)`

## Requirements Satisfied

- **BG-01**: `--background` flag on all four review/adversarial commands ✓
- **BG-02**: `/gemini:result`, `/copilot:result` — retrieve completed task output ✓
- **BG-03**: `/gemini:cancel`, `/copilot:cancel` — cancel running tasks ✓
