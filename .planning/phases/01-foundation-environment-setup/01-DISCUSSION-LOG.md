# Phase 1: Foundation + Environment Setup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 01-foundation-environment-setup
**Areas discussed:** src/ rewrite scope, tmux bootstrap edge cases, Prereq error format, Idempotency signal, First-run output, Phase 1 config scaffolding

---

## src/ Rewrite Scope

| Option | Description | Selected |
|--------|-------------|----------|
| 완전 재작성 | download.ts, lockfile.ts, types.ts, index.ts 전부 삭제. cli.ts도 새로 작성. | ✓ |
| download 커맨드 유지 + setup 추가 | 기존 download 커맨드는 그대로 두고 setup을 추가. | |
| 별도 브랜치로 아카이브 | 현재 코드를 archive/download-poc 브랜치로 보존 후 main에서 재작성. | |

**User's choice:** 완전 재작성
**Notes:** src/index.ts (라이브러리용 barrel export)도 삭제 — 이 프로젝트는 CLI 툴 전용.

---

## tmux Bootstrap Edge Cases

| Option | Description | Selected |
|--------|-------------|----------|
| 자동 생성 | ~/.tmux.conf가 없으면 source 라인만 담은 빈 파일로 새로 만들고 진행. | ✓ |
| 에러 후 안내 | ~/.tmux.conf가 없으면 멈춰서 메시지 출력. | |

**User's choice:** 자동 생성
**Notes:** 사용자 피드백: "tmux 자체가 설치 안 됐다는거 아닌가? 필요한 설치 프로그램들이 다 설치됐는지를 한번에 검사하는게 빠르겠다" — prereq 체크(SETUP-03)가 먼저 tmux 존재를 확인하므로 이 엣지케이스는 prereq 체크 통과 후에만 발생. 자동 생성이 자연스러운 처리.

**ai-cli.conf 초기 내용:**

| Option | Description | Selected |
|--------|-------------|----------|
| 코멘트 헤더만 | Phase 2에서 내용 채움. 지금은 placeholder. | ✓ |
| 실제 키바인딩 등 내용 포함 | Phase 1에서 미리 유용한 tmux 설정도 함께 씀. | |

**User's choice:** 코멘트 헤더만

---

## Prereq Error Format

| Option | Description | Selected |
|--------|-------------|----------|
| 도구명 + 설치 안내 URL | 도구마다 install URL 포함. | |
| 도구명만 | `Error: missing prerequisites: cao, workmux` — 리스트만 출력. | ✓ |

**User's choice:** 도구명만

---

## Idempotency Signal

| Option | Description | Selected |
|--------|-------------|----------|
| Already configured 메시지 + 종료 | source 라인이 이미 있으면 "Already configured" 한 줄 출력 후 exit 0. | |
| 실행 후 상태 요약 출력 | 매번 실행 시 전체 상태 확인 후 [✓] 체크마크 형식으로 요약 출력. | ✓ |

**User's choice:** 실행 후 상태 요약 출력

---

## First-Run 성공 출력

| Option | Description | Selected |
|--------|-------------|----------|
| [✓] 요약 동일하게 | 첫 실행도 [✓] 체크마크 요약으로. 재실행과 동일한 UX. | ✓ |
| 짧은 성공 메시지 | 확인 없이 'Setup complete.' 한 줄. | |

**User's choice:** [✓] 요약 동일하게

---

## Phase 1에서 Config 파일 스캐폴딩

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 2에 맡김 | Phase 1은 tmux conf 훅에만 집중. config 파일은 Phase 2가 시작할 때 생성. | ✓ |
| Phase 1에서 stub 생성 | wrapper setup이 빈 config 파일을 현재 디렉토리에 생성. | |

**User's choice:** Phase 2에 맡김

---

## Claude's Discretion

- PATH lookup 구현 방식 (child_process vs spawnSync)
- source-file vs source 라인 형식
- ~/.config/tmux/ 디렉토리 없을 시 자동 생성 처리

## Deferred Ideas

- wrapper config 파일 (CLI alias/role 매핑) — Phase 2
- ai-cli.conf 실제 tmux 내용 채우기 — Phase 2
- wrapper worktree 서브커맨드 — Phase 2/v2
