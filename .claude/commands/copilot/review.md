---
name: copilot:review
description: Delegate code review to GitHub Copilot CLI (git diff HEAD or specific file). Use --background to run as a background task.
argument-hint: "[--background] [path/to/file.ts]"
allowed-tools:
  - Bash
---

Delegate code review to GitHub Copilot CLI. Without an argument, reviews the current `git diff HEAD`. With a file path argument, reviews that file's content. Use `--background` to launch as a background task and get a task ID immediately; retrieve output later with `/copilot:result <task-id>`. Output from Copilot is returned verbatim.

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# D-05: Source shared adapter library (all CLI calls go through adapter.sh)
source "${SCRIPT_DIR}/../../aco/lib/adapter.sh"

# D-05: Check adapter availability — aco_check_adapter prints named error + install hint on failure
aco_check_adapter "copilot" || exit 1

# D-02: Load reviewer role prompt
REVIEWER_PROMPT_FILE="${SCRIPT_DIR}/../../aco/prompts/copilot/reviewer.md"
if [[ ! -f "$REVIEWER_PROMPT_FILE" ]]; then
  echo "Error: reviewer prompt not found at ${REVIEWER_PROMPT_FILE}" >&2
  exit 1
fi
REVIEWER_PROMPT=$(cat "$REVIEWER_PROMPT_FILE")

# BG-01: Parse --background flag from ARGUMENTS; strip it so remaining args are unaffected
ARGS="${ARGUMENTS:-}"
BG_FLAG=false
if [[ "$ARGS" == *"--background"* ]]; then
  BG_FLAG=true
  ARGS="${ARGS/--background/}"
  ARGS="${ARGS#"${ARGS%%[! ]*}"}"  # trim leading whitespace
  ARGS="${ARGS%"${ARGS##*[! ]}"}"  # trim trailing whitespace
fi

# REV-02: File path argument takes priority over git diff
FILE_ARG="$ARGS"
if [[ -n "$FILE_ARG" ]]; then
  if [[ ! -f "$FILE_ARG" ]]; then
    echo "Error: file not found: $FILE_ARG" >&2
    exit 1
  fi
  CONTENT=$(cat "$FILE_ARG")
else
  # REV-01 + REV-03: git diff fallback chain
  CONTENT=$(git diff HEAD 2>/dev/null || true)
  if [[ -z "$CONTENT" ]]; then
    # REV-03: retry with HEAD~1
    CONTENT=$(git diff HEAD~1 2>/dev/null || true)
  fi
  if [[ -z "$CONTENT" ]]; then
    # REV-03: both diffs empty
    echo "No changes detected"
    exit 0
  fi
fi

# BG-01: Background vs foreground dispatch
if [[ "$BG_FLAG" == true ]]; then
  TASK_ID=$(aco_bg_task_id "copilot" "review")
  aco_bg_task_launch "$TASK_ID" "copilot" "$REVIEWER_PROMPT" "$CONTENT"
else
  # D-03: Pass adapter output verbatim — no extra wrapping
  # Note: aco_adapter_invoke "copilot" embeds CONTENT in the -p prompt string (no stdin piping)
  aco_adapter_invoke "copilot" "$REVIEWER_PROMPT" "$CONTENT"
fi
```
