---
name: gemini:cancel
description: Cancel a running background Gemini review or adversarial task
argument-hint: "<task-id>"
allowed-tools:
  - Bash
---

Cancel a background task launched with `/gemini:review --background` or `/gemini:adversarial --background`. Kills the running process and marks the task as cancelled. Prints a confirmation on success, or an error message if the task is not found or is not in a running state.

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../aco/lib/adapter.sh"

# BG-03: Task ID is the sole argument
TASK_ID="${ARGUMENTS:-}"
if [[ -z "$TASK_ID" ]]; then
  echo "Error: task ID required." >&2
  echo "Usage: /gemini:cancel <task-id>" >&2
  echo "Get a task ID by running: /gemini:review --background" >&2
  exit 1
fi

# BG-03: Delegate to adapter helper — kills PID + marks cancelled
aco_bg_task_cancel "$TASK_ID"
```
