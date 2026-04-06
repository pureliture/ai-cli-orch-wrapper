# PRD: aco v2 — Role-Only Agent Architecture with Native CC Integration

**Status:** Draft
**Date:** 2026-04-06
**Author:** Synthesized from brainstorm sessions 1 & 2 + frontmatter spec
**Version:** 0.2

---

## 1. Executive Summary

aco v2는 Claude Code(CC) 워크플로우 내에서 외부 AI CLI(Gemini, Codex)를 **peer agent**처럼 자연스럽게 동작하도록 만드는 아키텍처 전환이다.

현재 aco는 slash command → Bash tool → `aco run <provider> <command>` 경로로 작동하여, CC orchestrator가 external AI를 "tool call sidebar"로 인식한다. v2는 이 구조를 세 가지 축으로 전환한다:

1. **Invocation layer**: Bash tool → Agent tool. CC orchestrator가 peer agent response를 받는 "native feeling" 달성
2. **CLI interface**: `aco run <provider> <command>` → `aco delegate <agent-id>`. aco가 role을 소유하지 않고, `.claude/agents/*.md` frontmatter를 읽어 provider를 결정
3. **Routing layer**: 하드코딩된 role→provider 매핑 → `.aco/formatter.yaml` 변환 규칙. vendor-specific 설정이 agent 파일 밖으로 분리

핵심 가치:
- **Native feeling**: CC orchestrator가 peer agent response를 받는 경험
- **aco는 role-less**: canonical role 목록 없음. provider 결정은 frontmatter + formatter가 담당
- **단일 canonical spec**: `.claude/agents/*.md`를 CC와 aco가 공유. role 정의 분산 없음
- **Provider 교체 비용 0**: agent 파일 무변경, `.aco/formatter.yaml`만 수정

---

## 2. Problem Statement

### 현재 구조의 문제

```
CC orchestrator
  │ slash command
  ▼
Bash tool call ← CC가 이것을 "tool use sidebar"로 표시
  │ aco run gemini reviewer
  ▼
aco binary → gemini CLI → stdout
  │
  ▼ Bash tool result block ← orchestrator가 받는 것
CC orchestrator
```

**Frame break**: CC orchestrator가 peer delegation이 아닌 tool-use sidebar를 본다.

### 정량화된 문제 영역

| 문제 | 현재 상태 | 목표 |
|------|-----------|------|
| **Invocation frame** | Bash result block | Peer agent response |
| **Provider 노출** | 호출자가 `aco run gemini ...` 명시 | aco가 frontmatter 읽어 결정 |
| **Agent 파일 수** | CLI+Role 조합 (N×M) | role 수만큼 (N) |
| **Routing 설정 위치** | aco 바이너리 하드코딩 | `.aco/formatter.yaml` |
| **Context 전달** | 프롬프트 파일 정적 내용 | CC runtime context 동적 수집 |

### 근본 원인

1. **Invocation mechanism mismatch**: Bash tool이 아닌 Agent tool로 invoke해야 peer response를 받을 수 있음
2. **aco가 role을 소유**: provider routing 로직이 바이너리에 박혀 있어 vendor churn을 코드 변경으로만 흡수 가능
3. **Thin template 원칙의 역설**: context-empty invocation이 외부 AI 응답 품질 저하를 유발
4. **단일 agent spec 부재**: CC용 agent 파일과 aco 설정이 분리되어 role 정의 중복

---

## 3. Goals & Metrics

### P0 — Must Have (v2.0)

| ID | Goal | 성공 지표 |
|----|------|-----------|
| G-01 | `aco delegate <agent-id>` CLI | `aco delegate researcher --input "..."` 실행 시 `.claude/agents/researcher.md` frontmatter 파싱 후 provider 결정 |
| G-02 | Frontmatter 기반 routing | `modelAlias` → `modelAliasMap` → `roleHint` → `roleHintRules` → `fallback` 순서로 provider 결정 |
| G-03 | Formatter 파일 분리 | `.aco/formatter.yaml`에 vendor-specific 변환 규칙 집중. agent 파일은 vendor-neutral |
| G-04 | Agent tool invocation | CC orchestrator가 Agent tool로 role agent를 호출하고 peer agent response를 받음 |
| G-05 | Context marshaling template | template이 `$ARGUMENTS`, `git diff`, 관련 파일 내용을 수집해 완전한 prompt 빌드 |

### P1 — Should Have (v2.0)

| ID | Goal | 성공 지표 |
|----|------|-----------|
| G-06 | Blocking single-task 유지 | async state 없음, session registry 없음, exit 0/1만 반환 |
| G-07 | Signal forwarding 유지 | SIGTERM → provider SIGTERM → 5초 후 SIGKILL |
| G-08 | Copilot 제거 | codex + gemini만 유지 |
| G-09 | Sentinel meta line output | streaming 유지하면서 마지막에 `ACO_META: {...}` 1줄 추가 |

### P2 — Nice to Have (v2.1+)

| ID | Goal | 성공 지표 |
|----|------|-----------|
| G-10 | Ghost Worktree (`isolationMode: worktree`) | `isolationMode: worktree` 설정 시 격리 실행, `git diff`로 결과 반환 후 즉시 삭제 |
| G-11 | Capability Scorecard | 동적 provider 선택 로직 |
| G-12 | Warm Process Pool | Node.js cold start 제거 |

### 성공 메트릭 측정 방법

- **Native feeling**: CC 세션 로그에서 Agent tool result vs Bash tool result 비율
- **Routing 분리**: `grep -r "gemini\|codex" .claude/agents/` = 0 results
- **Provider 교체 비용**: 변경 파일이 `.aco/formatter.yaml`만 포함
- **Context 완성도**: invocation string에 git diff 포함 여부

---

## 4. Non-Goals

| 항목 | 이유 |
|------|------|
| aco 자체 canonical role 목록 | aco는 role-less. role은 프로젝트 agent 파일이 정의 |
| `aco --parallel` 모드 | CC `run_in_background`가 이미 inter-process scheduler 역할 수행 |
| Async session state | Blocking = Substitutability guarantee |
| MCP 서버 provision | `mcpPolicy`는 선언적 hint만. aco는 MCP server를 attach하지 않음 |
| CC 내부 tool-use log 전달 | context poisoning 원인 |
| copilot provider | 제거 |
| `background` executionMode | aco는 blocking single-task만. scheduler는 CC orchestrator 책임 |
| memory 경로 수정/저장 | `memoryRefs`는 read-only reference only |

---

## 5. User Personas

### Persona 1: CC Orchestrator (Claude Code 인스턴스)

**역할**: aco를 통해 external AI에 sub-task를 위임하는 primary orchestrator

**Pain point**: external AI 응답이 peer agent response가 아닌 Bash result block으로 표시

**목표**: `Agent tool(researcher)` 호출 후 peer response를 받는 것

**v2에서 얻는 것**: Agent tool → role agent → `aco delegate` → provider → peer agent response

---

### Persona 2: AI Engineer (aco 사용 개발자)

**역할**: aco를 이용해 CC 워크플로우에 external AI를 통합하는 개발자

**Pain point**:
- provider별 agent 파일 관리, provider 교체 시 여러 파일 수정
- agent 파일에 vendor-specific 설정이 섞임

**목표**:
- agent 파일은 role constitution만. provider는 `.aco/formatter.yaml`에서 관리
- provider 교체 = formatter 파일만 수정

**v2에서 얻는 것**: frontmatter spec + formatter 분리 구조

---

### Persona 3: Role Agent (CC sub-agent 프로세스)

**역할**: `.claude/agents/researcher.md`로 정의된 CC agent가 aco를 실행하는 주체

**목표**: role constitution에 따라 행동하고 `aco delegate researcher --input "..."` 실행

**v2에서 얻는 것**: frontmatter로 정의된 명확한 role constitution + execution contract

---

## 6. Functional Requirements

### FR-001: Agent Frontmatter Spec

**설명**: `.claude/agents/*.md`에 YAML frontmatter를 정의한다. CC와 aco가 같은 파일을 공유하는 canonical spec이다.

**파일 예시**:
```markdown
---
id: researcher
when: Long-context 조사, 비교, 문서 기반 분석이 필요할 때
modelAlias: sonnet-4.6
roleHint: research
permissionProfile: restricted
turnLimit: 12
executionMode: blocking
workspaceMode: read-only
isolationMode: none
promptSeedFile: .aco/prompts/researcher.md
reasoningEffort: high
skillRefs:
  - .claude/skills/research-methods
memoryRefs:
  - .claude/agent-memory/research-notes
mcpPolicy:
  mode: inherit
  expected:
    - github
uiColor: cyan
---
이 에이전트는 broad research와 synthesis를 담당한다.
skillRefs와 memoryRefs는 참고 대상으로만 취급한다.
```

**v1 구현 대상 필드**: `id`, `when`, `modelAlias`, `roleHint`, `permissionProfile`, `turnLimit`, `workspaceMode`, `isolationMode`, `promptSeedFile`, `reasoningEffort`, `skillRefs`, `memoryRefs`, `mcpPolicy`, `uiColor`

**명시적 미지원 필드**: `background`, `tools`, `disallowedTools`, `hooks`

**검증**: `grep -r "gemini\|codex" .claude/agents/` = 0 results

---

### FR-002: `aco delegate` CLI 인터페이스

**설명**: `aco delegate <agent-id> --input "<prompt>"` 인터페이스를 추가한다. aco는 agent-id를 받아 `.claude/agents/<agent-id>.md` frontmatter를 파싱하고, formatter 규칙으로 provider를 결정한 뒤 실행한다.

**CLI 시그니처**:
```
aco delegate <agent-id> [--input <prompt>] [--agents-dir <path>] [--formatter <path>] [--timeout <secs>]
```

**기본 경로**:
- agents dir: `.claude/agents/`
- formatter: `.aco/formatter.yaml`

**기존 인터페이스**: `aco run <provider> <command>` 형식은 migration path로 유지, deprecation 경고 추가

---

### FR-003: Formatter 파일 (`.aco/formatter.yaml`)

**설명**: vendor-specific 변환 규칙을 담는 프로젝트 레벨 설정 파일이다. agent 파일은 이 파일을 직접 참조하지 않는다.

**파일 구조**:
```yaml
version: 1

providerDefaults:
  codex:
    launchArgs: []
  gemini_cli:
    launchArgs: []

modelAliasMap:
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

**formatter의 책임**:
- `modelAlias`를 `provider + model` 조합으로 변환
- `roleHint`로 provider 선택 보정
- `reasoningEffort`를 provider별 값으로 변환
- provider별 기본 `launchArgs` 제공
- 해석 실패 시 fallback 적용

**formatter는 agent 목록을 나열하지 않는다.** 변환 규칙만 가진다.

---

### FR-004: Resolution Order (Provider 결정 우선순위)

**설명**: `aco delegate` 실행 시 provider 결정 순서를 명세한다.

```
1. agent frontmatter의 modelAlias
2. formatter의 modelAliasMap으로 provider + model 변환
3. agent frontmatter의 roleHint가 있을 경우 formatter의 roleHintRules 적용 (provider override)
4. formatter의 providerDefaults 병합 (launchArgs 등)
5. formatter의 fallback
6. 최종 해석 실패 시 실행 에러
```

**v1 단순화**: `modelAlias` + `fallback` 중심으로 시작. `roleHint` override는 v1에서 선택적으로 구현.

---

### FR-005: Template Context Marshaling

**설명**: slash command template이 CC runtime context를 수집해 완전한 prompt를 구성한다.

**v2 template 구조**:
```bash
# Context 수집
DIFF=$(git diff --cached 2>/dev/null || git diff HEAD 2>/dev/null)
ARGS="$ARGUMENTS"

# 완전한 prompt 빌드
PROMPT=$(cat <<EOF
## Task
$ARGS

## Current Changes
\`\`\`diff
$DIFF
\`\`\`
EOF
)

# aco에 전달
aco delegate reviewer --input "$PROMPT"
```

**수집 대상**: `$ARGUMENTS`, `git diff`, 관련 파일 내용 (`git ls-files` 필터), 작업 제약

**aco binary**: prompt 내용에 대해 아무것도 모름 — frontmatter 파싱 + formatter routing + lifecycle만

---

### FR-006: Blocking Execution Model 유지

**설명**: aco v2는 blocking single-task 모델을 유지한다.

**요구사항**:
- `aco delegate`는 provider 종료까지 blocking
- async state 없음 (세션 레지스트리, PID 파일 없음)
- SIGTERM → provider SIGTERM → 5초 후 SIGKILL
- context timeout 지원 (기본 300초, `turnLimit` frontmatter 필드로 override 가능)
- 출력은 caller stdout으로 직접 스트리밍 (tee 없음)

**참조**: `docs/contract/blocking-execution-contract.md`

---

### FR-007: Sentinel Meta Line Output (P1)

**설명**: provider 출력을 실시간 스트리밍하되, 종료 직전에 sentinel meta line을 추가한다.

**출력 형식**:
```
안녕하세요, 이 코드에서 문제를 발견했습니다...  ← raw provider output (실시간 스트리밍)
ACO_META: {"provider":"gemini_cli","agent":"reviewer","exit_code":0,"duration_ms":4200}
```

**구현**: `cmd.Stdout = out` (pure passthrough) 유지. provider 종료 후 `fmt.Fprintf(out, "ACO_META: %s\n", metaJSON)` 1줄 추가.

**선례**: ccg-workflow `SESSION-ID: xxx` sentinel 패턴

---

### FR-008: Copilot Provider 제거

**설명**: copilot provider를 제거하고 codex + gemini_cli만 유지한다.

---

### FR-009: Ghost Worktree (`isolationMode: worktree`, P2)

**설명**: agent frontmatter에 `isolationMode: worktree` 설정 시 격리된 git worktree에서 실행한다.

**동작 순서**:
1. hidden git worktree 생성 (`.aco-worktrees/<task-id>/`)
2. `defer git worktree remove` 등록 (panic/signal 시에도 cleanup 보장)
3. provider를 worktree 내에서 실행
4. 실행 완료 후 `git diff` stdout 출력
5. worktree 즉시 삭제 → exit

**결정**: aco가 즉시 삭제. blocking contract 유지. CC는 diff 텍스트만 받고 `git apply`로 merge.

---

## 7. Implementation Phases

### Phase 1: Invocation Layer 전환

**목표**: CC orchestrator가 peer agent response를 받도록 전환

**작업**:
1. `.claude/agents/researcher.md` 생성 (FR-001 frontmatter 포함)
2. `.claude/agents/executor.md` 생성
3. `.claude/agents/reviewer.md` 생성
4. `aco delegate <agent-id>` CLI 추가 (FR-002)
5. frontmatter 파싱 구현 (FR-001)
6. `.aco/formatter.yaml` 초안 생성 (FR-003)
7. resolution order 구현 (FR-004)

**완료 기준**: `aco delegate researcher --input "test"` 실행 시 formatter 규칙대로 provider 선택 후 실행

---

### Phase 2: Context Marshaling 전환

**목표**: template이 CC runtime context를 수집해 완전한 invocation string 생성

**작업**:
1. reviewer template context marshaling 구현 (FR-005)
2. researcher template context marshaling 구현
3. executor template context marshaling 구현
4. 기존 thin template 제거

**완료 기준**: invocation string에 git diff 및 관련 파일 내용 포함 확인

**선행 조건**: Phase 1 완료

---

### Phase 3: 정리 및 선택적 기능

**목표**: 코드베이스 단순화 및 P1 기능 추가

**작업**:
1. copilot provider 제거 (FR-008)
2. sentinel meta line 구현 (FR-007)
3. `aco run <provider> <command>` deprecation 경고 추가
4. 기존 CLI+Role 조합 agent 파일 제거

**완료 기준**: `ls packages/wrapper/src/providers/` = gemini.ts + codex.ts만 존재

---

### Phase 4: Ghost Worktree (P2)

**목표**: `isolationMode: worktree` 지원

**작업**:
1. worktree 생성/삭제 lifecycle 구현 (FR-009)
2. frontmatter `isolationMode` 필드 파싱

**완료 기준**: `isolationMode: worktree` 설정 agent 실행 후 CC가 diff 형태로 결과 수신

**선행 조건**: Phase 1 + Phase 2 완료

---

## 8. Risks & Mitigations

| Risk | 심각도 | 가능성 | Mitigation |
|------|--------|--------|------------|
| Agent tool invoke path의 CC 버전 의존성 | High | Low | CC custom agent 지원 버전 확인, fallback으로 기존 slash command 유지 |
| `.aco/formatter.yaml` 미존재 시 동작 | High | High | fallback 필드로 최소 동작 보장, formatter 없을 시 명확한 에러 메시지 |
| Template context marshaling 오버헤드 | Medium | Medium | `git diff --cached` 우선, 대용량 diff truncation |
| `modelAlias` 미설정 agent의 routing | Medium | Medium | `roleHint` → `roleHintRules` → `fallback` 경로로 반드시 도달 |
| Gemini/Codex CLI cold start | Medium | High | 단기: timeout 기본값 조정, 장기: Warm Process Pool (G-12) |
| Ghost Worktree conflict | Low | Low | `.gitignore` 내 위치에 생성, defer cleanup |

### 가정 사항 (검증 필요)

- CC custom agent `.claude/agents/` 메커니즘이 peer agent response를 실제로 반환하는지 확인 필요
- CC가 agent frontmatter를 어떻게 처리하는지 확인 필요 (aco는 자체 파싱, CC는 독자적으로 해석)
- `Setpgid: true`가 worktree 내 프로세스 트리에서도 정상 동작하는지 확인 필요

---

## 9. 아키텍처 다이어그램

### v2 목표 아키텍처

```
CC orchestrator
  │
  │ Agent tool (researcher)          ← native feeling의 열쇠
  ▼
CC agent process (researcher persona)
  │ role constitution 적용 (frontmatter body + promptSeedFile)
  │
  │ Bash: aco delegate researcher --input "<marshaled prompt>"
  ▼
aco binary
  │ .claude/agents/researcher.md 파싱 (frontmatter)
  │   modelAlias: sonnet-4.6, roleHint: research
  │
  │ .aco/formatter.yaml 읽기
  │   modelAliasMap: sonnet-4.6 → codex
  │   roleHintRules: research → preferredProvider: gemini_cli (override)
  │
  │ exec gemini_cli (blocking, stream stdout)
  ▼
gemini_cli → output streams
  │
  ▼ Agent tool result (peer agent response)
CC orchestrator
```

### Formatter Resolution 흐름

```
aco delegate researcher --input "..."
  │
  ├── .claude/agents/researcher.md 파싱
  │   ├── modelAlias: sonnet-4.6
  │   └── roleHint: research
  │
  ├── formatter.modelAliasMap 조회
  │   └── sonnet-4.6 → provider: codex, model: gpt-5.4
  │
  ├── formatter.roleHintRules 조회 (override 적용)
  │   └── research → preferredProvider: gemini_cli
  │
  └── 최종: gemini_cli + gemini-2.5-pro 실행
```

### 파일 구조 변화

```
변경 전:
.claude/agents/
├── gemini-researcher.md
├── gemini-reviewer.md
└── codex-executor.md

변경 후:
.claude/agents/           ← CC와 aco 공유 canonical spec
├── researcher.md         ← frontmatter: modelAlias, roleHint, ...
├── executor.md
└── reviewer.md

.aco/
├── formatter.yaml        ← vendor-specific 변환 규칙
└── prompts/
    ├── researcher.md     ← promptSeedFile 참조 대상
    ├── executor.md
    └── reviewer.md
```

---

## 10. 결정 완료 사항

| 질문 | 결정 |
|------|------|
| Q1. review role 분리 여부 | aco는 role-less. canonical role 목록 없음. `roleHint`는 formatter 보정 힌트일 뿐 |
| Q2. agent 파일 위치 | `.claude/agents/`는 프로젝트에 직접. CC와 aco가 공유. install 단계 불필요 |
| Q3. json-envelope vs streaming | Option C: streaming 유지 + 마지막에 `ACO_META:` sentinel 1줄 추가 |
| Q4. Ghost Worktree cleanup | aco가 즉시 삭제. blocking contract 유지. CC는 diff 텍스트만 수신 |

---

*Adversarial review: pending*
*Self-score: TBD*
*Based on: docs/brainstorm/2026-04-06-session1-aco-direction.md, docs/brainstorm/2026-04-06-session2-aco-architecture.md, docs/brainstorm/2026-04-06-aco-frontmatter-spec-draft.md*
