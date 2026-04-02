---
name: gemini:review
description: Delegate code review to Gemini CLI (git diff HEAD or specific file)
argument-hint: "[path/to/file.ts]"
allowed-tools:
  - Bash
---

Delegate code review to Gemini CLI. Without an argument, reviews the current `git diff HEAD`. With a file path argument, reviews that file's content. Output from Gemini is returned verbatim.

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# D-05: Source shared adapter library (all CLI calls go through adapter.sh)
source "${SCRIPT_DIR}/../../aco/lib/adapter.sh"

# D-05: Check adapter availability — aco_check_adapter prints named error + install hint on failure
aco_check_adapter "gemini" || exit 1

# D-02: Load reviewer role prompt
REVIEWER_PROMPT_FILE="${SCRIPT_DIR}/../../aco/prompts/gemini/reviewer.md"
if [[ ! -f "$REVIEWER_PROMPT_FILE" ]]; then
  echo "Error: reviewer prompt not found at ${REVIEWER_PROMPT_FILE}" >&2
  echo "Run the Phase 7 scaffolding plan to create it." >&2
  exit 1
fi
REVIEWER_PROMPT=$(cat "$REVIEWER_PROMPT_FILE")

# REV-02: File path argument takes priority over git diff
FILE_ARG="${ARGUMENTS:-}"
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

# D-03: Pass adapter output verbatim — no extra wrapping
aco_adapter_invoke "gemini" "$REVIEWER_PROMPT" "$CONTENT"
```
