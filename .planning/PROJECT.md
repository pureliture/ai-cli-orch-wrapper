# ai-cli-orch-wrapper

## What This Is

어느 PC에서나 단일 명령어로 동일한 AI CLI 오케스트레이션 환경을 재현할 수 있는 개인용 래퍼 툴.
cao(AWS Labs CLI Agent Orchestrator) + tmux + workmux를 조합하여 Claude Code, Gemini CLI, Codex, Copilot CLI 등 여러 AI CLI를 워크플로우 역할(오케스트레이터, 리뷰어, 플래너 등)에 따라 지정하고 협력시킬 수 있다.

## Core Value

어느 PC로 옮겨도 단일 명령어 하나로 동일한 AI CLI 오케스트레이션 환경이 즉시 복원되어야 한다.

## Requirements

### Validated

**Setup** — Validated in Phase 1: Foundation + Environment Setup
- [x] 단일 명령어로 전체 환경 셋업 완료 (tmux conf 병합 포함)
- [x] `~/.config/tmux/ai-cli.conf` 생성 및 base tmux conf에 source 라인 추가 (최소 침습)
- [x] 이미 설치된 cao / tmux / workmux를 전제로 동작 (직접 설치 불포함)

### Active

**Setup** — moved to Validated (Phase 1 complete)

**AI CLI 오케스트레이션**
- [ ] 워크플로우별 오케스트레이터 CLI 지정 가능 (e.g. 이 작업은 Claude Code가 오케스트레이터)
- [ ] 워크플로우 역할(리뷰어, 플래너, 익스큐터 등)에 CLI 매핑 가능
- [ ] Claude Code, Gemini CLI, Codex, Copilot CLI 지원

**워크플로우**
- [ ] 개발 후 다른 CLI가 리뷰를 수행하는 워크플로우
- [ ] Plan 모드: A CLI 플래닝 → B CLI 검토 → A CLI 수정 → B CLI 재검토 반복 루프
- [ ] CLI 간 메시지/결과 전달 (적극적 통신)
- [ ] 워크플로우 정의를 추가/확장할 수 있는 구조

**workmux 연동**
- [ ] 필요 시 worktree 기반 격리 작업 환경 생성 (workmux 활용)
- [ ] worktree 작업 완료 후 정리

**cao 프로파일 관리**
- [ ] registry URL에서 cao 프로파일(MD 파일/패키지) 다운로드
- [ ] 다운로드한 프로파일 로컬 관리 (lockfile 기반)
- [ ] registry-hub는 외부 URL로만 참조 (이 래퍼와 결합 금지)

### Out of Scope

- cmux — 이번 범위에서 제외
- cao / tmux / workmux / ghostty / oh-my-zsh 자체 설치 — 사전 설치 전제
- registry-hub 구현 — 외부에서 병렬 개발, 이 래퍼는 URL 소비자로만 동작
- ghostty / oh-my-zsh 설정 — ghostty-tmux-wrapping 프로젝트 담당

## Context

- **cao**: [AWS Labs CLI Agent Orchestrator](https://github.com/awslabs/cli-agent-orchestrator) — 외부 툴. 이 래퍼는 cao를 설정하고 활용하는 레이어.
- **registry-hub + cao-profile-registry**: 별도 병렬 개발 중. Claude Code Marketplace처럼 MD 파일 또는 MD 포함 패키지를 제공하는 구조. 지금은 "특정 URL에서 파일을 내려주는 서비스"로만 가정.
- **현재 src/ 코드**: registry downloader PoC — 이번 목표와 무관, 재작성 대상.
- **ghostty-tmux-wrapping**: 동일 작업자의 별도 프로젝트. base tmux 환경 담당. tmux conf 충돌 방지를 위해 모듈식 구조 협의 완료.

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
*Last updated: 2026-03-24 after Phase 1 completion*
