# NLSpec: aco v2 — Delegate Interface + Frontmatter-Driven Routing

**Status:** Draft
**Date:** 2026-04-06
**Source:** openspec/prd-aco-v2-native-agent-architecture.md v0.2
**Scope:** Phase 1 (delegate CLI + frontmatter routing) + Phase 2 (context marshaling) + Phase 3 (sentinel output, cleanup)

---

## Actors

| Actor | 설명 |
|-------|------|
| **CC Orchestrator** | Claude Code 인스턴스. Agent tool로 role agent를 호출하는 주체 |
| **Role Agent** | `.claude/agents/<id>.md`로 정의된 CC sub-agent. aco를 Bash로 호출하는 주체 |
| **aco binary** | Go 바이너리. frontmatter 파싱 + formatter routing + provider 실행을 담당. role을 소유하지 않음 |
| **Formatter** | `.aco/formatter.yaml`. vendor-specific 변환 규칙 집합. aco가 읽는 설정 파일 |
| **Agent Spec** | `.claude/agents/<id>.md`. CC와 aco가 공유하는 canonical agent 정의 파일 |
| **Provider CLI** | `gemini` 또는 `codex` 바이너리. aco가 exec하는 외부 프로세스 |

---

## Behaviors

### B-01: `aco delegate` 기본 실행 흐름

**When** role agent가 `aco delegate <agent-id> --input "<prompt>"` 를 실행하면
**aco는**:

1. `--agents-dir` (기본: `.claude/agents/`) 에서 `<agent-id>.md` 파일을 찾는다
2. 파일이 없으면 에러를 출력하고 exit 1한다
3. YAML frontmatter를 파싱한다
4. `--formatter` (기본: `.aco/formatter.yaml`) 를 읽는다
5. Resolution order(B-04)에 따라 provider + model을 결정한다
6. provider CLI를 exec하고 stdout을 그대로 스트리밍한다
7. provider 종료 후 sentinel meta line을 출력한다(B-08)
8. provider exit code를 그대로 반환한다 (0 또는 1)

---

### B-02: Agent Spec 파일 구조

**Agent spec 파일**은 YAML frontmatter + Markdown body로 구성된다.

**필수 필드**:
- `id`: string. 소문자, 숫자, 하이픈. `<agent-id>` 와 일치해야 함
- `when`: string. delegation hint. CC가 언제 이 agent를 선택하는지 설명

**선택 필드 (v1 구현 대상)**:

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `modelAlias` | string | 없음 | formatter의 `modelAliasMap` 키로 사용 |
| `roleHint` | string | 없음 | formatter의 `roleHintRules` 키로 사용 |
| `permissionProfile` | enum | `default` | `default \| restricted \| unrestricted` |
| `turnLimit` | int | 없음 | 최대 turn/iteration 수. timeout 계산에 활용 가능 |
| `executionMode` | enum | `blocking` | `blocking`만 지원. `background` 미지원 |
| `workspaceMode` | enum | `read-only` | `read-only \| edit`. 실행 의도 선언 |
| `isolationMode` | enum | `none` | `none \| worktree` |
| `promptSeedFile` | string | 없음 | role constitution 파일 경로. prompt assembly에 사용 |
| `reasoningEffort` | enum | 없음 | `low \| medium \| high \| max` |
| `skillRefs` | string[] | 없음 | 참고 skill 경로 목록. read-only reference |
| `memoryRefs` | string[] | 없음 | 참고 memory 경로 목록. read-only reference. 수정 금지 |
| `mcpPolicy` | object | 없음 | `mode: inherit` + `expected: [...]` |
| `uiColor` | string | 없음 | UI 표시용 |

**명시적 미지원**: `background`, `tools`, `disallowedTools`, `hooks`

**검증 규칙**:
- `id` 필드가 없으면 파싱 에러
- `executionMode: background` 지정 시 에러 출력 + exit 1
- frontmatter 없는 파일은 `id`, `when` 없음으로 처리하고 routing 진행 (formatter fallback 사용)

---

### B-03: Formatter 파일 구조

**`.aco/formatter.yaml`** 은 변환 규칙만 담는다. agent 목록을 나열하지 않는다.

```yaml
version: 1                    # 필수

providerDefaults:             # provider별 기본 launchArgs
  codex:
    launchArgs: []
  gemini_cli:
    launchArgs: []

modelAliasMap:                # modelAlias → provider + model
  sonnet-4.6:
    provider: codex
    model: gpt-5.4
  opus:
    provider: gemini_cli
    model: gemini-2.5-pro
  haiku:
    provider: gemini_cli
    model: gemini-2.5-flash

effortMap:                    # reasoningEffort → provider별 값
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

roleHintRules:                # roleHint → preferredProvider (override)
  research:
    preferredProvider: gemini_cli
  execute:
    preferredProvider: codex
  review:
    preferredProvider: codex

fallback:                     # 필수. 최종 해석 실패 시 사용
  provider: codex
  model: gpt-5.4
```

**formatter 파일이 없을 경우**: 에러 출력 + exit 1. 단, `--no-formatter` 플래그 지정 시 fallback으로 `codex`를 사용하고 계속 진행.

---

### B-04: Provider 결정 Resolution Order

`aco delegate` 실행 시 provider + model 결정 순서:

```
1. agent frontmatter의 modelAlias 읽기
   └── formatter.modelAliasMap[modelAlias] 조회 → provider + model 획득

2. agent frontmatter의 roleHint 읽기 (있을 경우)
   └── formatter.roleHintRules[roleHint].preferredProvider 조회
       └── 1에서 얻은 provider를 이 값으로 override
           (model은 1에서 얻은 값 유지. 단, override된 provider에 해당 model이 없으면 fallback model 사용)

3. formatter.providerDefaults[provider].launchArgs 병합

4. reasoningEffort 있을 경우
   └── formatter.effortMap[provider][reasoningEffort] → provider-specific 값 변환

5. 1-2 모두 해석 불가 시 formatter.fallback 사용

6. fallback도 없으면 에러 출력 + exit 1
```

**v1 단순화**: `modelAlias` + `fallback` 중심. `roleHint` override는 v1에서 구현하되, 없어도 fallback으로 동작해야 함.

---

### B-05: Blocking Execution

**aco delegate는 항상 blocking**이다.

- provider CLI를 `exec.Cmd`로 실행
- `exec.Cmd`는 `Run` 함수 스코프 내 local variable
- provider가 종료될 때까지 blocking wait
- PID를 파일에 기록하지 않음
- 세션 레지스트리 없음
- stdout은 `cmd.Stdout = callerStdout` (direct passthrough, tee 없음)
- 기본 timeout: 300초 (`--timeout` 플래그로 override 가능)

---

### B-06: Signal Handling

**When** aco가 SIGTERM 또는 SIGINT를 수신하면:

1. provider process에 SIGTERM 전달 (`proc.Signal(syscall.SIGTERM)`)
2. `time.AfterFunc(5 * time.Second, proc.Kill)` 등록
3. provider 종료 대기
4. exit 1 반환

**Node.js 계열 provider (codex, gemini)**:
- `cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}` 설정
- SIGTERM을 process group 전체에 전달하여 child process tree 처리

**참조**: `docs/contract/blocking-execution-contract.md`

---

### B-07: Exit Code Classification

| Provider 종료 | aco exit code |
|--------------|---------------|
| exit 0 | 0 |
| exit non-zero | 1 |
| timeout | 1 |
| signal termination | 1 |
| binary not found | 1 |
| frontmatter parse error | 1 |
| formatter resolution failure | 1 |

---

### B-08: Sentinel Meta Line Output

**When** provider가 정상 종료하면 (`exit 0` 또는 `exit non-zero` 모두):

aco는 provider stdout 스트리밍 직후 다음 형식의 줄을 stdout에 추가한다:

```
ACO_META_<rid>: {"agent":"<agent-id>","provider":"<provider>","model":"<model>","exit_code":<n>,"duration_ms":<n>}
```

`<rid>` 는 16 hex chars 길이의 랜덤 식별자 (8바이트 crypto/rand 기반).

**규칙**:
- sentinel은 항상 마지막 줄
- provider raw output과 sentinel 사이 빈 줄 없음
- sentinel이 없으면 caller가 비정상 종료로 판단해도 됨
- `--no-meta` 플래그로 생략 가능
- crypto/rand 실패 시 sentinel 없이 종료 (stderr 경고)

**예시**:
```
이 코드에서 다음과 같은 문제를 발견했습니다...
(provider raw output 계속)
ACO_META_a3f2b1c4d5e6f789: {"agent":"reviewer","provider":"gemini_cli","model":"gemini-2.5-pro","exit_code":0,"duration_ms":3812}
```

---

### B-09: Template Context Marshaling

**Role agent** (`.claude/agents/<id>.md`)가 aco를 호출하기 전에 slash command template이 CC runtime context를 수집해 완전한 prompt를 빌드한다.

**수집 순서**:
```bash
# 1. 사용자 입력
ARGS="$ARGUMENTS"

# 2. git context (실패해도 계속 진행)
DIFF=$(git diff --cached 2>/dev/null || git diff HEAD 2>/dev/null || echo "")
BRANCH=$(git branch --show-current 2>/dev/null || echo "")

# 3. prompt 빌드
PROMPT=$(cat <<EOF
## Task
$ARGS

## Branch
$BRANCH

## Changes
\`\`\`diff
$DIFF
\`\`\`
EOF
)

# 4. aco 호출
aco delegate reviewer --input "$PROMPT"
```

**규칙**:
- git 명령 실패 시 해당 섹션을 빈 값으로 처리하고 계속 진행 (exit하지 않음)
- diff가 너무 클 경우 (`wc -c` > 50000) truncation 후 `[truncated]` 표시
- aco binary는 prompt 내용에 대해 아무것도 모름. lifecycle + routing만 담당

---

### B-10: Ghost Worktree (`isolationMode: worktree`, P2)

**When** agent frontmatter에 `isolationMode: worktree`가 설정된 경우:

1. `git worktree add .aco-worktrees/<uuid> HEAD` 실행
2. `defer` 블록에 `git worktree remove --force .aco-worktrees/<uuid>` 등록 (panic/signal에도 cleanup 보장)
3. provider를 worktree 디렉토리(`WorkDir`)에서 실행
4. provider 종료 후 worktree 내 변경사항을 `git diff HEAD` 로 stdout 출력
5. sentinel meta line 출력 (B-08)
6. worktree 즉시 삭제 (defer 실행)
7. exit

**CC 수신**: diff 텍스트만 받음. `git apply` 또는 직접 파일 수정으로 merge.

**worktree 위치**: `.aco-worktrees/`는 `.gitignore`에 추가 필요. aco는 이를 자동으로 확인하고 없으면 경고.

---

## Constraints

| ID | 제약 |
|----|------|
| C-01 | aco는 role을 소유하지 않는다. canonical role 목록 없음 |
| C-02 | `executionMode: background` 미지원. blocking single-task만 |
| C-03 | `memoryRefs` 경로를 수정/append/저장소로 사용하는 것을 provider에게 지시하지 않는다 |
| C-04 | `skillRefs`는 prompt에서 참고 경로로만 언급. 전체 내용을 자동 주입하지 않는다 |
| C-05 | MCP server를 provision하지 않는다. `mcpPolicy`는 선언적 hint만 |
| C-06 | PID 파일 없음. 세션 레지스트리 없음. 디스크에 실행 상태 기록 없음 |
| C-07 | stdout은 provider stdout + sentinel 1줄만. tee 없음. output.log 없음 |
| C-08 | Ghost Worktree는 aco 종료 시 즉시 삭제. CC가 삭제를 지시할 때까지 유지하지 않음 |
| C-09 | `.aco/formatter.yaml`의 `version` 필드는 현재 `1`만 지원. 다른 값이면 에러 |
| C-10 | provider는 codex + gemini_cli만. copilot 제거 |

---

## Error Scenarios

| 시나리오 | aco 동작 |
|----------|----------|
| `.claude/agents/<id>.md` 파일 없음 | stderr에 에러 출력 + exit 1 |
| frontmatter YAML 파싱 실패 | stderr에 파싱 에러 + exit 1 |
| `.aco/formatter.yaml` 없음 | stderr에 에러 + exit 1 (단, `--no-formatter` 플래그 시 codex fallback) |
| `formatter.yaml` 의 `version` != 1 | stderr에 에러 + exit 1 |
| resolution 후 provider binary not found | stderr에 `provider not found: <name>` + exit 1 |
| `executionMode: background` 지정 | stderr에 미지원 에러 + exit 1 |
| timeout 초과 | SIGTERM → 5초 후 SIGKILL → exit 1 |
| provider exit non-zero | sentinel 출력 (exit_code=N) + exit 1 |
| Ghost Worktree 생성 실패 (git 없음 등) | stderr에 에러 + exit 1 (worktree 없이 실행하지 않음) |
| git worktree cleanup 실패 | stderr에 경고 출력. exit code는 provider exit code 기준 |

---

## Acceptance Criteria

### AC-01: delegate 기본 실행

```
Given: .claude/agents/researcher.md 존재, .aco/formatter.yaml 존재
When:  aco delegate researcher --input "analyze this codebase"
Then:  - frontmatter 파싱 성공
       - formatter resolution으로 provider 결정
       - provider stdout 실시간 스트리밍
       - 마지막 줄: ACO_META: {...}
       - exit 0 (provider 성공 시)
```

### AC-02: modelAlias → provider 변환

```
Given: researcher.md의 modelAlias: sonnet-4.6
       formatter.modelAliasMap.sonnet-4.6.provider: codex
When:  aco delegate researcher --input "..."
Then:  codex CLI 실행됨
```

### AC-03: roleHint override

```
Given: researcher.md의 modelAlias: sonnet-4.6 (codex로 매핑됨)
       researcher.md의 roleHint: research
       formatter.roleHintRules.research.preferredProvider: gemini_cli
When:  aco delegate researcher --input "..."
Then:  gemini_cli CLI 실행됨 (roleHint가 codex를 override)
```

### AC-04: formatter fallback

```
Given: researcher.md에 modelAlias 없음, roleHint 없음
       formatter.fallback.provider: codex
When:  aco delegate researcher --input "..."
Then:  codex CLI 실행됨
```

### AC-05: 파일 없음 에러

```
Given: .claude/agents/unknown.md 파일 없음
When:  aco delegate unknown --input "..."
Then:  exit 1, stderr에 파일 없음 메시지
```

### AC-06: blocking 동작

```
Given: provider가 10초 동안 실행 중
When:  aco delegate researcher --input "..."
Then:  aco는 provider 종료까지 blocking (10초 동안 반환하지 않음)
       provider stdout이 실시간으로 caller에게 전달됨
```

### AC-07: SIGTERM 처리

```
Given: aco가 provider 실행 중
When:  aco process에 SIGTERM 전달
Then:  provider process에 SIGTERM 전달
       5초 이내 종료 안 되면 SIGKILL
       aco exit 1
```

### AC-08: sentinel meta line

```
Given: provider가 정상 종료 (exit 0)
When:  aco delegate researcher --input "..."
Then:  마지막 줄이 "ACO_META: " 로 시작하는 JSON
       JSON에 agent, provider, model, exit_code, duration_ms 포함
```

### AC-09: vendor-neutral agent 파일

```
Given: .claude/agents/researcher.md
When:  grep -i "gemini\|codex\|gpt\|claude" .claude/agents/researcher.md
Then:  0 results (provider 이름 없음)
```

### AC-10: Ghost Worktree cleanup

```
Given: researcher.md의 isolationMode: worktree
When:  aco delegate researcher --input "..."
Then:  .aco-worktrees/<uuid>/ 생성됨
       provider 실행 완료 후 git diff 출력
       aco 종료 후 .aco-worktrees/<uuid>/ 삭제됨
```

---

## 파일 구조 요약

```
<project>/
├── .claude/
│   └── agents/
│       ├── researcher.md    ← frontmatter + role constitution body
│       ├── executor.md
│       └── reviewer.md
├── .aco/
│   ├── formatter.yaml       ← vendor-specific 변환 규칙
│   └── prompts/
│       ├── researcher.md    ← promptSeedFile 참조 대상
│       ├── executor.md
│       └── reviewer.md
└── .claude/
    └── commands/
        ├── research.md      ← context marshaling + aco delegate 호출
        ├── execute.md
        └── review.md
```

---

## 미구현 (v2 범위 밖)

- `skillRefs` 내용 자동 주입 (현재: 참조 경로만 mention)
- `mcpPolicy` 기반 MCP attach
- `background` executionMode
- Warm Process Pool (cold start 최적화)
- Capability Scorecard (동적 provider 선택)
- formatter 고급 conflict resolution (roleHint + modelAlias 충돌 시 세밀한 우선순위)

---

*Completeness check: AC-01~AC-10 커버. B-01~B-10 전체 명세. Error scenario 9개 정의.*
*Based on: PRD v0.2, docs/brainstorm/2026-04-06-aco-frontmatter-spec-draft.md*
