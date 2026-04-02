#!/usr/bin/env bash
# adapter.sh — Shared bash adapter helpers for /aco:* slash commands
#
# Source this file at the top of any /aco:* slash command:
#   source "$(dirname "$0")/../../aco/lib/adapter.sh"
#
# Public API:
#   aco_adapter_available <key>          — exit 0 if CLI available, 1 if not
#   aco_adapter_version   <key>          — print version string (or "unavailable")
#   aco_check_adapter     <key>          — exit 0 OK; exit 1 + stderr msg if missing
#   aco_adapter_invoke    <key> <prompt> [stdin_content]  — spawn adapter, capture stdout

# ---------------------------------------------------------------------------
# _aco_binary_for_key <key>
# Maps a logical adapter key to a binary name.
# ---------------------------------------------------------------------------
_aco_binary_for_key() {
  local key="$1"
  case "$key" in
    gemini)  echo "gemini" ;;
    copilot) echo "copilot" ;;
    *)       echo "$key" ;;
  esac
}

# ---------------------------------------------------------------------------
# _aco_install_hint <key>
# Prints an install hint to stderr for known adapter keys.
# ---------------------------------------------------------------------------
_aco_install_hint() {
  local key="$1"
  case "$key" in
    gemini)  echo "  npm install -g @google/gemini-cli" >&2 ;;
    copilot) echo "  npm install -g @github/copilot" >&2
             echo "  Ensure you are authenticated: gh auth login" >&2 ;;
    *)       echo "  (no install hint available for '$key')" >&2 ;;
  esac
}

# ---------------------------------------------------------------------------
# aco_adapter_available <key>
# Returns 0 if the adapter binary is in PATH; 1 otherwise.
# ---------------------------------------------------------------------------
aco_adapter_available() {
  local key="$1"
  local binary
  binary=$(_aco_binary_for_key "$key")
  command -v "$binary" >/dev/null 2>&1
}

# ---------------------------------------------------------------------------
# aco_adapter_version <key>
# Prints the version string for the adapter, or "unavailable" if not installed.
# ---------------------------------------------------------------------------
aco_adapter_version() {
  local key="$1"
  local binary
  binary=$(_aco_binary_for_key "$key")

  if ! command -v "$binary" >/dev/null 2>&1; then
    echo "unavailable"
    return 0
  fi

  case "$key" in
    gemini)
      "$(command -v gemini)" --version 2>&1 | head -1
      ;;
    copilot)
      "$(command -v copilot)" --version 2>&1 | head -1
      ;;
    *)
      "$binary" --version 2>&1 | head -1 || echo "unavailable"
      ;;
  esac
}

# ---------------------------------------------------------------------------
# aco_check_adapter <key>
# Returns 0 if adapter is available.
# On failure: prints named error + install hint to stderr; returns 1.
# ---------------------------------------------------------------------------
aco_check_adapter() {
  local key="$1"
  local binary
  binary=$(_aco_binary_for_key "$key")

  if ! command -v "$binary" >/dev/null 2>&1; then
    echo "Error: adapter '$key' is not installed. Install it first:" >&2
    _aco_install_hint "$key"
    return 1
  fi
  return 0
}

# ---------------------------------------------------------------------------
# aco_adapter_invoke <key> <prompt> [stdin_content]
# Spawns the adapter CLI, optionally piping stdin_content, captures stdout.
# Returns the adapter's exit code.
#
# Gemini: content piped via stdin; instruction via -p flag.
#         Requires --yolo to auto-approve tool calls in non-interactive mode.
#         NOTE: bash scripts do NOT expand aliases; must invoke via $(command -v gemini).
#
# Copilot: no confirmed stdin piping support — embed content in -p arg.
#          Requires --allow-all-tools for non-interactive; --silent suppresses stats.
# ---------------------------------------------------------------------------
aco_adapter_invoke() {
  local key="$1"
  local prompt="$2"
  local stdin_content="${3:-}"

  if ! aco_check_adapter "$key"; then
    return 1
  fi

  case "$key" in
    gemini)
      local gemini_bin
      gemini_bin="$(command -v gemini)"
      printf '%s' "$stdin_content" | "$gemini_bin" --yolo -p "$prompt" 2>&1
      ;;
    copilot)
      local copilot_bin
      copilot_bin="$(command -v copilot)"
      local full_prompt
      if [[ -n "$stdin_content" ]]; then
        full_prompt="${stdin_content}"$'\n\n'"${prompt}"
      else
        full_prompt="$prompt"
      fi
      "$copilot_bin" -p "$full_prompt" --allow-all-tools --silent 2>&1
      ;;
    *)
      echo "Error: no invocation strategy defined for adapter '$key'" >&2
      return 1
      ;;
  esac
}

# ---------------------------------------------------------------------------
# _read_routing_adapter <cmd> <default>
# Reads the routing adapter key for <cmd> from .wrapper.json in the CWD.
# Falls back to <default> if .wrapper.json is missing, has no routing block,
# or the specific key is absent.
# Uses jq if available; falls back to python3 for portability.
# Never exits non-zero — always outputs a string.
#
# Usage:
#   ADAPTER=$(_read_routing_adapter "review" "gemini")
#   ADAPTER=$(_read_routing_adapter "adversarial" "copilot")
# ---------------------------------------------------------------------------
_read_routing_adapter() {
  local cmd="$1"
  local default="$2"

  if [[ ! -f ".wrapper.json" ]]; then
    echo "$default"
    return 0
  fi

  if command -v jq >/dev/null 2>&1; then
    local result
    result=$(jq -r ".routing.${cmd} // empty" .wrapper.json 2>/dev/null)
    if [[ -n "$result" ]]; then
      echo "$result"
    else
      echo "$default"
    fi
    return 0
  fi

  # jq not available: fall back to python3
  python3 -c "
import json, sys
try:
    d = json.load(open('.wrapper.json'))
    val = d.get('routing', {}).get('${cmd}', '')
    print(val if val else '${default}')
except Exception:
    print('${default}')
" 2>/dev/null || echo "$default"
}

# ===========================================================================
# Background Task Helpers
# Phase 9 — result + cancel
#
# Public API:
#   aco_bg_task_dir                              — return (and create) tasks dir
#   aco_bg_task_id    <adapter> <cmd>            — generate unique task ID
#   aco_bg_task_launch <task-id> <adapter> <prompt> [stdin_content]
#   aco_bg_task_status <task-id>                 — running|complete|cancelled|error|not_found
#   aco_bg_task_result <task-id>                 — print output or status message
#   aco_bg_task_cancel <task-id>                 — kill + mark cancelled
#
# Task state lives in ${ACO_TASKS_DIR:-$HOME/.gsd-tasks}/<task-id>.{pid,output,status}
# ===========================================================================

# ---------------------------------------------------------------------------
# aco_bg_task_dir
# Returns the background tasks directory path, creating it if it does not exist.
# Respects ACO_TASKS_DIR environment variable (set this in tests to use a tmpdir).
# ---------------------------------------------------------------------------
aco_bg_task_dir() {
  local dir="${ACO_TASKS_DIR:-${HOME}/.gsd-tasks}"
  mkdir -p "$dir"
  echo "$dir"
}

# ---------------------------------------------------------------------------
# aco_bg_task_id <adapter> <cmd>
# Generates a unique task ID of the form: <adapter>-<cmd>-<timestamp>-<hex8>
# Example: gemini-review-1745678901-a3f2b1c0
# Uses /dev/urandom for the random hex suffix; falls back to $RANDOM arithmetic.
# ---------------------------------------------------------------------------
aco_bg_task_id() {
  local adapter="$1"
  local cmd="$2"
  local ts
  ts=$(date +%s)
  local rand
  rand=$(od -An -N4 -tx4 /dev/urandom 2>/dev/null | tr -d ' \n' \
    || printf '%04x%04x' $RANDOM $RANDOM)
  echo "${adapter}-${cmd}-${ts}-${rand}"
}

# ---------------------------------------------------------------------------
# aco_bg_task_launch <task-id> <adapter> <prompt> [stdin_content]
# Spawns aco_adapter_invoke in a background subshell.
# Writes {task-id}.status = "running" and {task-id}.pid before returning.
# The subshell writes captured output to {task-id}.output and updates .status
# to "complete" or "error" when finished, then removes the .pid file.
# Prints a human-readable confirmation with the task ID and retrieval commands.
# ---------------------------------------------------------------------------
aco_bg_task_launch() {
  local task_id="$1"
  local adapter="$2"
  local prompt="$3"
  local stdin_content="${4:-}"

  local tasks_dir
  tasks_dir=$(aco_bg_task_dir)

  local out_file="${tasks_dir}/${task_id}.output"
  local pid_file="${tasks_dir}/${task_id}.pid"
  local status_file="${tasks_dir}/${task_id}.status"

  # Mark running before spawning so callers can query immediately
  echo "running" > "$status_file"

  # Spawn background subshell; capture all output (stdout + stderr) to out_file
  (
    if aco_adapter_invoke "$adapter" "$prompt" "$stdin_content" > "$out_file" 2>&1; then
      echo "complete" > "$status_file"
    else
      echo "error" > "$status_file"
    fi
    rm -f "$pid_file"
  ) &

  local bg_pid=$!
  echo "$bg_pid" > "$pid_file"
  disown "$bg_pid" 2>/dev/null || true

  echo "Background task started: ${task_id}"
  echo "  Retrieve:  /${adapter}:result ${task_id}"
  echo "  Cancel:    /${adapter}:cancel ${task_id}"
}

# ---------------------------------------------------------------------------
# aco_bg_task_status <task-id>
# Returns one of: running | complete | cancelled | error | not_found
#
# If status file says "running", validates the PID is still alive:
#   - alive           → "running"
#   - dead + output   → promote to "complete" (updates status file)
#   - dead + no output→ promote to "error"   (updates status file)
# ---------------------------------------------------------------------------
aco_bg_task_status() {
  local task_id="$1"
  local tasks_dir
  tasks_dir=$(aco_bg_task_dir)

  local status_file="${tasks_dir}/${task_id}.status"
  local pid_file="${tasks_dir}/${task_id}.pid"

  if [[ ! -f "$status_file" ]]; then
    echo "not_found"
    return 0
  fi

  local status
  status=$(cat "$status_file")

  if [[ "$status" == "running" ]]; then
    if [[ -f "$pid_file" ]]; then
      local pid
      pid=$(cat "$pid_file")
      if kill -0 "$pid" 2>/dev/null; then
        echo "running"
        return 0
      fi
    fi
    # Process is gone — decide final status from output file presence
    local out_file="${tasks_dir}/${task_id}.output"
    if [[ -f "$out_file" ]]; then
      echo "complete" > "$status_file"
      echo "complete"
    else
      echo "error" > "$status_file"
      echo "error"
    fi
    return 0
  fi

  echo "$status"
}

# ---------------------------------------------------------------------------
# aco_bg_task_result <task-id>
# Prints the output of a completed task, or a descriptive status message:
#   not_found  → "Task not found: <id>"
#   running    → "Still running — check again later"
#   cancelled  → "Task <id> was cancelled."
#   error      → "Task <id> completed with errors:" + output (if any)
#   complete   → contents of output file
# ---------------------------------------------------------------------------
aco_bg_task_result() {
  local task_id="$1"
  local tasks_dir
  tasks_dir=$(aco_bg_task_dir)

  local status
  status=$(aco_bg_task_status "$task_id")

  case "$status" in
    not_found)
      echo "Task not found: ${task_id}"
      ;;
    running)
      echo "Still running — check again later"
      ;;
    cancelled)
      echo "Task ${task_id} was cancelled."
      ;;
    error)
      local out_file="${tasks_dir}/${task_id}.output"
      if [[ -f "$out_file" ]]; then
        echo "Task ${task_id} completed with errors:"
        cat "$out_file"
      else
        echo "Task ${task_id} failed with no output."
      fi
      ;;
    complete)
      local out_file="${tasks_dir}/${task_id}.output"
      if [[ -f "$out_file" ]]; then
        cat "$out_file"
      else
        echo "Task ${task_id} completed but output file is missing."
      fi
      ;;
  esac
}

# ---------------------------------------------------------------------------
# aco_bg_task_cancel <task-id>
# Kills the background process (if running) and marks the task as cancelled.
# Prints a confirmation message on success.
# Exits 1 with an error message if task not found or not in running state.
# ---------------------------------------------------------------------------
aco_bg_task_cancel() {
  local task_id="$1"
  local tasks_dir
  tasks_dir=$(aco_bg_task_dir)

  local status_file="${tasks_dir}/${task_id}.status"
  local pid_file="${tasks_dir}/${task_id}.pid"

  if [[ ! -f "$status_file" ]]; then
    echo "Task not found: ${task_id}"
    return 1
  fi

  local status
  status=$(cat "$status_file")

  if [[ "$status" != "running" ]]; then
    echo "Cannot cancel task ${task_id}: status is '${status}' (not running)"
    return 1
  fi

  if [[ -f "$pid_file" ]]; then
    local pid
    pid=$(cat "$pid_file")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
    rm -f "$pid_file"
  fi

  echo "cancelled" > "$status_file"
  echo "Task ${task_id} cancelled."
}
