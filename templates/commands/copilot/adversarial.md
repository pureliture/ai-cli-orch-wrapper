---
name: copilot:adversarial
description: Adversarial code review via Gemini CLI — assumes bugs exist, finds them. Use --focus to scope. Use --background to run as a background task.
argument-hint: "[--background] [--focus security|performance|correctness|all] [path/to/file.ts]"
allowed-tools:
  - Bash
---

Adversarial code review via Gemini CLI. More aggressive than `:review` — starts from the assumption that bugs exist. Optionally scope with `--focus security`, `--focus performance`, `--focus correctness`, or `--focus all` (default). Use `--background` to run as a background task; retrieve output with `/gemini:result --session <id>`. Without a file argument, reviews `git diff HEAD`.

```bash
#!/usr/bin/env bash
set -euo pipefail

ARGS="${ARGUMENTS:-}"
BG_FLAG=false
if [[ "$ARGS" == *"--background"* ]]; then
  BG_FLAG=true
  ARGS="${ARGS/--background/}"
  ARGS="${ARGS#"${ARGS%%[! ]*}"}"
  ARGS="${ARGS%"${ARGS##*[! ]}"}"
fi

FOCUS="all"
if [[ "$ARGS" =~ --focus[[:space:]]+([a-z]+) ]]; then
  FOCUS="${BASH_REMATCH[1]}"
  ARGS="${ARGS/--focus $FOCUS/}"
  ARGS="${ARGS#"${ARGS%%[! ]*}"}"
fi

case "$FOCUS" in
  security|performance|correctness|all) ;;
  *) echo "Error: invalid --focus '${FOCUS}'. Valid values: security|performance|correctness|all" >&2; exit 1 ;;
esac

FILE_ARG="$ARGS"
if [[ -n "$FILE_ARG" ]]; then
  if [[ ! -f "$FILE_ARG" ]]; then echo "Error: file not found: $FILE_ARG" >&2; exit 1; fi
  aco run copilot adversarial --input "$(cat "$FILE_ARG")"
else
  CONTENT=$(git diff HEAD 2>/dev/null || true)
  if [[ -z "$CONTENT" ]]; then CONTENT=$(git diff HEAD~1 2>/dev/null || true); fi
  if [[ -z "$CONTENT" ]]; then echo "No changes detected"; exit 0; fi
  printf '%s' "$CONTENT" | aco run copilot adversarial
fi
```
