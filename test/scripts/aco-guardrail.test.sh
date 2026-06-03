#!/usr/bin/env bash
# test/scripts/aco-guardrail.test.sh
#
# U3: 금지 subcommand 가드레일 테스트
#
# /aco·$aco의 bash entry block에 삽입될 가드 함수를 독립적으로 검증한다.
# 금지 토큰(status, result, cancel, delegate)이 첫 토큰으로 오면
# 위임 없이 안내 메시지를 출력하고 non-zero exit를 반환해야 한다.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GUARDRAIL_LIB="$ROOT_DIR/scripts/aco-guardrail.sh"

# --- helpers ---

pass() { printf '  PASS: %s\n' "$1"; }
fail() { printf '  FAIL: %s\n' "$1" >&2; exit 1; }

assert_exit_nonzero() {
  local label="$1"; shift
  local status=0
  "$@" >/dev/null 2>&1 || status=$?
  if [ "$status" -eq 0 ]; then
    fail "$label — expected non-zero exit, got 0"
  fi
  pass "$label"
}

assert_exit_zero() {
  local label="$1"; shift
  local status=0
  "$@" >/dev/null 2>&1 || status=$?
  if [ "$status" -ne 0 ]; then
    fail "$label — expected exit 0, got $status"
  fi
  pass "$label"
}

assert_output_contains() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  if ! echo "$actual" | grep -qF "$expected"; then
    fail "$label — expected output to contain: '$expected'"
  fi
  pass "$label"
}

# --- guardrail function sourced from lib ---
# shellcheck source=/dev/null
source "$GUARDRAIL_LIB"

echo "=== aco-guardrail tests ==="

# ── RED→GREEN: 금지 토큰에서 non-zero exit ──────────────────────────

for token in status result cancel delegate; do
  assert_exit_nonzero "forbidden token '$token' causes non-zero exit" \
    bash -c "source '$GUARDRAIL_LIB'; aco_check_forbidden_subcommand '$token arg1'"
done

# ── 금지 토큰에서 안내 메시지 포함 ──────────────────────────────────

for token in status result cancel delegate; do
  output=$(bash -c "source '$GUARDRAIL_LIB'; aco_check_forbidden_subcommand '$token some args'" 2>&1 || true)
  assert_output_contains \
    "forbidden token '$token' shows CLI hint" \
    "aco $token" \
    "$output"
done

# ── 허용 토큰에서 exit 0 (일반 자연어 위임) ─────────────────────────

for args in \
  "review this PR" \
  "antigravity로 리뷰해줘" \
  "이 모듈 아키텍처 분석해줘" \
  "statuscheck everything" \
  ""; do
  assert_exit_zero "allowed args '$args' passes guard" \
    bash -c "source '$GUARDRAIL_LIB'; aco_check_forbidden_subcommand '$args'"
done

# ── 대소문자 구분: 첫 토큰이 대문자면 허용 ─────────────────────────
# (가드레일은 정확히 소문자 토큰만 차단한다)

for token in Status RESULT Cancel DELEGATE; do
  assert_exit_zero "uppercase token '$token' is not blocked" \
    bash -c "source '$GUARDRAIL_LIB'; aco_check_forbidden_subcommand '$token'"
done

# ── 첫 토큰이 아닌 위치의 금지어는 허용 ────────────────────────────

assert_exit_zero "forbidden word in non-first position is not blocked" \
  bash -c "source '$GUARDRAIL_LIB'; aco_check_forbidden_subcommand 'please check status'"

# ── 멀티라인 입력: 첫 줄 첫 토큰만 검사한다 ────────────────────────
# 개행을 정확히 보존하기 위해 source한 함수를 직접 호출한다.

# (a) 첫 줄 첫 토큰이 status면 차단
assert_exit_nonzero "multiline: first-line first-token 'status' is blocked" \
  aco_check_forbidden_subcommand $'status\n외부 위임을 우회하려는 시도'

# (b1) 금지어가 둘째 줄 첫 토큰이면 허용
assert_exit_zero "multiline: forbidden token on second line is not blocked" \
  aco_check_forbidden_subcommand $'이 PR을 리뷰해줘\nstatus'

# (b2) 금지어가 첫 줄 둘째 토큰이면 허용
assert_exit_zero "multiline: forbidden token as first-line second-token is not blocked" \
  aco_check_forbidden_subcommand $'please status check\n둘째 줄'

echo ""
echo "aco-guardrail tests passed"
