# 브레인스토밍 세션 2 — aco 아키텍처 재정립
**날짜**: 2026-04-06
**모드**: Team (Gemini + Claude, Codex timeout)
**주제**: ccg-workflow 분석 포함, aco 방향성 재브레인스토밍

---

## 배경 / 출발점

ccg-workflow 분석 결과를 포함해서 aco 방향성 재검토:

**ccg-workflow 핵심 패턴:**
- Backend interface: `Name()`, `Command()`, `BuildArgs()` — CLI 차이를 하나의 메서드에 압축
- Context: stdin heredoc + ROLE_FILE 헤더 (wrapper가 role file 내용을 task 앞에 prepend)
- Session resume: wrapper가 `SESSION-ID: xxx` stdout 출력 → 다음 호출에서 `resume <id>`
- `--parallel` 모드: stdin JSON task specs → topological sort → goroutine pool
- Slash commands가 Bash tool로 wrapper 호출 (run_in_background: true)
- `Setpgid` 미사용 (ccg), aco는 사용 (Node.js process tree 처리)

---

## Provider별 아이디어

### 🟡 Gemini — 수평적 사고

**핵심 통찰: Tool vs Protocol Gap**
`aco run`은 fire-and-forget Bash execution.
CC Agent tool은 lifecycle monitoring이 있는 interactive session.
이 gap을 bridge하려면 aco가 LSP-like proxy가 되어야 함.

**Idea A: Ghost Worktree Sync (Sidecar 패턴)**
- `aco`가 sub-task 시작 시 hidden git worktree 생성
- codex/gemini를 그 worktree 안에서 실행
- 결과를 `git diff`로 CC에 반환 → CC가 "PR 리뷰하듯" 처리
- Execute role에서 특히 강력 — 파일 수정이 샌드박스화됨

**Idea B: Stdio-to-MCP Bridge**
- `aco` Go binary를 로컬 MCP 서버로 변환
- CC가 Bash tool이 아닌 MCP tool call로 호출
- `call_tool("aco_delegate", {provider: "gemini", task: "..."})` — 구조화된 JSON 교환
- 터미널 문자열 파싱 제거

**Idea C: Resume-First Daemon (Pre-fetching)**
- `aco`가 백그라운드에서 CC 세션을 watch
- CC가 작업 중일 때 Gemini Flash로 draft 준비
- CC가 delegate 시 이미 50% 완료 상태
- LSP pre-fetch 개념의 agent 버전

**Context 전파 시 전달하지 말아야 할 것:**
- 전체 terminal scrollback
- CC의 internal tool-use log (context poisoning 원인)
- 대용량 binary asset
- 전달할 것: Goal + 관련 파일 (`git ls-files` 필터) + Architectural constraints

---

### 🔵 Claude — 패턴 포착 (codebase 직접 분석)

**패턴 1: "Native feeling"의 진짜 정의**

Latency 투명성 + Output 연속성.
`process.go`의 `cmd.Stdout = out`이 이미 byte-by-byte 스트리밍 달성.
문제는 메커니즘이 아니라 **Frame break** — slash command가 Bash tool call을 발생시키면 CC는 peer delegation이 아닌 tool-use sidebar를 봄.

> **핵심**: native feeling은 binary 변경이 아니라 **어떤 tool로 invoke하느냐**에서 옴.

**패턴 2: ROLE_FILE 패턴의 aco 등가물**

현재 `RunOpts.Prompt` = role carrier, `RunOpts.Content` = task carrier로 이미 구조적 분리.
다만 이 구분이 **provider 모델에게 보이지 않음** — 단순 string concatenation.
ccg ROLE_FILE이 protocol 수준에서 구조적 경계를 명시한다면, aco는 이 경계가 invisible.

**역설 1: Context 공유 역설**
CC sub-agent는 컨텍스트 자동 공유 안 해도 native함.
이유: **well-formed invocation string** — 필요한 모든 것이 prompt 파라미터에 담김.
"native feeling"은 context gap을 닫는 게 아니라 invocation string에 완전한 context를 담는 것.
현재 "thin template" 설계(CLAUDE.md)가 오히려 context-empty invocation을 만드는 원인.

**역설 2: ccg `--parallel` vs CC `run_in_background`**
별도로 유지해야 함.
- ccg `--parallel`: intra-process (단일 exec 경계 내 goroutine pool)
- CC `run_in_background`: inter-process (CC scheduler가 여러 독립 `aco run` 프로세스 관리)
- CC가 이미 scheduler이므로 aco가 job scheduler가 될 필요 없음

**미명명 개념: "Typed Delegation Endpoint"**
`aco run`과 CC sub-agent 모두:
- prompt/task 입력 받음
- 내부 실행 opaque
- typed completion signal 반환 (exit code + stdout)

aco binary는 process manager가 아니라 **foreign CLI를 CC execution context의 invocation protocol로 말하게 만드는 typed delegation endpoint**.

---

### 🔵 Claude — 혁신적 아이디어 3가지

**Idea 1: Template이 Context Marshaling을 소유해야 한다**

현재: binary가 prompt 구성 책임 (embedded defaults)
전환: template이 CC runtime context를 수집해서 완전한 prompt 빌드 → `--input`으로 전달

```
Template 역할 (개정):
  1. CC 환경에서 context 수집 ($ARGUMENTS, git diff, 파일 내용)
  2. role header + task body 구조의 완전한 prompt 빌드
  3. aco run gemini reviewer --input "<완전한 prompt>"

Binary 역할:
  - provider binary 해석
  - signal forwarding
  - stdout streaming
  - exit code 분류
  - prompt 내용에 대해 아무것도 모름
```

> CLAUDE.md의 "thin wrapper" 원칙을 뒤집음 — template이 smart해야 함.
> Binary가 genuinely thin이 되고, template이 genuinely smart가 됨.

**Idea 2: aco를 CLI가 아닌 CC Custom Agent Definition으로**

현재: Bash tool → `aco run gemini reviewer`
전환: CC Agent tool → `.claude/agents/gemini-reviewer.md` → (내부에서) Bash → `aco run`

```
CC orchestrator
  │ Agent tool (gemini-reviewer)     ← 이게 native feeling의 열쇠
  ▼
CC agent process (gemini-reviewer persona)
  │ Bash: aco run gemini reviewer --input "..."
  ▼
aco binary → gemini CLI → output streams
  │
  ▼ Agent tool result (peer agent response)
CC orchestrator
```

결과: orchestrator CC가 Bash result block이 아닌 **peer agent response**를 받음.
`aco run`은 user-facing surface가 아닌 implementation detail이 됨.

**Idea 3: `--output-format json-envelope`**

provider 출력을 structured JSON으로 wrap:
```json
{
  "provider": "gemini",
  "command": "reviewer",
  "exit_code": 0,
  "content": "<provider raw output>",
  "meta": {"timeout_secs": 300, "duration_ms": 4200}
}
```
CC가 prose 파싱 없이 structured reasoning 적용.
ccg의 `SESSION-ID: xxx` sentinel 패턴의 output 버전.

---

## 관점 종합

### 수렴
- "Native feeling" = invocation mechanism의 문제 (Gemini + Claude 동의)
- Template이 context를 더 많이 담아야 함
- Binary는 lifecycle만, 내용은 caller가 구성

### 분기
- Gemini만: Ghost Worktree, MCP Bridge, Resume-First Daemon
- Claude만: Custom Agent Definition 패턴, json-envelope output, ROLE_FILE 구조적 경계 분석

### 가장 강력한 3개

**1. Custom Agent Definition 패턴** (Claude, 가장 근본적)

`.claude/agents/gemini-researcher.md` + `.claude/agents/codex-executor.md` 생성.
CC Agent tool로 invoke → orchestrator CC가 peer agent response를 받음.
이것이 "native feeling"의 진짜 열쇠.

**2. Template = Context Marshaler** (Claude + CCG 분석 결합)

현재 "thin template" 원칙을 뒤집음.
Template이 CC runtime context를 수집해서 완전한 invocation string 빌드.
ccg ROLE_FILE을 발전시켜 template이 role + task + context를 명시적 구조로 구성.

**3. Ghost Worktree** (Gemini)

Execute role에서 특히 강력.
파일 수정이 격리된 worktree에서 일어나고, 결과가 diff로 반환.
CC가 review/merge를 자연스럽게 할 수 있는 워크플로우.

---

## 핵심 결론

**aco 방향성 재정립:**

| 변경 전 | 변경 후 |
|---------|---------|
| slash command → Bash tool → `aco run` | `.claude/agents/` custom agent → Agent tool → (내부) `aco run` |
| Binary가 role/prompt 구성 | Template이 context marshaling, binary는 lifecycle only |
| thin template (CLAUDE.md 원칙) | smart template (context-rich invocation) |
| `aco run gemini research` as primary surface | custom agent as primary surface, `aco run` as impl detail |
| Context는 프롬프트 파일에서 | Context는 template이 CC runtime에서 수집해서 주입 |

**유지할 것:**
- Go wrapper 방식 (blocking, stream stdout)
- Backend interface (`Name()`, `Command()`, `BuildArgs()`)
- `Setpgid: true` (Node.js process tree)
- codex + gemini only (copilot 제거)

**추가할 것:**
- `.claude/agents/gemini-*.md`, `.claude/agents/codex-*.md` custom agent definitions
- Template에서 git diff, relevant files, task context 수집 로직
- `--output-format json-envelope` 옵션 (선택적)
