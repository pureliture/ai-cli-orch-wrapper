#!/usr/bin/env bash
# test-error-handling.sh — Unit tests for ADPT-03 missing adapter error messages
# Exit 0: all tests pass. Non-zero: failure.
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

# ADPT-03: nonexistent adapter returns exit code 1
aco_check_adapter "nonexistent-adapter-xyz" 2>/dev/null && NONEXIST_EXIT=0 || NONEXIST_EXIT=$?
[[ "$NONEXIST_EXIT" -ne 0 ]]
run_test "nonexistent adapter exits non-zero" "$?"

# ADPT-03: error message mentions "not installed"
STDERR_OUT=$(aco_check_adapter "nonexistent-adapter-xyz" 2>&1 >/dev/null || true)
echo "$STDERR_OUT" | grep -qi "not installed"
run_test "error message contains 'not installed'" "$?"

# ADPT-03: error message names the missing adapter key
echo "$STDERR_OUT" | grep -q "nonexistent-adapter-xyz"
run_test "error message names the missing adapter key" "$?"

# ADPT-03: unknown key exits non-zero
aco_check_adapter "gemini_missing_key_xyz" 2>/dev/null && GMISSING_EXIT=0 || GMISSING_EXIT=$?
[[ "${GMISSING_EXIT}" -ne 0 ]]
run_test "unknown adapter key exits non-zero" "$?"

echo ""
echo "Results: ${PASS} passed, ${FAIL} failed"
[[ "$FAIL" -eq 0 ]]
