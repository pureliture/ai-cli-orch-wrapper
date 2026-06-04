---
name: aco
description: Codex command-alias skill for Claude /aco parity. Use when invoked with $aco or when an advisory external delegation is needed via aco ask or aco delegate.
---

# aco

Claude `/aco`와 동일한 ACO delegation 흐름을 Codex 세션에서 미러링하는 thin wrapper 스킬이다.
위임 정책의 전체 내용은 `.claude/skills/aco-delegation/SKILL.md`에 있다. 이 스킬은 정책을 중복하지 않는다.

## 금지 subcommand 가드레일

`$aco`에 전달된 첫 줄의 첫 토큰이 `status`·`result`·`cancel`·`delegate`이면 자연어 위임으로 처리하지 않고 하부 CLI 사용을 안내한다.

```bash
# 첫 줄의 첫 토큰만 검사한다. 멀티라인 입력에서 둘째 줄 이후나
# 첫 줄 둘째 토큰으로 가드를 우회/오발동시키지 않는다.
IFS=$' \t' read -r _ACO_FIRST_TOKEN _ <<<"$ARGS"
case "$_ACO_FIRST_TOKEN" in
  status|result|cancel|delegate)
    # 위임 차단 — 하부 CLI 안내 출력 후 종료
    printf '%s\n' "/$_ACO_FIRST_TOKEN 는 하부 CLI subcommand입니다. 'aco $_ACO_FIRST_TOKEN [옵션]'을 직접 사용하세요."
    exit 0
    ;;
esac
```

이 검사는 반드시 위임 실행 전에 수행해야 한다.

## provider 감지

`$ARGS`에 알려진 provider(`antigravity`·`codex`·`mock`)가 단어 경계로 명시되면 감지해 dry-run에 `--providers`로 전달한다. 그래야 dry-run이 보여주는 계획과 실제 실행 provider가 일치한다. 없으면 generic dry-run을 유지하고 모델이 컨텍스트로 provider를 결정한다.

단어 경계 매칭: provider 토큰 앞뒤가 문자열 경계이거나 ASCII 영숫자가 아닌 문자여야 한다. `antigravity로`·`codex 로`는 매칭하지만 `antigravityx`·`mockup` 같은 부분문자열은 무시한다.

```bash
_ACO_DETECTED=""
for _provider in antigravity codex mock; do
  if [[ "$ARGS" =~ (^|[^A-Za-z0-9])"$_provider"([^A-Za-z0-9]|$) ]]; then
    if [ -z "$_ACO_DETECTED" ]; then
      _ACO_DETECTED="$_provider"
    else
      _ACO_DETECTED="$_ACO_DETECTED,$_provider"
    fi
  fi
done

if [ -n "$_ACO_DETECTED" ]; then
  aco ask --providers "$_ACO_DETECTED" --task "$ARGS" --dry-run
else
  aco ask --task "$ARGS" --dry-run
fi
```

dry-run에서 provider가 고정되었으면 동의 후 실행도 같은 provider로 수행한다.

## 흐름 (model A)

1. **컨텍스트 파악.** 인자를 파싱하고 관련 프로젝트 파일(diff, architecture docs 등)을 읽어 작업 범위를 결정한다.
2. **provider 및 작업 결정.** 사용자가 provider를 명시하면(예: "antigravity로 리뷰", "use mock") 그대로 사용한다. 명시하지 않으면 컨텍스트를 기반으로 적합한 provider를 선택한다.
3. **provider 준비 상태 확인.** 선택한 provider가 미인증이거나 미설치 상태이면 즉시 멈추고 setup 안내를 출력한다. 다른 provider로 자동 대체하지 않는다.
4. **실행 계획 제시.** `aco ask --dry-run`을 실행해 제안 provider, 작업, 입력 범위, permission profile을 사용자에게 보여준다. 명시적 동의를 기다린다.
5. **동의 후 실행.** 사용자가 확인하면:

   ```bash
   aco ask --providers <provider> --task "<태스크>" --input "<입력>" --yes --runtime-banner
   ```

6. **런타임 배너 surface.** aco가 stdout에 출력한 런타임 롤업 대시보드(`aco Runtime Session`, provider별 session·auth 행)를 사용자에게 activation 배너로 보여준다. aco를 비-TTY 서브프로세스로 실행하면 live 프레임은 억제되므로 `--runtime-banner`가 그 정보를 stdout으로 내보낸다. 아래 **런타임 배너** 참조.
7. **brief 반환.** provider 출력을 요약한 brief를 반환한다. 전체 출력은 세션 아티팩트로 저장되며 `aco result --session <id>`로 조회한다.

## 런타임 배너

live color 런타임 대시보드(`renderRuntimeRollupDashboard`)는 stderr가 인터랙티브 TTY일 때만 그려진다. Codex가 `aco`를 도구 호출로 실행하면 그 서브프로세스는 비-TTY라 live 프레임이 설계상 억제되어 사용자에게 닿지 않는다. `--runtime-banner` 플래그는 동일한 롤업(host 헤더 + provider별 icon·session·auth 행)을 ANSI-free 블록으로 stdout에 emit해, Codex가 캡처해 사용자에게 보여줄 수 있게 한다.

- live `aco ask --yes` 호출에는 항상 `--runtime-banner`를 붙인다.
- 배너는 activation indicator이며, advisory 요약 전에 사용자에게 surface한다(원문 그대로 또는 색점으로: 🔵 antigravity · 🟢 codex · ⚪ mock · 🟠 host).
- 표시 표면일 뿐이다. consent·permission·provider 동작을 바꾸지 않으며 hook을 도입하지 않는다.

## provider가 명시된 경우

인자에 provider 이름(예: "antigravity", "mock")이 포함되면 해당 provider를 `--providers <provider>`로 dry-run과 실행 양쪽에 고정한다. 사용자 지정 provider는 재정의하지 않는다.

## 미인증 provider

`aco doctor` 또는 dry-run 출력이 provider 미준비를 보고하면 즉시 멈추고 아래를 출력한다:

```
Provider <name>이 인증되지 않았거나 설치되지 않았습니다.
Antigravity는 /antigravity:setup을, 다른 provider는 해당 setup 가이드를 따르고 다시 시도하세요.
```

다른 provider로 자동 대체하지 않는다. 실행 명령을 내리지 않는다.

## 두 가지 하위 플로우

### 1. `aco ask` — Consent-Gated 외부 어드바이저리 위임

```bash
# 반드시 dry-run 먼저
aco ask --task "<자연어 태스크>" --dry-run

# 동의 후 실행 (런타임 배너를 stdout으로 받아 surface)
aco ask --providers antigravity --task "<태스크>" --input "<텍스트>" --yes --runtime-banner
```

규칙 요약:

- 사용자 동의(`--yes`) 없이 외부 provider를 자동 호출하지 않는다.
- peers: `antigravity`, `mock`. 기본 permission profile은 `restricted`.
- 기본 출력 모드는 `brief`. 전체 출력은 session artifact에 저장되며 `aco result --session <id>`로 조회한다.
- `--output-mode full`은 사용자가 명시적으로 요청한 경우에만 사용한다.
- 외부 provider 출력은 어드바이저리이며, Codex가 최종 판단을 내린다.
- secret, credential, 관련 없는 파일을 전송하지 않는다.

### 2. `aco delegate` — 로컬 Named-Agent 프롬프트 빌더

`.claude/agents/<agent-id>.md`에 정의된 named agent spec을 기반으로 프롬프트를 조합해 stdout에 출력한다.
**외부 호출 없음.** 자동 Agent tool intercept 없음. 반드시 명시적으로 호출해야 한다.

```bash
aco delegate <agent-id> --input "<태스크 및 컨텍스트>"
```

- agent spec 파일을 읽고 seed prompt와 `--input`을 결합해 출력만 한다.
- 외부 provider나 Codex session에 자동으로 전달하지 않는다.
- agent spec이 없으면 에러를 반환한다.

## 호출 예시

```bash
# dry-run 먼저 확인 (항상 이 단계부터)
aco ask --task "auth 모듈 아키텍처 리뷰" --dry-run

# 동의 후 실행
aco ask --providers mock --task "auth 모듈 아키텍처 리뷰" --input "$(cat docs/architecture.md)" --yes --runtime-banner

# named agent 프롬프트 빌드 (로컬, 외부 호출 없음 — <agent-id>는 프로젝트의 .claude/agents/<id>.md)
aco delegate <agent-id> --input "PR #42 변경 내용 검토"
```

## 금지 사항

- provider 없이 또는 동의 없이 외부 호출을 하지 않는다.
- task-specific subcommand나 slash command를 만들지 않는다. 자연어 태스크 또는 `.claude/aco/tasks/<preset>.md` 프리셋을 사용한다.

## 참조

- 위임 정책 전문: `.claude/skills/aco-delegation/SKILL.md`
- Claude entrypoint: `.claude/commands/aco.md`
- AGENTS.md `## Codex $aco Entrypoint` 섹션
