---
name: antigravity:review
description: Delegate code review to Antigravity CLI (git diff HEAD or specific file).
argument-hint: "[path/to/file.ts]"
allowed-tools:
  - Bash
---

Delegate code review to Antigravity CLI. Without an argument, reviews the current `git diff HEAD`. With a file path argument, reviews that file's content. Output from Antigravity is returned verbatim.

```bash
#!/usr/bin/env bash
set -euo pipefail

FILE_ARG="${ARGUMENTS:-}"
if [[ -n "$FILE_ARG" ]]; then
  if [[ ! -f "$FILE_ARG" ]]; then
    echo "Error: file not found: $FILE_ARG" >&2; exit 1
  fi
  cat "$FILE_ARG" | aco run antigravity review
else
  CONTENT=$(git diff HEAD 2>/dev/null || true)
  if [[ -z "$CONTENT" ]]; then CONTENT=$(git diff HEAD~1 2>/dev/null || true); fi
  if [[ -z "$CONTENT" ]]; then echo "No changes detected"; exit 0; fi
  printf '%s' "$CONTENT" | aco run antigravity review
fi
```
