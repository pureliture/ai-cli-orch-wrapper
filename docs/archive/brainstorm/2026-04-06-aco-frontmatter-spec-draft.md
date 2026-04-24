# ACO Frontmatter Spec 초안

**상태**: draft  
**작성일**: 2026-04-06

---

## 목적

이 문서는 Claude Code sub-agent frontmatter를 그대로 복제하는 대신, ACO 아키텍처에 맞는 **ACO 전용 frontmatter spec** 초안을 정의한다.

핵심 원칙:

- canonical agent spec은 `.claude/agents/*.md`에 둔다.
- 이 파일은 Claude Code의 sub-agent 후보 정의이면서, 동시에 ACO delegation target spec이기도 하다.
- 실제 `provider + model + launchArgs` 해석은 별도 formatter 파일의 **변환 규칙**이 담당한다.
- ACO는 host runtime이 아니라 typed delegation endpoint이므로, host-runtime 전용 개념은 약한 의미로만 재해석하거나 배제한다.

---

## 설계 원칙

### 1. `.claude/agents/*.md`를 canonical shared spec으로 사용한다

- agent spec의 canonical location은 `.claude/agents/*.md`다.
- ACO는 별도 agent registry를 갖기보다 `.claude/agents/*.md`를 직접 읽어 해석한다.
- 같은 spec을 Claude와 ACO가 공유하므로 role 정의가 분산되지 않는다.

### 2. Sub-agent spawn은 선택 사항이고, 실행은 ACO delegation으로 치환할 수 있다

- 어떤 agent를 사용할지 판단하는 것은 상위 orchestrator의 책임이다.
- 하지만 실제 실행 시에는 sub-agent를 spawn하지 않고, 해당 agent spec을 읽어 `aco delegate <agent-id>`로 치환할 수 있다.
- 이 방식은 Claude sub-agent 실행을 한 번 더 경유하지 않으므로 토큰 사용량과 실행 경로를 줄인다.

### 3. Agent 정의와 vendor-specific routing 규칙을 분리한다

- agent 파일은 role identity와 execution intent를 담는다.
- 실제 어떤 CLI와 어떤 모델로 실행할지는 formatter 파일의 규칙이 결정한다.
- provider/vendor churn은 formatter 설정 변경만으로 흡수한다.

### 4. Claude 필드명 호환보다 의미 명확성을 우선한다

- 같은 이름이지만 다른 의미를 갖는 필드는 피한다.
- ACO에서 의미가 약화되는 필드는 전용 이름으로 바꾼다.

### 5. Prompt-level reference와 runtime capability를 구분한다

- `skillRefs`, `memoryRefs`, `mcpPolicy`는 runtime capability를 생성하지 않는다.
- 이 필드들은 prompt assembly나 execution contract 상의 선언적 힌트다.

### 6. `background`는 지원하지 않는다

- ACO는 blocking single-task를 유지한다.
- scheduler 역할은 상위 orchestrator가 담당한다.

### 7. `memoryRefs`는 read-only reference only다

- memory 경로는 참고용이다.
- provider에게 해당 경로를 수정, append, 저장소처럼 사용하라고 지시하지 않는다.

---

## 실행 모델

이 spec이 전제하는 실행 경로는 다음과 같다.

```text
사용자 의도
  -> Claude가 .claude/agents/*.md에서 candidate agent 선택
  -> 해당 sub-agent를 spawn하는 대신 Claude 또는 wrapper policy가 다음을 호출:
     aco delegate <agent-id> --input "..."
  -> ACO가 같은 agent spec을 읽음
  -> ACO가 formatter rule로 provider/model 해석
  -> ACO가 external CLI 호출
  -> 결과가 호출자에게 반환
```

이 모델에서 중요한 점:

- sub-agent spec은 재사용한다
- 실제 실행은 ACO가 담당한다
- Claude sub-agent를 한 번 더 띄우는 이중 경유는 피한다

---

## Agent 파일 형식

에이전트 파일은 Markdown body 앞에 YAML frontmatter를 둔다.

예시:

```md
---
id: researcher
when: Long-context 조사, 비교, 문헌/문서 기반 분석이 필요할 때 사용
modelAlias: sonnet-4.6
roleHint: research
permissionProfile: restricted
turnLimit: 12
executionMode: blocking
workspaceMode: read-only
isolationMode: none
mcpPolicy:
  mode: inherit
  expected:
    - github
    - playwright
skillRefs:
  - .claude/skills/research-methods
  - .claude/skills/writing-style
memoryRefs:
  - .claude/agent-memory/research-notes
promptSeedFile: .aco/prompts/researcher.md
reasoningEffort: high
uiColor: cyan
---
이 에이전트는 broad research와 synthesis를 담당한다.
skillRefs와 memoryRefs는 참고 대상으로만 취급한다.
memoryRefs 경로의 내용을 수정하거나 저장소처럼 사용하지 않는다.
```

---

## 지원되는 ACO 필드

### `id`

- 타입: string
- 필수: 예
- 의미: agent 식별자
- 제약: 소문자, 숫자, 하이픈 권장

### `when`

- 타입: string
- 필수: 예
- 의미: 언제 이 agent를 써야 하는지 설명하는 delegation hint

### `modelAlias`

- 타입: string
- 필수: 아니오
- 의미: Claude식 단일 모델명 또는 ACO 추상 모델 별칭
- 역할: formatter 파일의 `modelAliasMap` 규칙을 통해 실제 `provider + model`로 변환
- 예: `sonnet-4.6 -> codex + gpt-5.4`

### `roleHint`

- 타입: string
- 필수: 아니오
- 의미: formatter가 provider/model 선택 시 참고하는 역할 힌트
- 예: `research`, `execute`, `review`

### `permissionProfile`

- 타입: enum
- 필수: 아니오
- 값: `default | restricted | unrestricted`
- 의미: ACO 권한 프로파일
- 비고: OS-level sandbox를 보장하는 강한 의미의 permission model은 아님

### `turnLimit`

- 타입: integer
- 필수: 아니오
- 제약: 1 이상
- 의미: ACO 실행 단위에서 허용하는 최대 turn 또는 iteration 수

### `executionMode`

- 타입: enum
- 필수: 아니오
- 값: `blocking`
- 기본값: `blocking`
- 의미: ACO 실행 모델 선언
- 비고: `background`는 지원하지 않음

### `workspaceMode`

- 타입: enum
- 필수: 아니오
- 값: `read-only | edit`
- 기본값: `read-only`
- 의미: 실제 tool allowlist가 아니라 작업 의도 선언

### `isolationMode`

- 타입: enum
- 필수: 아니오
- 값: `none | worktree`
- 기본값: `none`
- 의미: 실행 시 workspace isolation 전략

### `mcpPolicy`

- 타입: object
- 필수: 아니오
- 의미: MCP availability에 대한 선언적 힌트

예시:

```yaml
mcpPolicy:
  mode: inherit
  expected:
    - github
    - playwright
```

세부 규칙:

- `mode`는 현재 `inherit`만 지원
- `expected`는 이 agent가 전제로 삼는 MCP 이름 목록
- ACO는 MCP server를 attach/provision하지 않는다
- host runtime이나 provider CLI에 이미 붙어 있는 MCP만 사용할 수 있다

### `skillRefs`

- 타입: string[]
- 필수: 아니오
- 의미: 참고할 skill 또는 instruction 경로 목록
- 비고: skill content를 자동 주입하지 않음

### `memoryRefs`

- 타입: string[]
- 필수: 아니오
- 의미: 참고 가능한 memory path 목록
- 비고: **read-only reference only**

규칙:

- ACO는 prompt에 이 경로를 참고하라고 명시할 수 있다
- ACO는 provider에게 해당 경로를 수정, append, 요약 저장, 메모 저장소로 사용하라고 지시하지 않는다

### `promptSeedFile`

- 타입: string
- 필수: 아니오
- 의미: role constitution 또는 seed prompt 파일 경로
- 비고: frontmatter body와 함께 prompt assembly에 사용 가능

### `reasoningEffort`

- 타입: enum
- 필수: 아니오
- 값: `low | medium | high | max`
- 의미: 추론 강도 힌트
- 비고: 실제 provider 전달값은 formatter의 effort mapping에 따라 달라질 수 있음

### `uiColor`

-- 타입: enum 또는 string
- 필수: 아니오
- 의미: UI 표시용 metadata

---

## 명시적으로 지원하지 않는 필드

다음 개념은 ACO에서 동일 의미로 지원하지 않는다:

- `background`
- `tools`
- `disallowedTools`
- `hooks`

배제 이유:

- `background`: ACO가 아니라 상위 orchestrator의 scheduler 책임
- `tools`, `disallowedTools`: Claude runtime의 capability graph를 ACO가 직접 제어하지 않음
- `hooks`: Claude lifecycle hook과 ACO process lifecycle은 동일하지 않음

---

## Formatter 파일

실제 routing 해석은 별도 formatter 파일이 담당한다.

권장 경로:

```text
.aco/formatter.yaml
```

예시:

```yaml
version: 1

providerDefaults:
  codex:
    launchArgs: []
  gemini_cli:
    launchArgs: []

modelAliasMap:
  sonnet:
    provider: codex
    model: gpt-5.4
  sonnet-4.6:
    provider: codex
    model: gpt-5.4
  opus:
    provider: gemini_cli
    model: gemini-2.5-pro
  haiku:
    provider: gemini_cli
    model: gemini-2.5-flash

effortMap:
  codex:
    low: low
    medium: medium
    high: high
    max: xhigh
  gemini_cli:
    low: low
    medium: medium
    high: high
    max: high

roleHintRules:
  research:
    preferredProvider: gemini_cli
  execute:
    preferredProvider: codex
  review:
    preferredProvider: codex

fallback:
  provider: codex
  model: gpt-5.4
```

이 파일은 agent 목록을 나열하지 않는다.  
이 파일은 **변환 규칙만** 가진다.

---

## Formatter 책임

formatter 파일은 다음 책임을 가진다:

- Claude식 단일 모델명을 ACO의 `CLI + model` 조합으로 매핑
- `roleHint`를 provider 선택 보정 힌트로 사용
- provider별 기본 `launchArgs` 제공
- `reasoningEffort`를 provider별 값으로 변환
- 최종 해석 불가 시 fallback 제공

즉, agent 파일은 vendor-neutral을 유지하고, formatter는 agent별 프로필 레지스트리가 아니라 vendor-specific 변환 규칙 모음이 된다.

---

## Model Mapping 규칙

ACO에서 Claude의 단일 모델명은 직접 실행값이 아니라 **abstract model alias**로 취급한다.

예:

```yaml
modelAliasMap:
  sonnet-4.6:
    provider: codex
    model: gpt-5.4
```

이 규칙에 따라:

- Claude 쪽 단일 모델명 하나가
- ACO에서는 `provider + model`의 2단 구조로 해석된다

필요하면 `roleHint`를 이용해 선택을 보정할 수 있다:

```yaml
modelAliasMap:
  sonnet-4.6:
    provider: codex
    model: gpt-5.4

roleHintRules:
  research:
    preferredProvider: gemini_cli
```

이 구조를 통해 기본 alias 매핑은 유지하면서, 역할에 따라 provider 선택을 보정할 수 있다.

---

## 해석 순서

실행 시 routing 해석 우선순위:

1. agent file의 `modelAlias`
2. formatter의 `modelAliasMap`
3. agent file의 `roleHint`가 있을 경우 `roleHintRules` 적용
4. provider별 `providerDefaults` 병합
5. formatter의 `fallback`
6. 최종 해석 실패 시 실행 에러

v1에서는 `modelAlias`와 `fallback` 중심으로 시작하는 것이 가장 단순하다.

---

## Claude 필드와의 의미 매핑

참고용 개념 매핑:

| Claude 필드 | ACO 필드 | 비고 |
|-------------|-----------|------|
| `name` | `id` | 거의 직접 대응 |
| `description` | `when` | delegation hint |
| `model` | `modelAlias` | formatter에서 `provider + model`로 해석 |
| `permissionMode` | `permissionProfile` | 약한 의미의 permission |
| `maxTurns` | `turnLimit` | turn/iteration cap |
| `isolation` | `isolationMode` | `none` 또는 `worktree` |
| `mcpServers` | `mcpPolicy` | provision이 아니라 inherit declaration |
| `skills` | `skillRefs` | injection이 아니라 reference |
| `memory` | `memoryRefs` | read-only reference only |
| `initialPrompt` | `promptSeedFile` | seed file 기반 |
| `effort` | `reasoningEffort` | formatter가 provider별로 변환 |
| `color` | `uiColor` | metadata |

---

## 규범 시맨틱

다음 문구는 구현 규약으로 간주한다:

```yaml
semantics:
  memoryRefs: "Reference-only. ACO must not instruct providers to modify, append, or persist state to these paths."
  skillRefs: "Reference-only. ACO may mention these paths in the assembled prompt, but does not inject their full contents unless explicitly configured elsewhere."
  mcpPolicy: "Declarative only. ACO does not provision MCP servers; it only declares expected inherited MCP availability from the host runtime."
```

---

## 추천 v1 범위

v1에서 우선 구현할 필드:

- `id`
- `when`
- `modelAlias`
- `roleHint`
- `permissionProfile`
- `turnLimit`
- `workspaceMode`
- `isolationMode`
- `skillRefs`
- `memoryRefs`
- `promptSeedFile`
- `reasoningEffort`
- `uiColor`
- `mcpPolicy.mode = inherit`
- `mcpPolicy.expected`

보류:

- formatter의 고급 role-aware conflict resolution
- promptSeed/body merge 전략의 세밀한 규칙

---

## 요약

ACO는 Claude frontmatter clone이 아니라:

- `.claude/agents/*.md`의 canonical shared agent spec
- formatter rule 기반 translation
- sub-agent spawn intent를 `aco delegate <agent-id>`로 치환 가능
- prompt-level reference semantics
- blocking single-task execution

위 방향이 가장 일관적이다.
