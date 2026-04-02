---
name: gemini:rescue
description: Get unstuck with a second-opinion from Gemini CLI. Accepts --from <file>, --error <message>, stdin, or positional description.
argument-hint: "[--from path/to/file] [--error 'error message'] [problem description]"
allowed-tools:
  - Bash
---

Get a fresh perspective from Gemini CLI when you're stuck. Accepts a problem description via `--from <file>`, `--error <message>`, piped stdin, or positional text. Automatically injects recent git history as context.

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Source shared adapter library
source "${SCRIPT_DIR}/../../aco/lib/adapter.sh"

# Check adapter availability
aco_check_adapter "gemini" || exit 1

# RESC-01: Load rescue prompt
RESCUE_PROMPT_FILE="${SCRIPT_DIR}/../../aco/prompts/gemini/rescue.md"
if [[ ! -f "$RESCUE_PROMPT_FILE" ]]; then
  echo "Error: rescue prompt not found at ${RESCUE_PROMPT_FILE}" >&2
  echo "Run Plan 08-01 to create it." >&2
  exit 1
fi
RESCUE_PROMPT=$(cat "$RESCUE_PROMPT_FILE")

# RESC-01: Parse --from <file> flag
# Captures path token (first non-space token after --from)
FROM_FILE=""
if [[ "${ARGUMENTS:-}" =~ --from[[:space:]]+([^[:space:]]+) ]]; then
  FROM_FILE="${BASH_REMATCH[1]}"
fi

# RESC-01: Parse --error <message> flag
# Captures everything after --error to end-of-string, then strips any trailing --from segment
# (handles: --error "msg" --from file.txt  as well as  --from file.txt --error "msg")
ERROR_MSG=""
if [[ "${ARGUMENTS:-}" =~ --error[[:space:]]+(.+)$ ]]; then
  RAW_ERROR="${BASH_REMATCH[1]}"
  ERROR_MSG="${RAW_ERROR%%--from*}"
  ERROR_MSG="${ERROR_MSG%% }"
fi

# RESC-01: Stdin detection — true when stdin is a pipe or redirected file
STDIN_CONTENT=""
if [ ! -t 0 ]; then
  STDIN_CONTENT=$(cat)
fi

# RESC-03 + RESC-01: Build problem content
# Priority: (--from + --error merged) > --from only > --error only > stdin > positional
PROBLEM_CONTENT=""
if [[ -n "$FROM_FILE" ]] && [[ -n "$ERROR_MSG" ]]; then
  # RESC-03: Both provided — merge with labeled sections
  if [[ ! -f "$FROM_FILE" ]]; then
    echo "Error: --from file not found: $FROM_FILE" >&2
    exit 1
  fi
  FILE_CONTENT=$(cat "$FROM_FILE")
  PROBLEM_CONTENT="Error message: ${ERROR_MSG}"$'\n\n'"File content (${FROM_FILE}):"$'\n'"${FILE_CONTENT}"
elif [[ -n "$FROM_FILE" ]]; then
  if [[ ! -f "$FROM_FILE" ]]; then
    echo "Error: --from file not found: $FROM_FILE" >&2
    exit 1
  fi
  PROBLEM_CONTENT=$(cat "$FROM_FILE")
elif [[ -n "$ERROR_MSG" ]]; then
  PROBLEM_CONTENT="$ERROR_MSG"
elif [[ -n "$STDIN_CONTENT" ]]; then
  PROBLEM_CONTENT="$STDIN_CONTENT"
else
  PROBLEM_CONTENT="${ARGUMENTS:-}"
fi

if [[ -z "$PROBLEM_CONTENT" ]]; then
  echo "Error: no problem description provided." >&2
  echo "Use: --from <file>, --error <message>, pipe via stdin, or pass a positional description." >&2
  exit 1
fi

# RESC-02: Auto-inject git log -5 --oneline context
GIT_LOG=$(git log -5 --oneline 2>/dev/null || echo "(no git history available)")

FULL_CONTEXT="Recent git history:"$'\n'"${GIT_LOG}"$'\n\n'"Problem:"$'\n'"${PROBLEM_CONTENT}"

# Dispatch through adapter (output verbatim)
aco_adapter_invoke "gemini" "$RESCUE_PROMPT" "$FULL_CONTEXT"
```
