# GitHub Kanban Workflow — 확정 행동 계획

> 작성: 2026-04-07, Multi-Provider Review (Codex + Gemini + Claude) 기반

## 즉시 실행 (v3 스프린트 내)

| 순위 | 액션 | 방법 | 비고 |
|------|------|------|------|
| 🔴 1 | **smoke `\|\| true` 제거** | `ci.yml` 수정 | 비용 0, CI silent failure 차단 |
| 🔴 2 | **PR 머지 → 이슈 Done** | GitHub Projects V2 내장 Workflow 설정 | 코드 없이 해결 |
| 🟡 3 | **이슈 생성 → Backlog 자동 배정** | GitHub Projects Auto-add Workflow | 코드 없이 해결 |
| 🟡 4 | **Epic Tasklist 전환** | Epic body에 `- [ ] #N` 형식 채택 | UI 진행 바 무료 제공 |
| 🟠 5 | **pm-hook.sh → GitHub Actions 이관** | `on: pull_request: types: [closed]` | hook은 Claude 실행 중에만 동작, GH Actions로 이관 시 항상 보장 |

## 보류 (장기)

- **OpenSpec-GitHub 양방향 동기화**: `aco` 제품 기능이 아닌 개발 과정 tooling — 별도 스크립트 또는 GitHub Actions으로 구현
- **Sentinel / Hygiene Bot**: 스프린트 마감 임박 stale 이슈/PR 감지
- **Velocity 대시보드**: Size(S/M/L) 기반 번다운

## 검토 필요

- Issue 생성 체계 (서브 이슈 구조, 제목 규칙)
- PR 생성 체계 (Closes #N, project 연결, PR 명)
- PR 리뷰 코멘트 → 후속 이슈 분리 후 머지 패턴
- 신규 요구사항 추가 시 overall 시나리오 (V3 기준)
