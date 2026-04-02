---
name: copilot:adversarial
description: Adversarial code review via GitHub Copilot CLI — assumes bugs exist, finds them. Use --focus to scope. Use --background to run as a background task.
argument-hint: "[--background] [--focus security|performance|correctness|all] [path/to/file.ts]"
allowed-tools:
  - Bash
---

Adversarial code review via GitHub Copilot CLI. More aggressive than `:review` — starts from the assumption that bugs exist. Optionally scope with `--focus security`, `--focus performance`, `--focus correctness`, or `--focus all` (default). Use `--background` to run as a background task; retrieve output with `/copilot:result <task-id>`. Without a file argument, reviews `git diff HEAD`.

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# ADV-01: Source shared adapter library
source "${SCRIPT_DIR}/../../aco/lib/adapter.sh"

# ADV-01: Check adapter availability
aco_check_adapter "copilot" || exit 1

# ADV-01: Load adversarial prompt (more aggressive than reviewer.md)
ADVERSARIAL_PROMPT_FILE="${SCRIPT_DIR}/../../aco/prompts/copilot/adversarial.md"
if [[ ! -f "$ADVERSARIAL_PROMPT_FILE" ]]; then
  echo "Error: adversarial prompt not found at ${ADVERSARIAL_PROMPT_FILE}" >&2
  echo "Run Plan 08-01 to create it." >&2
  exit 1
fi
ADVERSARIAL_PROMPT=$(cat "$ADVERSARIAL_PROMPT_FILE")

# BG-01: Parse --background flag first; strip it before --focus parsing
ARGS="${ARGUMENTS:-}"
BG_FLAG=false
if [[ "$ARGS" == *"--background"* ]]; then
  BG_FLAG=true
  ARGS="${ARGS/--background/}"
  ARGS="${ARGS#"${ARGS%%[! ]*}"}"  # trim leading whitespace
  ARGS="${ARGS%"${ARGS##*[! ]}"}"  # trim trailing whitespace
fi

# ADV-02: Parse --focus flag from remaining ARGS
FOCUS="all"
if [[ "$ARGS" =~ --focus[[:space:]]+([a-z]+) ]]; then
  FOCUS="${BASH_REMATCH[1]}"
  ARGS="${ARGS/--focus $FOCUS/}"
  ARGS="${ARGS#"${ARGS%%[! ]*}"}"
fi

# ADV-02: Validate focus value
case "$FOCUS" in
  security|performance|correctness|all) ;;
  *) echo "Error: invalid --focus '${FOCUS}'. Valid values: security|performance|correctness|all" >&2; exit 1 ;;
esac

# ADV-02: Append focus instruction to prompt (empty string for 'all' = no constraint)
case "$FOCUS" in
  security)
    FOCUS_INSTR="FOCUS CONSTRAINT: Concentrate exclusively on security vulnerabilities. Treat every unvalidated input, every auth check, every secret access, and every dependency as a potential attack surface. Other findings are out of scope for this review."
    ;;
  performance)
    FOCUS_INSTR="FOCUS CONSTRAINT: Concentrate exclusively on performance issues. Identify algorithmic complexity problems, N+1 query patterns, unbounded memory growth, unnecessary I/O, and blocking operations. Other findings are out of scope."
    ;;
  correctness)
    FOCUS_INSTR="FOCUS CONSTRAINT: Concentrate exclusively on correctness and logic errors. Identify wrong output, missed edge cases, off-by-one errors, type coercion surprises, and race conditions. Other findings are out of scope."
    ;;
  all)
    FOCUS_INSTR=""
    ;;
esac
if [[ -n "$FOCUS_INSTR" ]]; then
  ADVERSARIAL_PROMPT="${ADVERSARIAL_PROMPT}"$'\n\n'"${FOCUS_INSTR}"
fi

# ADV-03: Input resolution — identical priority chain to review.md
FILE_ARG="$ARGS"
if [[ -n "$FILE_ARG" ]]; then
  if [[ ! -f "$FILE_ARG" ]]; then
    echo "Error: file not found: $FILE_ARG" >&2
    exit 1
  fi
  CONTENT=$(cat "$FILE_ARG")
else
  CONTENT=$(git diff HEAD 2>/dev/null || true)
  if [[ -z "$CONTENT" ]]; then
    CONTENT=$(git diff HEAD~1 2>/dev/null || true)
  fi
  if [[ -z "$CONTENT" ]]; then
    echo "No changes detected"
    exit 0
  fi
fi

# BG-01: Background vs foreground dispatch
if [[ "$BG_FLAG" == true ]]; then
  TASK_ID=$(aco_bg_task_id "copilot" "adversarial")
  aco_bg_task_launch "$TASK_ID" "copilot" "$ADVERSARIAL_PROMPT" "$CONTENT"
else
  # Dispatch through adapter (output verbatim)
  aco_adapter_invoke "copilot" "$ADVERSARIAL_PROMPT" "$CONTENT"
fi
```
