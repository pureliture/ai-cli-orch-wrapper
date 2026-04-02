---
name: copilot:cancel
description: Cancel a running background Copilot task
argument-hint: "[--session <id>]"
allowed-tools:
  - Bash
---

Cancel a background task launched with `/copilot:review --background`. Sends SIGTERM to the provider process and marks the session as cancelled.

```bash
#!/usr/bin/env bash
set -euo pipefail
SESSION_ID="${ARGUMENTS:-}"
if [[ -n "$SESSION_ID" ]]; then
  aco cancel --session "$SESSION_ID"
else
  aco cancel
fi
```
