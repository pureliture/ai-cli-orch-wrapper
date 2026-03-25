# ai-cli-orch-wrapper

## What This Is

어느 PC에서나 단일 명령어로 동일한 AI CLI 오케스트레이션 환경을 재현할 수 있는 개인용 래퍼 툴.
현재는 `wrapper setup`, alias 기반 실행, repo-local workflow config, 그리고 CAO-backed plan→review 루프까지 포함한 v1.0 기능셋을 제공한다.

## Core Value

어느 PC로 옮겨도 단일 명령어 하나로 동일한 AI CLI 오케스트레이션 환경이 즉시 복원되어야 한다.

## Requirements

### Validated

**Setup** — Validated in Phase 1: Foundation + Environment Setup
- [x] 단일 명령어로 전체 환경 셋업 완료 (tmux conf 병합 포함)
- [x] `~/.config/tmux/ai-cli.conf` 생성 및 base tmux conf에 source 라인 추가 (최소 침습)
- [x] 이미 설치된 cao / tmux / workmux를 전제로 동작 (직접 설치 불포함)

**CLI Aliases + Workflow Config** — Validated in Phase 2: CLI Aliases + Workflow Config
- [x] `wrapper claude`, `wrapper gemini`, `wrapper codex` 같은 짧은 alias로 해당 provider 실행 가능
- [x] 코드 수정 없이 `.wrapper.json`에서 alias 추가/재매핑 가능
- [x] `orchestrator`, `reviewer` 같은 role→CLI 매핑을 설정 파일에 선언 가능
- [x] wrapper 고유 DSL 없이 cao native provider/agent 개념을 그대로 사용

**Workflow Orchestration** — Validated in Phase 3: Plan→Review Orchestration Loop
- [x] `wrapper workflow <name>` / `wrapper workflow-run ...`로 planner→reviewer 반복 루프 실행 가능
- [x] reviewer 승인 여부는 `review.status.json`의 machine-readable 상태로만 판정
- [x] workflow artifact가 repo 내부 `.wrapper/workflows/` 아래에 보존됨
- [x] planner/reviewer role 선택을 config 또는 flag override로 제어 가능

### Active

**workmux 연동**
- [ ] 필요 시 worktree 기반 격리 작업 환경 생성 (workmux 활용)
- [ ] worktree 작업 완료 후 정리

**확장 워크플로우**
- [ ] cao가 기본 제공하지 않는 추가 inter-CLI workflow 패턴 확장
- [ ] 승인/수정 이외의 richer review outcomes 및 rerun UX 개선

**운영성**
- [ ] milestone audit / release 흐름을 더 자동화
- [ ] 실환경 provider 세션 초기화 프롬프트를 더 부드럽게 흡수

### Out of Scope

- cmux — 이번 범위에서 제외
- cao / tmux / workmux / ghostty / oh-my-zsh 자체 설치 — 사전 설치 전제
- registry-hub 구현 — 외부에서 병렬 개발, 이 래퍼는 URL 소비자로만 동작
- ghostty / oh-my-zsh 설정 — ghostty-tmux-wrapping 프로젝트 담당
- cao profile management 다운로드/lockfile 레이어 — 현재 milestone 범위 밖, 별도 레지스트리/프로파일 흐름으로 유지

## Context

- **cao**: [AWS Labs CLI Agent Orchestrator](https://github.com/awslabs/cli-agent-orchestrator) — 외부 툴. 이 래퍼는 cao를 설정하고 활용하는 레이어.
- **registry-hub + cao-profile-registry**: 별도 병렬 개발 중. Claude Code Marketplace처럼 MD 파일 또는 MD 포함 패키지를 제공하는 구조. 지금은 "특정 URL에서 파일을 내려주는 서비스"로만 가정.
- **현재 코드 상태**: 약 2,749 LOC(TypeScript/JS 기준). `setup`, alias dispatch, workflow config resolution, artifact/prompt helpers, CAO HTTP client, workflow runner, `workflow` / `workflow-run` CLI surface까지 구현 완료.
- **ghostty-tmux-wrapping**: 동일 작업자의 별도 프로젝트. base tmux 환경 담당. tmux conf 충돌 방지를 위해 모듈식 구조 협의 완료.

## Current State

- **Shipped version:** v1.0
- **Milestone status:** shipped and archived
- **Runtime coverage:** build, lint, full automated tests, named workflow smoke test, ad-hoc workflow smoke test
- **Operational note:** 실환경에서는 artifact 존재 여부를 workflow step 완료 신호로 취급해야 안정적임

## Next Milestone Goals

1. workmux 기반 격리 작업 환경 시작/정리 UX 추가
2. 추가 inter-CLI workflow 패턴 발굴 및 일반화
3. 실환경 provider session 초기화/enablement friction 감소

## Constraints

- **전제 조건**: cao, tmux, workmux는 이미 설치된 환경에서만 동작
- **tmux conf 비침습**: `~/.tmux.conf` 직접 수정 금지. `~/.config/tmux/ai-cli.conf`에만 작성하고 source 라인 한 줄만 추가
- **registry 결합 금지**: registry-hub URL은 설정값으로만 참조, 이 래퍼에 하드코딩 또는 의존 금지
- **이식성 우선**: 환경 상태는 이 레포 안에서 완전히 재현 가능해야 함

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| tmux conf 모듈식 분리 (`~/.config/tmux/ai-cli.conf`) | ghostty-tmux-wrapping과 `~/.tmux.conf` 소유권 충돌 방지 | — Pending |
| registry-hub 결합 금지 | registry-hub는 독립 프로젝트로 병렬 개발 중, 래퍼가 종속되면 양쪽 개발 속도에 영향 | — Pending |
| cmux 제외 | 이번 목표 범위에서 불필요 | — Pending |
| 현재 src/ 코드 재작성 | 기존 코드는 관련 없는 PoC | — Completed Phase 1 |
| wrapper DSL 미도입 | cao native workflow/provider 개념을 유지해야 portability와 상호운용성이 높음 | — Completed Phase 2 |
| workflow 완료 판정은 artifact 기준 | 실환경 CAO terminal state만으로는 조기 완료 오판 가능 | — Completed Phase 3 |
| planner/reviewer direct-write prompt 강화 | 실환경 provider가 먼저 파일을 쓰지 않으면 smoke test가 불안정해짐 | — Completed Phase 3 |

## Evolution

이 문서는 페이즈 전환 및 마일스톤 경계에서 진화한다.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-25 after v1.0 milestone completion*
