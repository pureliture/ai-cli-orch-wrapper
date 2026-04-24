# 커밋 메시지 작성 프롬프트

너는 이 저장소의 커밋 메시지를 작성한다. 커밋 메시지는 반드시 이 문서와 루트의 `.gitmessage` 템플릿을 따른다.

## 필수 규칙

- 커밋 메시지는 한국어로 작성한다. 단, conventional commit 타입, scope, 파일 경로, 명령어, 코드 식별자, 에러 문자열은 원문을 유지한다.
- 커밋 메시지는 반드시 제목과 본문을 모두 포함한다.
- 제목은 `type(scope): summary` 형식의 conventional commit 스타일을 사용한다.
- 본문은 왜 변경했는지, 무엇을 바꿨는지, 영향 범위가 무엇인지 설명한다.
- 본문에는 필요하면 `Affected:` 블록을 포함해 파일이나 영역을 나열한다.
- 제목만 있는 커밋 메시지를 만들지 않는다.
- 불필요한 마케팅 문구, 도구 실행 로그 전체, 검증하지 않은 테스트 결과를 넣지 않는다.
- 커밋 작성에 사용된 AI CLI와 모델은 GitHub `Contributors`에 표시될 수 있도록 커밋 메시지 끝에 contributor trailer로 반드시 포함한다.
- GitHub가 인식 가능한 CLI 또는 모델 identity가 있으면 `Co-authored-by:` trailer를 사용한다.
- GitHub가 인식 가능한 identity가 없거나 확실하지 않아도 `AI-CLI:`와 `AI-Model:` trailer를 반드시 추가한다.

## 작성 절차

1. staged diff 또는 사용자가 지정한 변경 범위를 기준으로 변경의 핵심 목적을 파악한다.
2. 제목은 한 줄로 작성하고, 구현 세부보다 사용자/운영 관점의 변화가 드러나게 한다.
3. 본문 첫 단락에는 변경 이유와 문제 맥락을 적는다.
4. 본문 다음 단락에는 해결 방식을 적는다.
5. 영향 파일이나 영역이 여러 개면 `Affected:` 블록을 추가한다.
6. 마지막에는 사용한 AI CLI와 모델을 contributor trailer로 추가한다.

## 형식 예시

```text
fix(tests): replace echo|grep-q with herestrings in 6 assert_contains helpers (macOS SIGPIPE)

On macOS bash 3.2 with set -o pipefail, `echo "$large_var" | grep -qE "pattern"`
returns non-zero when grep exits early (match found), causing SIGPIPE on echo.
This makes assert_contains report false failures for large outputs like
$SKILL_CONTENT or $ALL_SRC.

Fix: `grep -qE "$pattern" <<< "$output"` -- no pipe, no SIGPIPE.

Affected: test-coverage-audit.sh, test-review-run.sh, test-agent-ergonomics.sh,
test-design-lineage.sh, test-copilot-provider.sh, test-probe-single.sh

Co-authored-by: Codex CLI <codex-cli@example.invalid>
Co-authored-by: GPT-5 <gpt-5@example.invalid>
AI-CLI: Codex CLI
AI-Model: GPT-5
```

위 예시는 제목과 본문 구조를 보여주기 위한 예시다. 실제 커밋에서는 `example.invalid` 대신 GitHub가 인식 가능한 identity가 있으면 그 값을 사용한다.
