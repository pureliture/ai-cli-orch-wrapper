---
name: gemini:cancel
description: Cancel a running Gemini task
argument-hint: "[<session-id>]"
allowed-tools:
  - Bash
---

Cancel a running task. Sends SIGTERM to the provider process and marks the session as cancelled. Pass a session ID to target a specific session; omit to cancel the most recent.

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

