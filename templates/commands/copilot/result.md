---
name: copilot:result
description: Retrieve the output of a Copilot task
argument-hint: "[<session-id>]"
allowed-tools:
  - Bash
---

Retrieve the output of a task. Prints the output if complete, or status if still running. Pass a session ID to target a specific session; omit to use the most recent.

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

