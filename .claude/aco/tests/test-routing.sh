#!/usr/bin/env bash
# test-routing.sh — Integration tests for ADPT-04 routing config reader
# Exit 0: all tests pass. Non-zero: failure.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ADAPTER_LIB="${SCRIPT_DIR}/../lib/adapter.sh"
WRAPPER_JSON="${SCRIPT_DIR}/../../../.wrapper.json"

if [[ ! -f "$ADAPTER_LIB" ]]; then
  echo "FAIL: adapter.sh not found at $ADAPTER_LIB" >&2
  exit 1
fi

# shellcheck source=../.claude/aco/lib/adapter.sh
source "$ADAPTER_LIB"

PASS=0
FAIL=0

run_test() {
  local name="$1"
  local result="$2"
  if [[ "$result" -eq 0 ]]; then
    echo "PASS: $name"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $name" >&2
    FAIL=$((FAIL + 1))
  fi
}

# ADPT-04: _read_routing_adapter returns non-empty string for "review"
REVIEW_ADAPTER=$(_read_routing_adapter "review" "gemini")
[[ -n "$REVIEW_ADAPTER" ]]
run_test "_read_routing_adapter 'review' returns non-empty" "$?"

# ADPT-04: _read_routing_adapter returns non-empty string for "adversarial"
ADV_ADAPTER=$(_read_routing_adapter "adversarial" "copilot")
[[ -n "$ADV_ADAPTER" ]]
run_test "_read_routing_adapter 'adversarial' returns non-empty" "$?"

# ADPT-04: when .wrapper.json has routing block, returns configured value
if [[ -f "$WRAPPER_JSON" ]]; then
  if command -v jq >/dev/null 2>&1; then
    ROUTING_VAL=$(jq -r '.routing.review // empty' "$WRAPPER_JSON" 2>/dev/null)
    if [[ -n "$ROUTING_VAL" ]]; then
      RESULT=$(_read_routing_adapter "review" "gemini")
      [[ "$RESULT" == "$ROUTING_VAL" ]]
      run_test ".wrapper.json routing.review value honored" "$?"
    fi
  fi
fi

# ADPT-04: fallback to default when key not in config
FALLBACK_VAL=$(_read_routing_adapter "nonexistent_command_key" "my-fallback-default")
[[ "$FALLBACK_VAL" == "my-fallback-default" ]]
run_test "_read_routing_adapter uses default when key absent" "$?"

echo ""
echo "Results: ${PASS} passed, ${FAIL} failed"
[[ "$FAIL" -eq 0 ]]
