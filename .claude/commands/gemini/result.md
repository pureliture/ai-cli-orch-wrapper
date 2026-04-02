---
name: gemini:result
description: Retrieve the output of a background Gemini review or adversarial task
argument-hint: "<task-id>"
allowed-tools:
  - Bash
---

Retrieve the output of a background task launched with `/gemini:review --background` or `/gemini:adversarial --background`. Prints the review output if the task is complete, "Still running — check again later" if it is still in progress, "Task \<id\> was cancelled." if it was cancelled, or "Task not found: \<id\>" if the task ID is unrecognised.

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../aco/lib/adapter.sh"

# BG-02: Task ID is the sole argument
TASK_ID="${ARGUMENTS:-}"
if [[ -z "$TASK_ID" ]]; then
  echo "Error: task ID required." >&2
  echo "Usage: /gemini:result <task-id>" >&2
  echo "Get a task ID by running: /gemini:review --background" >&2
  exit 1
fi

# BG-02: Delegate to adapter helper — handles all status cases
aco_bg_task_result "$TASK_ID"
```
