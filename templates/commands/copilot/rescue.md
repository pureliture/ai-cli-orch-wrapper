---
name: copilot:rescue
description: Get unstuck with a second-opinion from GitHub Copilot CLI. Accepts --from <file>, --error <message>, stdin, or positional description.
argument-hint: "[--from path/to/file] [--error 'error message'] [problem description]"
allowed-tools:
  - Bash
---

Get a fresh perspective from GitHub Copilot CLI when you're stuck. Accepts a problem description via `--from <file>`, `--error <message>`, piped stdin, or positional text. Automatically injects recent git history as context.

```bash
#!/usr/bin/env bash
set -euo pipefail

FROM_FILE=""
if [[ "${ARGUMENTS:-}" =~ --from[[:space:]]+([^[:space:]]+) ]]; then FROM_FILE="${BASH_REMATCH[1]}"; fi

ERROR_MSG=""
if [[ "${ARGUMENTS:-}" =~ --error[[:space:]]+(.+)$ ]]; then
  RAW_ERROR="${BASH_REMATCH[1]}"
  ERROR_MSG="${RAW_ERROR%%--from*}"
  ERROR_MSG="${ERROR_MSG%% }"
fi

STDIN_CONTENT=""
if [ ! -t 0 ]; then STDIN_CONTENT=$(cat); fi

PROBLEM_CONTENT=""
if [[ -n "$FROM_FILE" ]]; then
  if [[ ! -f "$FROM_FILE" ]]; then echo "Error: --from file not found: $FROM_FILE" >&2; exit 1; fi
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

printf '%s' "$PROBLEM_CONTENT" | aco run copilot rescue
```
