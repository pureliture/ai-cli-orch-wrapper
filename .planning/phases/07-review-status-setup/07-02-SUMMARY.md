---
plan: 07-02
phase: 07-review-status-setup
status: complete
completed_at: "2026-04-02T01:48:00.000Z"
key-files:
  created:
    - .claude/commands/gemini/review.md
    - .claude/commands/copilot/review.md
---

# Plan 07-02 Summary: Review Commands

## What Was Built

Created `/gemini:review` and `/copilot:review` slash commands — the primary Phase 7 deliverables.

- **`gemini/review.md`** — Collects git diff or file content, delegates to Gemini CLI via `aco_adapter_invoke "gemini"`.
- **`copilot/review.md`** — Same logic, delegates to Copilot CLI via `aco_adapter_invoke "copilot"`.

Both commands implement:
- **REV-01**: No-arg mode dispatches `git diff HEAD` to respective CLI
- **REV-02**: File arg mode `cat`s the file; missing file → `Error: file not found: <path>` + exit 1
- **REV-03**: Fallback chain: HEAD diff → HEAD~1 diff → "No changes detected" + exit 0
- **D-05**: All CLI calls via adapter.sh (`aco_check_adapter` guard + `aco_adapter_invoke`)
- **D-03**: Output from adapter passes through verbatim (no extra wrapping)

## Deviations

None. All tasks executed as specified.

## Self-Check: PASSED

- `grep 'aco_check_adapter "gemini"' .claude/commands/gemini/review.md` → found
- `grep 'aco_check_adapter "copilot"' .claude/commands/copilot/review.md` → found
- `grep 'aco_adapter_invoke "gemini"' .claude/commands/gemini/review.md` → found
- `grep 'aco_adapter_invoke "copilot"' .claude/commands/copilot/review.md` → found
- "No changes detected" appears in both files
- `bash .claude/aco/tests/test-review-commands.sh` → Results: 11 passed, 0 failed
