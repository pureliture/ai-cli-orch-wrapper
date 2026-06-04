Receive a natural language task, determine the best provider and scope, present
an execution plan, and — after explicit consent — invoke `aco ask --yes` to run
the provider and return a brief summary.

---

## Flow

1. **Read context.** Parse `$ARGUMENTS` and read relevant project files (diff,
   architecture docs, etc.) to understand what needs to be done.
2. **Determine provider and task.** If the user names a provider (e.g.
   "antigravity로 리뷰해줘", "use mock"), use it directly. Otherwise choose the
   most appropriate available provider based on context.
3. **Check provider readiness.** If the chosen provider is not authenticated or
   not installed, stop and print setup guidance (see **Unauthenticated provider**
   below). Do not fall back silently to another provider.
4. **Present execution plan.** Run `aco ask --dry-run` and show the proposed
   provider, task, input scope, and permission profile. Wait for explicit user
   approval before proceeding.
5. **Execute on consent.** Only after the user confirms, run:

   ```bash
   aco ask --providers <provider> --task "<task>" --input "<input>" --yes --runtime-banner --host claude
   ```

6. **Surface the runtime banner.** aco prints a runtime rollup dashboard
   (`🟠  aco Runtime Session`, provider rows with session id and auth) to stdout
   because the live frame can never reach a TTY when aco runs as a non-TTY
   subprocess. Show that block to the user as the activation banner — render it
   verbatim or reformat it into the colored provider dots — before the summary.
   See **Runtime banner** below.
7. **Return brief.** Synthesize the provider output into a concise summary.
   Full output is saved as a session artifact; use `aco result --session <id>`
   to retrieve it later.

---

## Entry

```bash
ARGS="${ARGUMENTS:-}"
if [ -z "$ARGS" ]; then
  echo 'Usage: /aco "natural language task — optionally name a provider, e.g. antigravity로 리뷰해줘"'
  exit 1
fi

# ── 금지 subcommand 가드레일 ──────────────────────────────────────────
# 첫 줄의 첫 토큰이 status|result|cancel|delegate이면 위임하지 않고 하부 CLI 안내.
# 멀티라인 입력에서 둘째 줄 이후나 첫 줄 둘째 토큰으로 우회/오발동시키지 않는다.
IFS=$' \t' read -r _ACO_FIRST_TOKEN _ <<<"$ARGS"
case "$_ACO_FIRST_TOKEN" in
  status|result|cancel|delegate)
    cat <<GUARDRAIL_MSG
/aco 는 자연어 위임 진입점입니다. '$_ACO_FIRST_TOKEN' 는 자연어 task가 아닌 하부 CLI subcommand입니다.

세션 운영 명령은 하부 CLI를 직접 사용하세요:
  aco $_ACO_FIRST_TOKEN [옵션]

예시:
  aco status              — 진행 중인 세션 목록 조회
  aco result --session ID — 세션 결과 조회
  aco cancel --session ID — 세션 취소
  aco delegate <agent-id> --input "..." — 로컬 named-agent 프롬프트 빌드

외부 AI 위임이 필요하면 자연어로 입력하세요:
  /aco 이 PR을 리뷰해줘
  /aco antigravity로 아키텍처 분석해줘
GUARDRAIL_MSG
    exit 0
    ;;
esac
# ─────────────────────────────────────────────────────────────────────

# ── provider 감지 ─────────────────────────────────────────────────────
# $ARGS에 알려진 provider(antigravity|codex|mock)가 단어 경계로 명시되면
# 감지해 dry-run에 --providers로 전달한다. 없으면 generic dry-run을 유지하고
# 모델이 컨텍스트로 provider를 결정한다.
# 단어 경계 매칭: 앞뒤가 문자열 경계이거나 ASCII 영숫자가 아닌 문자여야 한다.
# "antigravity로"·"codex 로"는 매칭하지만 "antigravityx"·"mockup"은 무시한다.
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
# ─────────────────────────────────────────────────────────────────────
```

After the dry-run, Claude presents the plan and waits for approval. If a
provider was detected in `$ARGS`, the dry-run pins it via `--providers`; on
consent, Claude reuses that same provider for the live call. On consent, Claude
calls `aco ask --providers <provider> --task "<task>" --input "<input>" --yes --runtime-banner --host claude`,
surfaces the runtime banner from stdout, and returns a brief summary to the user.

---

## Provider named in prompt

If `$ARGUMENTS` contains an explicit provider name (e.g. "antigravity", "mock"),
extract it and pass it as `--providers <provider>` to both the dry-run and the
live call. Do not override a user-specified provider.

---

## Unauthenticated provider

If `aco doctor` or the dry-run output reports that the chosen provider is not
ready, stop immediately and print:

```
Provider <name> is not authenticated or not installed.
Run /antigravity:setup (for Antigravity) or follow the provider setup guide,
then retry /aco.
```

Do not silently fall back to another provider. Do not run the live call.

---

## Runtime banner

The live, color runtime dashboard (`renderRuntimeRollupDashboard`) only paints
to stderr when stderr is an interactive TTY. When Claude runs `aco` through a
tool call, that subprocess is non-TTY, so the live frame is suppressed by design
and never reaches the user. The `--runtime-banner` flag makes aco emit the same
rollup — host header plus one row per provider (icon, session id, auth) — as an
ANSI-free block on stdout instead, so Claude captures it and shows it to the user.

- Always pass `--runtime-banner` on the live `aco ask --yes` call.
- The banner is the activation indicator; surface it to the user (verbatim or as
  colored provider dots: 🔵 antigravity · 🟢 codex · ⚪ mock · 🟠 claude host)
  before the advisory summary.
- This is a display surface only. It does not change consent, permission, or
  provider behavior, and no Claude Code hook is involved.

## Output mode

Default output mode is `brief`. Full provider output is saved to session
artifacts automatically. Use `--output-mode full` only when the user
explicitly requests it.

---

## aco delegate (named-agent prompt builder)

For directing a task to a specific local agent spec — no external call:

```bash
aco delegate <agent-id> --input "<task and context>"
```

This reads `.claude/agents/<agent-id>.md`, combines the seed prompt with the
supplied input, and prints the result to stdout. No provider is invoked.

---

## Failure and concurrency policy

### 자연어 의도 해석 실패

`/aco`가 작업이나 provider를 결정하지 못하면 외부 위임을 실행하지 않고 사용자에게 명확화(clarification)를 요청한다. 예시:

```
작업 내용이나 대상 provider를 결정하지 못했습니다. 다음처럼 명시해 주세요:
  /aco antigravity로 PR #42 리뷰해줘
  /aco mock으로 auth 모듈 보안 검토해줘
```

### 실행 중 취소

위임 실행 중 사용자가 취소(Ctrl+C / SIGINT)하면 진행 중인 provider 프로세스를 SIGTERM으로 안전하게 종료하고 (grace period 후 SIGKILL fallback), 세션을 `cancelled` 상태로 기록한다.

### 중복 동시 호출

Claude Code 세션은 sequential 실행 모델이므로 동시 `/aco` 호출은 일어나지 않는다. 단, `aco ask --yes`를 직접 병렬 실행하는 경우 각 실행은 독립 session ID를 가지며 서로 간섭하지 않는다. 동시 실행은 지원하되, 결과를 합산할 UI 레이어가 없으면 권장하지 않는다.

---

## Constraints

- Never invoke a provider without dry-run review and explicit user consent.
- Never create task-specific subcommands or slash commands. Use natural language
  tasks or `.claude/aco/tasks/<preset>.md` presets.
- Do not send secrets, credentials, or unrelated files to providers.
- External provider output is advisory. Claude Code is the final synthesizer.
