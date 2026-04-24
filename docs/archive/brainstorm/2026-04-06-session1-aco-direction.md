# 브레인스토밍 세션 1 — aco 방향성 초기 탐색
**날짜**: 2026-04-06
**모드**: Team (Codex + Gemini + Claude)
**주제**: CCG-workflow UX와 결합하지 않고, CC sub-agent처럼 자연스럽게 녹이는 aco 아키텍처

---

## 배경 / 출발점

- codex-plugin-cc 방식(codex와 persistent connection) 아님
- CC 세션 워크플로우 중 sub-agent 역할(research/execute/review)을 codex/gemini CLI가 대체
- ccg-workflow의 Go wrapper 방식 채용, 목적은 slash command 다각화가 아님
- CC에서 sub-agent spawn하듯 자연스럽게 통합하고 싶음

---

## Provider별 아이디어

### 🔴 Codex — 기술적 실현 가능성

**통합 SpawnRequest 인터페이스**
```go
type SpawnRequest struct {
    TaskID   string
    Role     TaskRole  // research | execute | review
    Goal     string
    RepoRoot string
    WorkDir  string
    Conversation []Message
    Constraints  []string
    CandidateFiles []string
}
```

**Context Pack 디스크 직렬화**
```
.cc-subagents/<task-id>/
├── summary.md       ← 대화 요약 (전체 dump 금지)
├── repo_map.txt     ← 디렉터리 구조
├── git.diff         ← 현재 uncommitted diff
├── snippets/        ← 관련 파일 excerpts
└── constraints.md   ← 작업 역할, 출력 형식
```

**역할 기반 라우팅 + Scorecard**
- `execute → codex`, `research → gemini`, `review → gemini (broad) 또는 codex (patch-level)`
- `Scorecard{ CodeEditDepth, NeedShellActions, NeedLongContext, ... }`
- Gemini 실패 시 Codex fallback은 review/설명 목적으로만

**비자명한 기술 제약**
- Non-TTY subprocess 필수, ANSI strip 필수
- `Setpgid: true` — Node.js 계열 CLI의 worker process tree 처리

---

### 🟡 Gemini — 수평적 사고

**Binary Imposter / PATH Hijacking**
Go wrapper가 CC 내부 sub-process 호출 signature를 감지, argv + env 기반으로 투명하게 중개. CPU Instruction Set Emulation 패턴.

**Reverse MCP Proxy / Sidecar 패턴**
외부 CLI가 tool call을 emit할 때 wrapper가 가로채서 CC main 세션으로 relay. Gemini = thinking, CC kernel = doing.

**Shadow Journaling + FaaS Warm Pool**
CLI 부팅 오버헤드 제거를 위해 background에서 Gemini/Codex 프로세스를 warm 상태로 대기. SIGUSR1으로 context 변경 신호.

---

### 🔵 Claude — 패턴 포착과 역설

**핵심 패턴:**

1. **Blocking contract = Substitutability guarantee**
   async 상태 삭제가 단순화가 아니라 CC와의 대체 가능성 보장.
   CC가 `aco run gemini review`를 blocking wait하면 외부 AI는 in-process 함수 호출과 구조적으로 동일.
   비동기+session state 도입 시 provider identity가 새어나오는 seam 생성.

2. **프롬프트 파일 = sub-agent constitution**
   `(provider, command)` 조합 프롬프트 파일이 sub-agent의 정체성을 정의.
   `rescue` = "second opinion source", `adversarial` = "fault-finder". 같은 binary, 다른 constitution.

3. **Transparent Execution Substitution** (미명명)
   Plugin(기능 추가)도 아니고 Integration(프로토콜 경계)도 아님.
   호출자가 metadata 없이 substitute를 original과 구분하지 못하는 상태.
   프로세스 경계의 Liskov Substitution.

**핵심 역설:**

- 두 번째 AI가 Claude 안에 있을 때 가장 유용한 이유는 역설적으로 Claude가 아니기 때문. 진정한 adversarial 가치를 위해 provider별 프롬프트 설계 필요.
- Wrapper가 덜 할수록 sub-agent 출력의 신뢰도가 높아짐. stdout 직접 스트리밍이 신뢰 속성.
- async state 삭제가 cancellation을 오히려 더 신뢰할 수 있게 만든다.

---

## 관점 종합

### 수렴
- Go wrapper가 단일 실행 인터페이스 담당
- Role/capability 기반 라우팅 필요
- Non-interactive stdout 스트리밍이 핵심
- 프롬프트 파일이 sub-agent identity의 핵심

### 분기
- Gemini만: Binary Imposter, Warm Process Pool, Reverse MCP Proxy
- Codex만: SpawnRequest struct, Context Pack 디렉터리 구조
- Claude만: `Setpgid` hidden coupling 분석, "Transparent Execution Substitution" 미명명 패턴

### 가장 강력한 아이디어

1. **Blocking = 대체 가능성 보장** — async 유혹 거부가 아키텍처적으로 옳음
2. **Constitution-as-File** — slash command 다각화 대신 `(role, provider)` 조합 프롬프트 파일 정의
3. **Gemini Warm Pool** — Gemini/Codex CLI가 Node.js 기반이라 cold start 있음. Background warm 프로세스로 native 응답성

---

## 결론 / 방향

- `aco run codex execute`, `aco run gemini research`처럼 role 명시 호출
- CC skill/slash command에서 `run_in_background: true`로 병렬 dispatch
- Go wrapper = pure lifecycle manager (blocking, stream stdout)
- 프롬프트 파일 = sub-agent constitution (role별, provider별)
