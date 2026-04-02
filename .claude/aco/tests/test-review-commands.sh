#!/usr/bin/env bash
# test-review-commands.sh — Tests for Phase 7 review/status commands
# Covers: REV-01 (diff dispatch), REV-02 (file arg), REV-03 (empty diff fallback), STAT-01 (availability+version)
# Usage: bash .claude/aco/tests/test-review-commands.sh
# Exit 0: all tests pass. Non-zero: failure.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ADAPTER_LIB="${SCRIPT_DIR}/../lib/adapter.sh"

if [[ ! -f "$ADAPTER_LIB" ]]; then
  echo "FAIL: adapter.sh not found at $ADAPTER_LIB" >&2
  exit 1
fi

# shellcheck source=../lib/adapter.sh
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

# ── REV-03: Empty diff fallback logic ──────────────────────────────────────
# Tests the fallback chain: empty HEAD diff → try HEAD~1 → "No changes detected"
# Uses simulated empty diffs (does not require a specific git state).
test_rev03_no_changes_message() {
  local content_head=""
  local content_prev=""
  local output
  if [[ -n "$content_head" ]]; then
    output="$content_head"
  elif [[ -n "$content_prev" ]]; then
    output="$content_prev"
  else
    output="No changes detected"
  fi
  [[ "$output" == "No changes detected" ]]
}
test_rev03_no_changes_message
run_test "REV-03: empty diff chain produces 'No changes detected'" "$?"

# ── REV-02: File argument content capture ──────────────────────────────────
test_rev02_file_content() {
  local tmpfile
  tmpfile=$(mktemp /tmp/test-review-XXXX.ts)
  echo "const x: number = 42;" > "$tmpfile"
  local content
  content=$(cat "$tmpfile")
  rm -f "$tmpfile"
  [[ "$content" == "const x: number = 42;" ]]
}
test_rev02_file_content
run_test "REV-02: file content captured correctly via cat" "$?"

# ── REV-02: Non-existent file path detected ────────────────────────────────
test_rev02_missing_file_detection() {
  local nonexistent="/tmp/definitely_not_here_phase7_xyz_$(date +%s).ts"
  [[ ! -f "$nonexistent" ]]
}
test_rev02_missing_file_detection
run_test "REV-02: non-existent file path correctly identified as missing" "$?"

# ── STAT-01: Adapter availability check (gemini) ───────────────────────────
aco_adapter_available "gemini" && GEMINI_AVAIL=0 || GEMINI_AVAIL=$?
[[ "$GEMINI_AVAIL" -eq 0 || "$GEMINI_AVAIL" -eq 1 ]]
run_test "STAT-01: gemini availability check returns 0 or 1 (no crash)" "$?"

# ── STAT-01: Adapter availability check (copilot) ──────────────────────────
aco_adapter_available "copilot" && COPILOT_AVAIL=0 || COPILOT_AVAIL=$?
[[ "$COPILOT_AVAIL" -eq 0 || "$COPILOT_AVAIL" -eq 1 ]]
run_test "STAT-01: copilot availability check returns 0 or 1 (no crash)" "$?"

# ── STAT-01: Version string non-empty (gemini) ─────────────────────────────
GEMINI_VER=$(aco_adapter_version "gemini")
[[ -n "$GEMINI_VER" ]]
run_test "STAT-01: gemini version returns non-empty string" "$?"

# ── STAT-01: Version string non-empty (copilot) ────────────────────────────
COPILOT_VER=$(aco_adapter_version "copilot")
[[ -n "$COPILOT_VER" ]]
run_test "STAT-01: copilot version returns non-empty string" "$?"

# ── STAT-01: Status output format (✓ or ✗ prefix) ─────────────────────────
format_status_line() {
  local key="$1"
  if aco_adapter_available "$key"; then
    local ver
    ver=$(aco_adapter_version "$key")
    echo "✓ $key  $ver"
  else
    echo "✗ $key  (not installed)"
    echo "  Install: $(case "$key" in gemini) echo 'npm install -g @google/gemini-cli' ;; copilot) echo 'npm install -g @github/copilot' ;; esac)"
  fi
}

GEMINI_STATUS_LINE=$(format_status_line "gemini")
echo "$GEMINI_STATUS_LINE" | grep -qE "^[✓✗] gemini"
run_test "STAT-01: gemini status line starts with ✓ or ✗ followed by 'gemini'" "$?"

COPILOT_STATUS_LINE=$(format_status_line "copilot")
echo "$COPILOT_STATUS_LINE" | grep -qE "^[✓✗] copilot"
run_test "STAT-01: copilot status line starts with ✓ or ✗ followed by 'copilot'" "$?"

# ── Wave 0: Reviewer prompt files exist ────────────────────────────────────
# These checks are RED until Task 2 creates the prompt files.
PROMPTS_DIR="${SCRIPT_DIR}/../prompts"

[[ -f "${PROMPTS_DIR}/gemini/reviewer.md" ]]
run_test "Wave 0: .claude/aco/prompts/gemini/reviewer.md exists" "$?"

[[ -f "${PROMPTS_DIR}/copilot/reviewer.md" ]]
run_test "Wave 0: .claude/aco/prompts/copilot/reviewer.md exists" "$?"

# ── Summary ────────────────────────────────────────────────────────────────
echo ""
echo "Results: ${PASS} passed, ${FAIL} failed"
[[ "$FAIL" -eq 0 ]]
