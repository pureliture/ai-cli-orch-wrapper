---
name: gemini:status
description: Check Gemini CLI availability and version, or get session status
argument-hint: "[--session <id>]"
allowed-tools:
  - Bash
---

Check whether Gemini CLI is installed and print its version. With `--session <id>`, shows the session status instead.

```bash
#!/usr/bin/env bash
set -euo pipefail
SESSION_ID="${ARGUMENTS:-}"
if [[ -n "$SESSION_ID" ]]; then
  aco status --session "$SESSION_ID"
else
  aco provider setup gemini 2>&1 || true
fi
```
