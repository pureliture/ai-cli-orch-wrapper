---
name: aco
description: Codex command-alias skill for Claude /aco parity. Use when invoked with $aco or when an advisory external delegation is needed via aco ask or aco delegate.
---

# aco

Claude `/aco`와 동일한 ACO delegation 흐름을 Codex 세션에서 미러링하는 thin wrapper 스킬이다.
위임 정책의 전체 내용은 `.claude/skills/aco-delegation/SKILL.md`에 있다. 이 스킬은 정책을 중복하지 않는다.

## 두 가지 흐름

### 1. `aco ask` — Consent-Gated 외부 어드바이저리 위임

외부 AI CLI(antigravity, mock)에 리뷰·분석·비교 작업을 위임할 때 사용한다.

**반드시 dry-run 먼저:**

```bash
aco ask --task "<자연어 태스크>" --dry-run
```

dry-run 출력을 사용자에게 보여주고 명시적 동의를 받은 뒤에만 실행한다:

```bash
aco ask --providers antigravity --task "<태스크>" --input "<텍스트>" --yes
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
- 외부 provider나 Claude Code session에 자동으로 전달하지 않는다.
- agent spec이 없으면 에러를 반환한다.

## 호출 예시

```bash
# dry-run 먼저 확인 (항상 이 단계부터)
aco ask --task "auth 모듈 아키텍처 리뷰" --dry-run

# 동의 후 실행
aco ask --providers mock --task "auth 모듈 아키텍처 리뷰" --input "$(cat docs/architecture.md)" --yes

# named agent 프롬프트 빌드 (로컬, 외부 호출 없음)
aco delegate reviewer --input "PR #42 변경 내용 검토"
```

## 참조

- 위임 정책 전문: `.claude/skills/aco-delegation/SKILL.md`
- Claude entrypoint: `.claude/commands/aco.md`
- AGENTS.md `## Codex $aco Entrypoint` 섹션
