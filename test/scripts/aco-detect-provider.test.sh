#!/usr/bin/env bash
# test/scripts/aco-detect-provider.test.sh
#
# /aco·$aco entry block의 provider 감지 함수를 독립적으로 검증한다.
# $ARGS에 명시된 알려진 provider 토큰(antigravity|codex|mock)을 단어 경계로
# 감지해 출력한다. 없으면 빈 문자열, 여러 개면 콤마로 join.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DETECT_LIB="$ROOT_DIR/scripts/aco-detect-provider.sh"

# --- helpers ---

pass() { printf '  PASS: %s\n' "$1"; }
fail() { printf '  FAIL: %s\n' "$1" >&2; exit 1; }

assert_eq() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  if [ "$actual" != "$expected" ]; then
    fail "$label — expected '$expected', got '$actual'"
  fi
  pass "$label"
}

# --- detect function sourced from lib ---
# shellcheck source=/dev/null
source "$DETECT_LIB"

echo "=== aco-detect-provider tests ==="

# ── 단일 provider 감지 ─────────────────────────────────────────────

assert_eq "antigravity 명시 → antigravity" \
  "antigravity" \
  "$(aco_detect_provider 'antigravity로 이 PR 리뷰')"

assert_eq "codex 명시(공백 조사) → codex" \
  "codex" \
  "$(aco_detect_provider 'codex 로 비평')"

assert_eq "mock 명시 → mock" \
  "mock" \
  "$(aco_detect_provider 'use mock for this task')"

# ── provider 미명시 → 빈 문자열 ────────────────────────────────────

assert_eq "provider 없음 → 빈값" \
  "" \
  "$(aco_detect_provider '이 모듈 아키텍처 분석해줘')"

assert_eq "빈 입력 → 빈값" \
  "" \
  "$(aco_detect_provider '')"

# ── 복수 provider → 콤마 join ──────────────────────────────────────

assert_eq "antigravity랑 codex 둘 다 → 콤마 join" \
  "antigravity,codex" \
  "$(aco_detect_provider 'antigravity랑 codex로 둘 다 리뷰')"

# ── 부분문자열 오탐 방지 (단어 경계) ───────────────────────────────

assert_eq "antigravityx 는 미매칭" \
  "" \
  "$(aco_detect_provider 'antigravityx 같은 오타는 무시')"

assert_eq "xcodex 는 미매칭" \
  "" \
  "$(aco_detect_provider 'xcodex 도 무시')"

assert_eq "mockup 는 미매칭" \
  "" \
  "$(aco_detect_provider 'mockup 디자인 검토')"

# ── 멀티라인 입력에서도 감지 ───────────────────────────────────────

assert_eq "멀티라인: 둘째 줄의 provider도 감지" \
  "codex" \
  "$(aco_detect_provider $'이 PR 리뷰\ncodex로 부탁')"

# ── entry block 통합: --providers 전달 시뮬레이션 ──────────────────
# .claude/commands/aco.md의 Entry bash 블록을 추출해 실행하되, `aco`를
# 인자를 그대로 echo하는 stub으로 대체해 dry-run 호출 인자를 검증한다.

ENTRY_SRC="$ROOT_DIR/.claude/commands/aco.md"

run_entry() {
  # $1: ARGUMENTS 값. Entry 블록을 실행하고 dry-run 호출 인자를 stdout에 반환.
  local arguments="$1"
  local block
  block="$(awk '/^```bash$/{f=1;next} /^```$/{if(f){exit}} f' "$ENTRY_SRC")"
  ARGUMENTS="$arguments" bash -c '
    aco() { printf "ACO_CALL: %s\n" "$*"; }
    '"$block"'
  '
}

# (1) provider 명시 → dry-run에 --providers 포함
out="$(run_entry 'antigravity로 이 PR 리뷰')"
assert_eq "entry: antigravity 명시 시 dry-run에 --providers antigravity" \
  "ACO_CALL: ask --providers antigravity --task antigravity로 이 PR 리뷰 --dry-run" \
  "$out"

# (2) provider 미명시 → generic dry-run (--providers 없음)
out="$(run_entry '이 모듈 아키텍처 분석해줘')"
assert_eq "entry: provider 미명시 시 generic dry-run" \
  "ACO_CALL: ask --task 이 모듈 아키텍처 분석해줘 --dry-run" \
  "$out"

# (3) 복수 provider → 콤마 join 전달
out="$(run_entry 'antigravity랑 codex로 둘 다')"
assert_eq "entry: 복수 provider 시 콤마 join" \
  "ACO_CALL: ask --providers antigravity,codex --task antigravity랑 codex로 둘 다 --dry-run" \
  "$out"

echo ""
echo "aco-detect-provider tests passed"
