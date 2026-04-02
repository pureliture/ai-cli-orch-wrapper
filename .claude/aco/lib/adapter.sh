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
