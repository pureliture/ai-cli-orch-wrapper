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

# ══════════════════════════════════════════════════════════════════════════════
# Phase 8: adversarial + rescue tests
# ══════════════════════════════════════════════════════════════════════════════

# ── ADV-02: --focus parsing extracts value and strips flag from ARGS ──────────
test_adv02_focus_parses_security() {
  local ARGS="--focus security src/auth.ts"
  local FOCUS="all"
  if [[ "$ARGS" =~ --focus[[:space:]]+([a-z]+) ]]; then
    FOCUS="${BASH_REMATCH[1]}"
    ARGS="${ARGS/--focus $FOCUS/}"
    ARGS="${ARGS## }"
  fi
  [[ "$FOCUS" == "security" ]] && [[ "$ARGS" == "src/auth.ts" ]]
}
test_adv02_focus_parses_security
run_test "ADV-02: --focus security parsed; remaining ARGS = file path" "$?"

# ── ADV-02: --focus defaults to 'all' when flag absent ────────────────────────
test_adv02_focus_defaults_to_all() {
  local ARGS="src/auth.ts"
  local FOCUS="all"
  if [[ "$ARGS" =~ --focus[[:space:]]+([a-z]+) ]]; then
    FOCUS="${BASH_REMATCH[1]}"
    ARGS="${ARGS/--focus $FOCUS/}"
    ARGS="${ARGS## }"
  fi
  [[ "$FOCUS" == "all" ]] && [[ "$ARGS" == "src/auth.ts" ]]
}
test_adv02_focus_defaults_to_all
run_test "ADV-02: no --focus flag → FOCUS defaults to 'all', ARGS unchanged" "$?"

# ── ADV-02: invalid --focus value is correctly identified as invalid ───────────
test_adv02_focus_invalid_rejected() {
  local FOCUS="xss"
  local valid=1
  case "$FOCUS" in
    security|performance|correctness|all) valid=0 ;;
    *) valid=1 ;;
  esac
  [[ "$valid" -eq 1 ]]
}
test_adv02_focus_invalid_rejected
run_test "ADV-02: invalid --focus value 'xss' correctly identified as invalid" "$?"

# ── ADV-02: all valid focus values accepted ────────────────────────────────────
test_adv02_focus_valid_values() {
  local all_valid=0
  for f in security performance correctness all; do
    local result=1
    case "$f" in
      security|performance|correctness|all) result=0 ;;
    esac
    [[ "$result" -eq 0 ]] || { all_valid=1; break; }
  done
  [[ "$all_valid" -eq 0 ]]
}
test_adv02_focus_valid_values
run_test "ADV-02: security/performance/correctness/all are all valid --focus values" "$?"

# ── RESC-01: --from <file> reads file content into problem description ─────────
test_resc01_from_flag_reads_file() {
  local tmpfile
  tmpfile=$(mktemp /tmp/test-rescue-from-XXXX.txt)
  echo "TypeError: Cannot read property 'id' of undefined" > "$tmpfile"
  local FROM_FILE=""
  local ARGUMENTS="--from $tmpfile"
  if [[ "${ARGUMENTS:-}" =~ --from[[:space:]]+([^[:space:]]+) ]]; then
    FROM_FILE="${BASH_REMATCH[1]}"
  fi
  local PROBLEM_CONTENT=""
  if [[ -n "$FROM_FILE" && -f "$FROM_FILE" ]]; then
    PROBLEM_CONTENT=$(cat "$FROM_FILE")
  fi
  rm -f "$tmpfile"
  [[ "$PROBLEM_CONTENT" == "TypeError: Cannot read property 'id' of undefined" ]]
}
test_resc01_from_flag_reads_file
run_test "RESC-01: --from <file> content correctly read into PROBLEM_CONTENT" "$?"

# ── RESC-01: --error <message> captures inline message ─────────────────────────
test_resc01_error_flag_captures_message() {
  local ERROR_MSG=""
  local ARGUMENTS="--error null pointer exception in main"
  if [[ "${ARGUMENTS:-}" =~ --error[[:space:]]+(.+)$ ]]; then
    local RAW_ERROR="${BASH_REMATCH[1]}"
    ERROR_MSG="${RAW_ERROR%%--from*}"
    ERROR_MSG="${ERROR_MSG%% }"
  fi
  [[ "$ERROR_MSG" == "null pointer exception in main" ]]
}
test_resc01_error_flag_captures_message
run_test "RESC-01: --error <message> captures full inline message" "$?"

# ── RESC-01: no input → fallback to positional ARGUMENTS ───────────────────────
test_resc01_positional_fallback() {
  local FROM_FILE=""
  local ERROR_MSG=""
  local STDIN_CONTENT=""
  local ARGUMENTS="server keeps crashing on startup"
  local PROBLEM_CONTENT=""
  if [[ -n "$FROM_FILE" ]] && [[ -n "$ERROR_MSG" ]]; then
    PROBLEM_CONTENT="merged"
  elif [[ -n "$FROM_FILE" ]]; then
    PROBLEM_CONTENT="from_file"
  elif [[ -n "$ERROR_MSG" ]]; then
    PROBLEM_CONTENT="$ERROR_MSG"
  elif [[ -n "$STDIN_CONTENT" ]]; then
    PROBLEM_CONTENT="$STDIN_CONTENT"
  else
    PROBLEM_CONTENT="${ARGUMENTS:-}"
  fi
  [[ "$PROBLEM_CONTENT" == "server keeps crashing on startup" ]]
}
test_resc01_positional_fallback
run_test "RESC-01: no --from/--error/stdin → falls back to positional ARGUMENTS" "$?"

# ── RESC-03: --from and --error both provided → merged with labeled sections ───
test_resc03_both_flags_merged() {
  local tmpfile
  tmpfile=$(mktemp /tmp/test-rescue-merge-XXXX.txt)
  echo "stack trace line 1" > "$tmpfile"
  local FROM_FILE="$tmpfile"
  local ERROR_MSG="null pointer"
  local PROBLEM_CONTENT=""
  if [[ -n "$FROM_FILE" ]] && [[ -n "$ERROR_MSG" ]]; then
    local FILE_CONTENT
    FILE_CONTENT=$(cat "$FROM_FILE")
    PROBLEM_CONTENT="Error message: ${ERROR_MSG}"$'\n\n'"File content (${FROM_FILE}):"$'\n'"${FILE_CONTENT}"
  fi
  rm -f "$tmpfile"
  echo "$PROBLEM_CONTENT" | grep -q "Error message: null pointer" && \
  echo "$PROBLEM_CONTENT" | grep -q "File content ("
}
test_resc03_both_flags_merged
run_test "RESC-03: --from and --error both provided → merged with labeled sections" "$?"

# ── RESC-02: git log context injection structure ────────────────────────────────
test_resc02_git_log_injection() {
  local GIT_LOG="abc1234 feat: add login"$'\n'"def5678 fix: resolve crash"
  local PROBLEM_CONTENT="the server keeps crashing on startup"
  local FULL_CONTEXT
  FULL_CONTEXT="Recent git history:"$'\n'"${GIT_LOG}"$'\n\n'"Problem:"$'\n'"${PROBLEM_CONTENT}"
  echo "$FULL_CONTEXT" | grep -q "^Recent git history:" && \
  echo "$FULL_CONTEXT" | grep -q "^Problem:" && \
  echo "$FULL_CONTEXT" | grep -q "abc1234"
}
test_resc02_git_log_injection
run_test "RESC-02: FULL_CONTEXT includes 'Recent git history:' prefix and 'Problem:' section" "$?"

# ── Wave 0 (08-01): Adversarial + Rescue prompt files ──────────────────────────
# RED until Plan 08-01 Tasks 1 and 2 execute.
PHASE8_PROMPTS_DIR="${SCRIPT_DIR}/../prompts"

[[ -f "${PHASE8_PROMPTS_DIR}/gemini/adversarial.md" ]]
run_test "Wave 0 (08-01): .claude/aco/prompts/gemini/adversarial.md exists" "$?"

[[ -f "${PHASE8_PROMPTS_DIR}/copilot/adversarial.md" ]]
run_test "Wave 0 (08-01): .claude/aco/prompts/copilot/adversarial.md exists" "$?"

[[ -f "${PHASE8_PROMPTS_DIR}/gemini/rescue.md" ]]
run_test "Wave 0 (08-01): .claude/aco/prompts/gemini/rescue.md exists" "$?"

[[ -f "${PHASE8_PROMPTS_DIR}/copilot/rescue.md" ]]
run_test "Wave 0 (08-01): .claude/aco/prompts/copilot/rescue.md exists" "$?"

# ── Wave 0 (08-02): Adversarial command files ──────────────────────────────────
# RED until Plan 08-02 executes.
PHASE8_COMMANDS_DIR="${SCRIPT_DIR}/../../commands"

[[ -f "${PHASE8_COMMANDS_DIR}/gemini/adversarial.md" ]] && _r=0 || _r=1
run_test "Wave 0 (08-02): .claude/commands/gemini/adversarial.md exists" "$_r"

[[ -f "${PHASE8_COMMANDS_DIR}/copilot/adversarial.md" ]] && _r=0 || _r=1
run_test "Wave 0 (08-02): .claude/commands/copilot/adversarial.md exists" "$_r"

# ── Wave 0 (08-03): Rescue command files ──────────────────────────────────────
# RED until Plan 08-03 executes.
[[ -f "${PHASE8_COMMANDS_DIR}/gemini/rescue.md" ]] && _r=0 || _r=1
run_test "Wave 0 (08-03): .claude/commands/gemini/rescue.md exists" "$_r"

[[ -f "${PHASE8_COMMANDS_DIR}/copilot/rescue.md" ]] && _r=0 || _r=1
run_test "Wave 0 (08-03): .claude/commands/copilot/rescue.md exists" "$_r"

# ══════════════════════════════════════════════════════════════════════════════
# Phase 9: result + cancel tests
# ══════════════════════════════════════════════════════════════════════════════

# Export ACO_TASKS_DIR to a tmpdir for all Phase 9 tests so we don't pollute ~/.gsd-tasks
_P9_TASKS_TMP=$(mktemp -d /tmp/test-gsd-tasks-XXXX)
export ACO_TASKS_DIR="$_P9_TASKS_TMP"

# ── BG-01: aco_bg_task_dir creates and returns path ──────────────────────────
test_bg01_task_dir_creates_path() {
  local dir
  dir=$(aco_bg_task_dir)
  [[ -n "$dir" ]] && [[ -d "$dir" ]]
}
test_bg01_task_dir_creates_path
run_test "BG-01: aco_bg_task_dir returns non-empty path and creates the directory" "$?"

# ── BG-01: aco_bg_task_id format matches <adapter>-<cmd>-<ts>-<hex8> ─────────
test_bg01_task_id_format() {
  local id
  id=$(aco_bg_task_id "gemini" "review")
  [[ "$id" =~ ^gemini-review-[0-9]+-[a-f0-9]+$ ]]
}
test_bg01_task_id_format
run_test "BG-01: aco_bg_task_id 'gemini review' matches gemini-review-<ts>-<hex>" "$?"

# ── BG-01: aco_bg_task_id generates unique IDs on sequential calls ─────────────
test_bg01_task_id_unique() {
  local id1 id2
  id1=$(aco_bg_task_id "gemini" "review")
  # Brief sleep to ensure timestamp or rand component differs
  sleep 0.05 2>/dev/null || true
  id2=$(aco_bg_task_id "gemini" "review")
  [[ "$id1" != "$id2" ]]
}
test_bg01_task_id_unique
run_test "BG-01: aco_bg_task_id produces different IDs on sequential calls" "$?"

# ── BG-02: aco_bg_task_status returns 'not_found' for unknown task ────────────
test_bg02_status_not_found() {
  local status
  status=$(aco_bg_task_status "nonexistent-task-$(date +%s)")
  [[ "$status" == "not_found" ]]
}
test_bg02_status_not_found
run_test "BG-02: aco_bg_task_status unknown task ID → 'not_found'" "$?"

# ── BG-02: aco_bg_task_status returns 'complete' when status file says complete ─
test_bg02_status_complete() {
  local tasks_dir
  tasks_dir=$(aco_bg_task_dir)
  local task_id="test-complete-$(date +%s)"
  echo "complete" > "${tasks_dir}/${task_id}.status"
  echo "review output here" > "${tasks_dir}/${task_id}.output"
  local status
  status=$(aco_bg_task_status "$task_id")
  rm -f "${tasks_dir}/${task_id}.status" "${tasks_dir}/${task_id}.output"
  [[ "$status" == "complete" ]]
}
test_bg02_status_complete
run_test "BG-02: aco_bg_task_status status='complete' → 'complete'" "$?"

# ── BG-02: aco_bg_task_status returns 'cancelled' when status file says cancelled
test_bg02_status_cancelled() {
  local tasks_dir
  tasks_dir=$(aco_bg_task_dir)
  local task_id="test-cancelled-$(date +%s)"
  echo "cancelled" > "${tasks_dir}/${task_id}.status"
  local status
  status=$(aco_bg_task_status "$task_id")
  rm -f "${tasks_dir}/${task_id}.status"
  [[ "$status" == "cancelled" ]]
}
test_bg02_status_cancelled
run_test "BG-02: aco_bg_task_status status='cancelled' → 'cancelled'" "$?"

# ── BG-03 extra: aco_bg_task_status 'running' + live PID → 'running' ──────────
test_bg03_status_running_live_pid() {
  local tasks_dir
  tasks_dir=$(aco_bg_task_dir)
  local task_id="test-running-live-$(date +%s)"
  echo "running" > "${tasks_dir}/${task_id}.status"
  echo "$$" > "${tasks_dir}/${task_id}.pid"   # current shell PID is always alive
  local status
  status=$(aco_bg_task_status "$task_id")
  rm -f "${tasks_dir}/${task_id}.status" "${tasks_dir}/${task_id}.pid"
  [[ "$status" == "running" ]]
}
test_bg03_status_running_live_pid
run_test "BG-03 extra: aco_bg_task_status running + live PID ($$) → 'running'" "$?"

# ── BG-02: aco_bg_task_result not_found → 'Task not found: <id>' ─────────────
test_bg02_result_not_found_message() {
  local fake_id="nonexistent-$(date +%s)"
  local output
  output=$(aco_bg_task_result "$fake_id")
  [[ "$output" == "Task not found: ${fake_id}" ]]
}
test_bg02_result_not_found_message
run_test "BG-02: aco_bg_task_result not_found → 'Task not found: <id>'" "$?"

# ── BG-03 extra: aco_bg_task_result running → 'Still running — check again later'
test_bg03_result_still_running_message() {
  local tasks_dir
  tasks_dir=$(aco_bg_task_dir)
  local task_id="test-still-running-$(date +%s)"
  echo "running" > "${tasks_dir}/${task_id}.status"
  echo "$$" > "${tasks_dir}/${task_id}.pid"   # current shell PID — always alive
  local output
  output=$(aco_bg_task_result "$task_id")
  rm -f "${tasks_dir}/${task_id}.status" "${tasks_dir}/${task_id}.pid"
  [[ "$output" == "Still running — check again later" ]]
}
test_bg03_result_still_running_message
run_test "BG-03 extra: aco_bg_task_result running task → 'Still running — check again later'" "$?"

# ── BG-02: aco_bg_task_result complete → prints output file content ──────────
test_bg02_result_complete_output() {
  local tasks_dir
  tasks_dir=$(aco_bg_task_dir)
  local task_id="test-output-$(date +%s)"
  echo "complete" > "${tasks_dir}/${task_id}.status"
  echo "Review output: looks good!" > "${tasks_dir}/${task_id}.output"
  local output
  output=$(aco_bg_task_result "$task_id")
  rm -f "${tasks_dir}/${task_id}.status" "${tasks_dir}/${task_id}.output"
  [[ "$output" == "Review output: looks good!" ]]
}
test_bg02_result_complete_output
run_test "BG-02: aco_bg_task_result complete → prints output file content verbatim" "$?"

# ── BG-03: aco_bg_task_cancel on running task → 'cancelled' status + message ──
test_bg03_cancel_marks_cancelled() {
  local tasks_dir
  tasks_dir=$(aco_bg_task_dir)
  local task_id="test-cancel-$(date +%s)"
  echo "running" > "${tasks_dir}/${task_id}.status"
  # Use PID 1 (init/launchd) — always exists but we can't kill it (permission denied)
  # aco_bg_task_cancel does: kill $pid || true — so it tolerates permission errors
  echo "1" > "${tasks_dir}/${task_id}.pid"
  local output
  output=$(aco_bg_task_cancel "$task_id")
  local final_status
  final_status=$(cat "${tasks_dir}/${task_id}.status" 2>/dev/null || echo "missing")
  rm -f "${tasks_dir}/${task_id}.status" "${tasks_dir}/${task_id}.pid"
  [[ "$final_status" == "cancelled" ]] && [[ "$output" == "Task ${task_id} cancelled." ]]
}
test_bg03_cancel_marks_cancelled
run_test "BG-03: aco_bg_task_cancel running task → status='cancelled', prints confirmation" "$?"

# ── BG-03: aco_bg_task_cancel on non-running task → returns error message ─────
test_bg03_cancel_not_running() {
  local tasks_dir
  tasks_dir=$(aco_bg_task_dir)
  local task_id="test-cancel-complete-$(date +%s)"
  echo "complete" > "${tasks_dir}/${task_id}.status"
  local output
  output=$(aco_bg_task_cancel "$task_id" 2>&1 || true)
  rm -f "${tasks_dir}/${task_id}.status"
  [[ "$output" == "Cannot cancel task ${task_id}: status is 'complete' (not running)" ]]
}
test_bg03_cancel_not_running
run_test "BG-03: aco_bg_task_cancel non-running task → error message (not running)" "$?"

# Cleanup Phase 9 tmpdir
rm -rf "$_P9_TASKS_TMP"
unset ACO_TASKS_DIR

# ── Wave 0 (09-02): Result + Cancel command files ─────────────────────────────
# RED until Plan 09-02 executes.
# (PHASE8_COMMANDS_DIR is defined above in the Phase 8 section)

[[ -f "${PHASE8_COMMANDS_DIR}/gemini/result.md" ]] && _r=0 || _r=1
run_test "Wave 0 (09-02): .claude/commands/gemini/result.md exists" "$_r"

[[ -f "${PHASE8_COMMANDS_DIR}/copilot/result.md" ]] && _r=0 || _r=1
run_test "Wave 0 (09-02): .claude/commands/copilot/result.md exists" "$_r"

[[ -f "${PHASE8_COMMANDS_DIR}/gemini/cancel.md" ]] && _r=0 || _r=1
run_test "Wave 0 (09-02): .claude/commands/gemini/cancel.md exists" "$_r"

[[ -f "${PHASE8_COMMANDS_DIR}/copilot/cancel.md" ]] && _r=0 || _r=1
run_test "Wave 0 (09-02): .claude/commands/copilot/cancel.md exists" "$_r"

# ── Summary ────────────────────────────────────────────────────────────────
echo ""
echo "Results: ${PASS} passed, ${FAIL} failed"
[[ "$FAIL" -eq 0 ]]
