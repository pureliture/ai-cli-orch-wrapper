## Why

ai-cli-orch-wrapper는 현재 개발 운영 체계(이슈 추적, CI/CD, 릴리즈 자동화)가 없어 작업 가시성이 낮고 품질 게이트가 수동으로 관리된다. GitHub Projects + Actions + Claude Code를 조합한 경량 PM 하네스를 구축해 개발 흐름을 체계화하고 안정성을 확보한다.

## What Changes

- **GitHub 레이블 체계 신설**: type/area/priority/status 레이블 일괄 생성 스크립트 추가
- **GitHub Projects V2 구성**: Status/Priority/Size/Sprint 필드와 3종 뷰 정의
- **GitHub Actions CI 워크플로우 추가**: lint → typecheck → test → smoke (별도 job) 파이프라인
- **GitHub Actions Release 워크플로우 추가**: release-drafter + changesets 기반 npm 릴리즈 자동화
- **Claude Code 명령어 추가**: `/pm-triage`, `/pm-status` (.claude/commands/)
- **Claude Code 훅 추가**: git checkout -b / gh pr create 감지 → 이슈 상태 자동 이동
- **PR 템플릿 추가**: CI 체크박스 + 이슈 링크 + openspec 정렬 체크
- **브랜치 보호 규칙 정의**: Squash-merge 강제, 필수 상태 체크 4종

## Capabilities

### New Capabilities

- `github-label-setup`: GitHub 레이블 체계 일괄 생성 및 표준화
- `github-projects-board`: Projects V2 필드/뷰 구성 정의
- `ci-pipeline`: PR 게이트용 GitHub Actions CI 워크플로우
- `release-pipeline`: main 머지 후 자동 changelog + npm publish 워크플로우
- `claude-pm-commands`: Claude Code 프로젝트 관리 슬래시 명령어
- `claude-pm-hooks`: Claude Code settings.json PostToolUse 훅

### Modified Capabilities

<!-- 기존 스펙 변경 없음 — 순수 인프라/운영 추가 -->

## Impact

- **추가 파일**: `scripts/setup-github-labels.sh`, `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `.github/release-drafter.yml`, `.github/PULL_REQUEST_TEMPLATE.md`, `.claude/commands/pm-triage.md`, `.claude/commands/pm-status.md`
- **수정 파일**: `.claude/settings.json` (hooks 추가)
- **aco 바이너리 코드**: 변경 없음
- **외부 의존성**: `changesets` (npm), `release-drafter` (GitHub App)
- **AI 리뷰**: GitHub Copilot + Codex가 이미 PR 리뷰 담당 — 별도 구현 불필요
