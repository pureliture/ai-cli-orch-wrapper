#!/usr/bin/env bash
# scripts/aco-guardrail.sh
#
# /aco·$aco 금지 subcommand 가드레일 라이브러리
#
# 이 파일은 .claude/commands/aco.md 및 templates/commands/aco.md의
# bash entry block과 .codex/skills/aco/SKILL.md의 bash 진입 로직에서
# source하거나 로직을 동일하게 인라인 적용하는 정본이다.
#
# aco_check_forbidden_subcommand <ARGS>
#
#   첫 토큰이 status|result|cancel|delegate이면:
#     - 해당 하부 CLI 사용 안내를 출력한다
#     - exit 1 (위임 차단)
#   그 외이면:
#     - 아무 것도 출력하지 않고 exit 0 (위임 허용)

aco_check_forbidden_subcommand() {
  local args="${1:-}"
  # 첫 토큰 추출: 공백으로 분리된 첫 번째 단어
  local first_token
  first_token=$(echo "$args" | awk '{print $1}')

  case "$first_token" in
    status|result|cancel|delegate)
      cat <<EOF
/aco 는 자연어 위임 진입점입니다. '$first_token' 는 자연어 task가 아닌 하부 CLI subcommand입니다.

세션 운영 명령은 하부 CLI를 직접 사용하세요:
  aco $first_token [옵션]

예시:
  aco status              — 진행 중인 세션 목록 조회
  aco result --session ID — 세션 결과 조회
  aco cancel --session ID — 세션 취소
  aco delegate <agent-id> --input "..." — 로컬 named-agent 프롬프트 빌드

외부 AI 위임이 필요하면 자연어로 입력하세요:
  /aco 이 PR을 리뷰해줘
  /aco antigravity로 아키텍처 분석해줘
EOF
      return 1
      ;;
  esac
  return 0
}
