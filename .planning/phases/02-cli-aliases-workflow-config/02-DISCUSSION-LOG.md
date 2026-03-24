# Phase 2: CLI Aliases + Workflow Config - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 02-cli-aliases-workflow-config
**Areas discussed:** Config file location, Alias invocation, tmux conf population, Config schema

---

## Config file location

| Option | Description | Selected |
|--------|-------------|----------|
| Per-repo (.wrapper.yaml, 프로젝트 루트에 커밋) | 이식성 최우선 — 레포 클론 시 설정도 함께 옴 | ✓ |
| Global (~/.config/ai-cli-orch-wrapper/config.yaml) | 모든 프로젝트 공유, 새 PC에서 별도 복원 필요 | |
| Both — per-repo가 global을 오버라이드 | 유연하지만 두 곳 관리 필요 | |

**User's choice:** Per-repo (.wrapper.yaml, 프로젝트 루트에 커밋)

---

## Alias invocation

### 질문 1: `wrapper claude my prompt` 실행 시 동작

| Option | Description | Selected |
|--------|-------------|----------|
| cao passthrough — 현재 터미널에서 실행 | `cao launch --provider claude_code ...`로 변환하여 실행 | ✓ |
| tmux pane에서 실행 | cao를 새 tmux pane/window에서 맹돈 | |
| workmux 통해 실행 | workmux 레이아웃으로 맹돈 (Phase 3+ 시나리오) | |

**User's choice:** cao passthrough — 현재 터미널에서 실행
**Notes:** cao launch 자체가 tmux 세션을 생성함 (cao shutdown이 "tmux sessions cleanup"을 담당). wrapper는 tmux를 직접 관리하지 않음.

### 질문 2: alias 뒤 인자 passthrough 여부

| Option | Description | Selected |
|--------|-------------|----------|
| 네 — 나머지 args 전체를 cao에 passthrough | `wrapper claude --session-name foo` → `cao launch --provider claude_code --agents developer --session-name foo` | ✓ |
| 아니오 — `wrapper claude` 만 지원, 인자 없이 cao 시작 | | |

**User's choice:** 네 — 나머지 args 전체를 cao에 passthrough

---

## tmux conf population

**Clarification requested:** 1, 2번 선택지가 이해가 안 간다.

**Explanation provided:**
- Option 1 (아니오): ai-cli.conf 건드리지 않음. `wrapper` 커맨드만으로 충분. Phase 1 주석은 시대가 지난 것으로 수정.
- Option 2 (네): `.wrapper.yaml` alias를 읽어 tmux bind-key 라인 자동 생성 (예: `bind-key C run-shell "wrapper claude"`). prefix+C로 AI CLI 실행 가능.

**Follow-up:** "tmux 안에서 wrapper 명령어를 쓸 일이 있나? 현재까지 계획상으로"

**Response:** Phase 2~3 계획 어디에도 tmux 키 바인딩이 필요한 시나리오 없음. cao가 세션/프로세스 라이프사이클 담당.

**Decision:** ai-cli.conf에 Phase 2에서 아무것도 넣지 않음. Phase 1 주석 업데이트.

---

## Config schema

**Clarification requested:** 사용 시나리오를 기반으로 설명 요청.

**Scenario explained:**
- Alias + Role 둘 다: Phase 2에서 aliases와 roles 선언 → Phase 3가 바로 읽음. `wrapper orchestrate` 실행 시 설정 파일만 보고 CLI 조합 결정.
- Alias만: Phase 2는 aliases만, roles는 Phase 3 플래닝 시 추가. Phase 3 작업 시 파일 포맷을 다시 고려해야 함.

**Further clarification:** "orchestrator/reviewer 모델 지정을 cao 공식에서는 어떤 식으로?"

**Research findings (cao CLI 직접 확인):**
- `cao launch --agents <profile> --provider <provider>` — tmux 세션 생성하며 AI CLI 실행
- `cao flow` — 파일 기반 플로우 정의. Phase 3 orchestration의 cao 네이티브 방식.
- `cao install <agent>` — agent 프로파일 설치 (built-in store, URL, 파일 경로)

**User insight:** "아 결국 wrapper가 role이랑 모델을 지정해서 cao를 실행시켜주는 역할이라는거지?" → 확인.

| Option | Description | Selected |
|--------|-------------|----------|
| Alias + Role 둘 다 지금 정의 | Phase 2에서 aliases와 roles 모두 선언. Phase 3가 바로 읽으면 됨. | ✓ |
| Alias만 먼저, role은 Phase 3에서 추가 | Phase 2는 단순, 단 Phase 3 시작 시 파일 수정 필요 | |

**User's choice:** Alias + Role 둘 다 지금 정의

---

## Claude's Discretion

- Config 직렬화 포맷 (YAML vs JSON) — 제로 dep 원칙과 가독성 간 트레이드오프
- `wrapper <unknown-alias>` 에러 메시지 포맷
- `cli.ts` 동적 alias 라우팅 구현 방식
- `.wrapper.yaml` 없을 때 graceful fallback 여부

## Deferred Ideas

- tmux 키 바인딩 (bind-key) 생성 — 계획 범위 밖, 필요성 없음 확인
- worktree 기반 작업 환경 (`wrapper worktree`) — v2 scope
