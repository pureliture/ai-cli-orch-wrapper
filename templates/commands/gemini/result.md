---
name: gemini:result
description: Retrieve the output of a background Gemini task
argument-hint: "[--session <id>]"
allowed-tools:
  - Bash
---

Retrieve the output of a background task. Prints the output if complete, or status if still running.

```bash
#!/usr/bin/env bash
set -euo pipefail
SESSION_ID="${ARGUMENTS:-}"
if [[ -n "$SESSION_ID" ]]; then
  aco result --session "$SESSION_ID"
else
  aco result
fi
```
