#!/usr/bin/env bash
# scripts/aco-detect-provider.sh
#
# /aco·$aco entry block의 provider 감지 라이브러리
#
# 이 파일은 .claude/commands/aco.md 및 templates/commands/aco.md의
# bash entry block과 .codex/skills/aco/SKILL.md의 bash 진입 로직에서
# source하거나 로직을 동일하게 인라인 적용하는 정본이다.
#
# aco_detect_provider <ARGS>
#
#   $ARGS에 명시된 알려진 provider 토큰(antigravity|codex|mock)을
#   단어 경계로 감지해 stdout에 출력한다.
#     - 없으면 빈 문자열
#     - 여러 개면 선언 순서대로 콤마(,)로 join (중복 제거)
#
#   단어 경계: provider 토큰 앞뒤가 문자열 경계이거나 ASCII 영숫자가
#   아닌 문자여야 한다. 따라서 "antigravity로"·"codex 로"는 매칭하지만
#   "antigravityx"·"mockup" 같은 부분문자열은 매칭하지 않는다.
#   (한글 조사는 ASCII 영숫자가 아니므로 경계로 취급된다.)

# 알려진 provider 토큰. 선언 순서가 출력 순서를 결정한다.
ACO_KNOWN_PROVIDERS="antigravity codex mock"

aco_detect_provider() {
  local args="${1:-}"
  local provider matched=""

  for provider in $ACO_KNOWN_PROVIDERS; do
    # 앞: 문자열 시작 또는 ASCII 영숫자 아님 / 뒤: 문자열 끝 또는 ASCII 영숫자 아님
    if [[ "$args" =~ (^|[^A-Za-z0-9])"$provider"([^A-Za-z0-9]|$) ]]; then
      if [ -z "$matched" ]; then
        matched="$provider"
      else
        matched="$matched,$provider"
      fi
    fi
  done

  printf '%s' "$matched"
}
