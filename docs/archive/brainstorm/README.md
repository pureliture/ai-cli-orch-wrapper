# aco 브레인스토밍 세션 정리
**마지막 업데이트**: 2026-04-06 (parallel 제거, agent 구조 Option A 반영)

---

## 세션 목록

| 파일 | 날짜 | 핵심 질문 |
|------|------|-----------|
| [session1](./2026-04-06-session1-aco-direction.md) | 2026-04-06 | CC sub-agent처럼 자연스럽게 녹이는 aco 아키텍처 |
| [session2](./2026-04-06-session2-aco-architecture.md) | 2026-04-06 | ccg-workflow 분석 포함 방향성 재정립 |

---

## 두 세션을 관통하는 핵심 인사이트

### 1. "Native feeling"의 정의

> **Native feeling = 어떤 tool로 invoke하느냐의 문제. 메커니즘이 아님.**

- `process.go`의 `cmd.Stdout = out`은 이미 byte-by-byte 스트리밍을 달성하고 있음
- 문제는 **Frame break**: slash command → Bash tool call → tool-use sidebar
- CC Agent tool로 invoke하면 → peer agent response로 도달 → native 느낌
- binary 변경이 아니라 **invocation layer** 변경이 핵심

### 2. Blocking = Substitutability Guarantee

> async 상태 삭제가 단순화가 아니라 CC와의 **substitutability guarantee**임

- CC가 `aco run gemini review`를 blocking wait하면 외부 AI는 in-process 함수 호출과 구조적으로 동일
- async + session state 도입 시 provider identity가 새어나오는 seam 생성
- async state 삭제가 cancellation을 오히려 더 신뢰할 수 있게 만든다 (stale PID 없음)

### 3. Context 공유 역설

> CC sub-agent는 context를 자동 공유 안 해도 native함. 이유는 **well-formed invocation string**.

- "native feeling"은 context gap을 닫는 게 아님
- invocation string에 필요한 context를 완전히 담는 것
- 현재 "thin template" 설계(CLAUDE.md)가 오히려 **context-empty invocation**을 만드는 원인

### 4. Typed Delegation Endpoint (미명명 개념)

> aco binary는 process manager가 아니라 **foreign CLI를 CC execution context의 invocation protocol로 말하게 만드는 typed delegation endpoint**

- `aco run`과 CC sub-agent 모두: prompt 입력 → 내부 opaque → typed completion signal
- interface shape가 동일 → 같은 개념의 두 구현

### 5. Parallelism은 CC가 담당, aco는 single-task

> aco에 `--parallel` 모드는 불필요. CC가 이미 scheduler.

- ccg `--parallel`: intra-process goroutine pool — aco가 내부적으로 fan-out
- CC `run_in_background`: inter-process — CC가 여러 `aco run`을 독립 프로세스로 관리
- **aco는 single-task blocking만** 유지. 병렬 실행이 필요하면 CC가 `aco run`을 여러 번 `run_in_background`로 호출
- aco가 scheduler 역할을 맡으면 CC와 책임 중복 발생

---

## 주요 아이디어 카탈로그

### A. Role-only Agent Definition + Capability Routing ⭐ (가장 근본적)

**출처**: Session 2, Claude → CLI/Role 관심사 분리로 개선

**구조:**

```
.claude/agents/
├── researcher.md   ← "research 역할의 constitution"만 정의 (provider 무관)
├── executor.md     ← "execute 역할의 constitution"만 정의
└── reviewer.md     ← "review 역할의 constitution"만 정의
```

**흐름:**

```
CC orchestrator
  │ Agent tool (researcher)           ← native feeling의 열쇠
  ▼
CC agent process (researcher persona)
  │ Bash: aco run --role research --input "..."
  ▼
aco binary → role 기반 provider 선택 (research → gemini)
  ▼
gemini CLI → output
  │
  ▼ Agent tool result (peer agent response)
CC orchestrator
```

**왜 CLI+Role 조합이 아닌가:**
- `gemini-researcher.md` + `codex-executor.md` 방식: 2 providers × N roles = 파일 수 폭발
- role 추가 = provider 수만큼 파일 추가, provider 추가 = role 수만큼 파일 추가
- **Role-only**: role 추가 = agent 파일 1개, provider 교체 = aco 내부만 변경

**관심사 분리:**
- agent 파일 = role의 "헌법" (어떻게 생각하고, 뭘 출력하고, 어떤 제약을 갖는지)
- aco binary = provider 선택 로직 (role → provider capability mapping)

**Capability routing 예시:**
```
research  → gemini  (long-context synthesis, broad analysis)
execute   → codex   (repo-aware editing, shell actions)
review    → gemini  (broad critique) or codex (patch-level)
```

- `aco run`은 user-facing surface가 아닌 implementation detail
- orchestrator CC가 Bash result block이 아닌 peer agent response를 받음

### B. Template = Context Marshaler ⭐ (현재 설계 원칙 역전)

**출처**: Session 2, Claude + CCG 분석

```
현재:  thin template → aco run (binary가 prompt 구성)
전환:  smart template (context 수집) → --input "완전한 prompt" → aco run (lifecycle only)
```

- Template이 CC runtime context 수집: `$ARGUMENTS`, `git diff`, 관련 파일 내용
- Binary는 prompt 내용에 대해 아무것도 모름 — provider binary 실행 + signal + stream만
- CLAUDE.md의 "thin wrapper" 원칙을 의도적으로 뒤집음

### C. Ghost Worktree ⭐ (Execute role에서 강력)

**출처**: Session 2, Gemini

- `aco`가 sub-task 시작 시 hidden git worktree 생성
- codex/gemini가 worktree 안에서 파일 수정
- 결과를 `git diff`로 CC에 반환 → CC가 "PR 리뷰하듯" merge
- 파일 수정이 샌드박스화 — main workspace 오염 없음

### D. Constitution-as-File (Role-only agent와 통합)

**출처**: Session 1, Claude → Option A에 흡수

- agent 파일이 role의 "헌법": 어떻게 생각하고, 뭘 출력하고, 어떤 제약을 갖는지
- provider 무관하게 role 정체성을 정의 → provider 교체 시 agent 파일 불변
- `researcher.md` = "long-context synthesis, broad analysis, adversarial questioning"
- `executor.md` = "repo-aware editing, test-driven, minimal diff"
- slash command 다각화 없이 role 다각화 가능

### E. Capability-based Dispatch (Option A의 aco 내부 구현)

**출처**: Session 1, Codex → Option A와 결합

```
// CLI 인터페이스 (agent에서 호출)
aco run --role research --input "..."    // aco가 provider 선택

// 내부 routing
research  → gemini
execute   → codex
review    → gemini (기본) or codex (--patch-level)
```

- role → provider mapping이 aco 내부에 캡슐화
- provider 교체 = aco 바이너리 변경만 필요, agent 파일/template 불변
- `Scorecard{ CodeEditDepth, NeedLongContext, ... }`로 동적 결정 (향후 확장)

### F. json-envelope Output

**출처**: Session 2, Claude

```json
{
  "provider": "gemini",
  "command": "reviewer",
  "exit_code": 0,
  "content": "<provider raw output>",
  "meta": {"timeout_secs": 300, "duration_ms": 4200}
}
```

- CC가 prose 파싱 없이 structured reasoning 적용
- ccg `SESSION-ID: xxx` sentinel 패턴의 output 버전
- process-execution-contract의 "No tee" 원칙과 trade-off 있음

### G. Warm Process Pool

**출처**: Session 1, Gemini

- Gemini/Codex CLI = Node.js 기반 → cold start 오버헤드 있음
- Background에서 warm 상태 프로세스 유지
- CC가 delegate 시 즉시 응답 가능

---

## aco 방향성 변경 요약

### 변경 전 → 변경 후

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| **Primary surface** | `aco run <provider> <command>` CLI | `.claude/agents/<role>.md` custom agent |
| **Invocation** | slash command → Bash tool → `aco run` | Agent tool → CC agent → Bash → `aco run --role` |
| **Agent 파일 구조** | CLI+Role 조합 (파일 수 폭발) | Role-only (provider 무관, 파일 수 = role 수) |
| **Provider 선택** | 호출자가 명시 (`aco run gemini ...`) | aco 내부 capability routing (`--role research → gemini`) |
| **Template 역할** | thin dispatch | smart context marshaler |
| **Binary 역할** | prompt 구성 + lifecycle | lifecycle + capability routing |
| **Context 전달** | 프롬프트 파일에서 | CC runtime에서 수집해서 주입 |
| **Parallelism** | aco `--parallel` (내부 goroutine) | CC `run_in_background` (CC가 scheduler) |
| **Providers** | codex + gemini + copilot | codex + gemini only |

### 유지할 것

- Go wrapper 방식 (blocking single-task, stream stdout)
- Backend interface: `Name()`, `Command()`, `BuildArgs()`
- `Setpgid: true` (Node.js process tree 처리)
- 프롬프트 파일 = role constitution (agent 파일과 분리)

### 추가할 것

- `.claude/agents/researcher.md`, `executor.md`, `reviewer.md` (role-only, provider 무관)
- `aco run --role <role>` CLI 인터페이스 (capability routing 내장)
- Template에서 git diff, relevant files, task context 수집 로직 (context marshaling)
- `--output-format json-envelope` 옵션 (선택적)

### 제거할 것

- `aco --parallel` 모드 (CC `run_in_background`로 대체)
- copilot provider
- CLI+Role 조합 agent 파일 방식

---

## 참조 레퍼런스

| 프로젝트 | 채용할 패턴 | 채용하지 않을 것 |
|---------|------------|-----------------|
| **ccg-workflow** | Backend interface, ROLE_FILE 분리, blocking model | `--parallel` 모드 (불필요, CC가 scheduler), slash command 다각화, CLI+Role 조합 agent |
| **claude-octopus** | `codex exec`, `gemini -p` 직접 호출 단순성 | daemon 없음 확인 |
| **CCB** | context transfer 개념 | tmux daemon (너무 복잡) |
| **CC sub-agent** | well-formed invocation string 원칙 | CC process fork (우리 목적과 다름) |
