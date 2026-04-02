#!/usr/bin/env bash
# smoke-adapters.sh — Integration smoke tests for ADPT-01 and ADPT-02
# Usage: bash smoke-adapters.sh [gemini|copilot]
# Exit 0: all targeted tests pass. Non-zero: failure.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ADAPTER_LIB="${SCRIPT_DIR}/../lib/adapter.sh"

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

test_gemini() {
  # ADPT-01: gemini adapter available
  aco_adapter_available "gemini"
  run_test "gemini adapter available" "$?"

  # ADPT-01: gemini adapter version non-empty
  local ver
  ver=$(aco_adapter_version "gemini")
  [[ -n "$ver" ]]
  run_test "gemini adapter version non-empty" "$?"
}

test_copilot() {
  # ADPT-02: copilot adapter available
  aco_adapter_available "copilot"
  run_test "copilot adapter available" "$?"

  # ADPT-02: copilot adapter version non-empty
  local ver
  ver=$(aco_adapter_version "copilot")
  [[ -n "$ver" ]]
  run_test "copilot adapter version non-empty" "$?"
}

TARGET="${1:-all}"

case "$TARGET" in
  gemini)  test_gemini ;;
  copilot) test_copilot ;;
  all)     test_gemini; test_copilot ;;
  *)
    echo "Usage: $0 [gemini|copilot|all]" >&2
    exit 2
    ;;
esac

echo ""
echo "Results: ${PASS} passed, ${FAIL} failed"
[[ "$FAIL" -eq 0 ]]
