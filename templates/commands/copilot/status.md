---
name: copilot:status
description: Check GitHub Copilot CLI availability and version, or get session status
argument-hint: "[--session <id>]"
allowed-tools:
  - Bash
---

Check whether GitHub Copilot CLI is installed and print its version. With `--session <id>`, shows the session status instead.

```bash
#!/usr/bin/env bash
set -euo pipefail
SESSION_ID="${ARGUMENTS:-}"
if [[ -n "$SESSION_ID" ]]; then
  aco status --session "$SESSION_ID"
else
  aco provider setup copilot 2>&1 || true
fi
```
