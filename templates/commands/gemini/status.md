---
name: gemini:status
description: Show session status for a Gemini task
argument-hint: "[<session-id>]"
allowed-tools:
  - Bash
---

Show session status. Pass a session ID to target a specific session; omit to show the most recent. To check provider install/auth status, use `/gemini:setup`.

```bash
#!/usr/bin/env bash
set -euo pipefail
SESSION_ID="${ARGUMENTS:-}"
if [[ -n "$SESSION_ID" ]]; then
  aco status --session "$SESSION_ID"
else
  aco status
fi
```

