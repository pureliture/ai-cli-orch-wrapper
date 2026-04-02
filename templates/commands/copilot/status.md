---
name: copilot:status
description: Check GitHub Copilot provider install/auth status, or show session status
argument-hint: "[<session-id>]"
allowed-tools:
  - Bash
---

Without an argument, checks whether GitHub Copilot CLI is installed and authenticated. With a session ID, shows that session's status.

```bash
#!/usr/bin/env bash
set -euo pipefail
SESSION_ID="${ARGUMENTS:-}"
if [[ -n "$SESSION_ID" ]]; then
  aco status --session "$SESSION_ID"
else
  aco-install provider setup copilot 2>&1 || true
fi
```

