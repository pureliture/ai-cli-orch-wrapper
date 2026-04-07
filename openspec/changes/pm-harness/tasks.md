## 0. 선행 확인

- [x] 0.1 `package.json` workspace scripts/bin/prepack 이름 확인 — CI script 이름 고정 기준
- [x] 0.2 `gh auth status` 및 repo 권한 확인
- [x] 0.3 publish 대상 패키지 결정 — packages/wrapper, packages/installer 중 npm publish 대상과 public/private 여부 명시

## 1. GitHub 레이블 체계

- [x] 1.1 `scripts/setup-github-labels.sh` 작성 — type/area/priority/status 레이블 일괄 생성, 색상 그룹 적용 (중복 실행 idempotent 보장)
- [x] 1.2 스크립트 실행 및 레이블 생성 검증 (14개 레이블 생성 확인)
- [x] 1.3 기존 이슈에 레이블 소급 적용 (issue #6 → type:epic, area:wrapper, p1)

## 2. GitHub Projects V2 보드 설정

- [x] 2.1 Projects V2 생성 — #3 "ai-cli-orch-wrapper PM", Status 5단계 설정 (CLI)
- [x] 2.2 Priority(P0/P1/P2), Size(S/M/L), Target date 필드 추가 (CLI) — Sprint은 UI 필요
- [ ] 2.3 Active Sprint(Board), Triage(Table), Roadmap(Table) 3종 뷰 생성 — UI 필요
- [x] 2.4 `docs/pm-board.md` IDs 기록 완료 (PM_PROJECT_NUMBER=3, IDs 확정)

## 3. GitHub Actions CI 워크플로우

- [x] 3.0 0.1 결과 기반 CI npm scripts 존재 확인 및 누락 시 추가 (typecheck + format:check 추가됨)
- [x] 3.1 `.github/workflows/ci.yml` 작성 — lint job (prettier), `name:` 필드 고정
- [x] 3.2 ci.yml에 typecheck job 추가 — wrapper build 후 순차 typecheck
- [x] 3.3 ci.yml에 test job 추가 (`needs: [lint, typecheck]`)
- [x] 3.4 ci.yml에 smoke job 추가 (`needs: [test]`) — find로 tarball 탐색, prefix 설치
- [ ] 3.5 CI 워크플로우 PR로 검증 — 4개 job 모두 통과 확인
- [x] 3.6 ci.yml job `name:` 값 고정 확인 (lint/typecheck/test/smoke)

## 4. GitHub Actions Release 워크플로우

- [x] 4.1 `npx changeset init` 실행 — Fixed 모드, access: public 설정
- [x] 4.2 `.github/workflows/release.yml` 작성 — changesets 단독
- [x] 4.3 workflow permissions 명시 — `contents: write`, `pull-requests: write`, NPM_TOKEN 설정
- [x] 4.4 GITHUB_TOKEN repo 스코프 확인 — changesets PR 생성 가능, 브랜치 보호 없으므로 PAT 불필요

## 5. PR 템플릿 및 브랜치 보호

- [x] 5.1 `.github/PULL_REQUEST_TEMPLATE.md` 작성 — CI passes, Closes #N, openspec 링크 체크박스
- [ ] 5.2 GitHub UI에서 브랜치 보호 규칙 설정 — lint/typecheck/test/smoke 필수, Squash-merge 강제

## 6. Claude Code 명령어

- [x] 6.1 `.claude/commands/pm-triage.md` 작성 — 미분류 이슈 조회 + 레이블 제안 흐름
- [x] 6.2 `.claude/commands/pm-status.md` 작성 — 스프린트 현황 요약

## 7. Claude Code Hooks

- [x] 7.0 Claude Code PostToolUse 훅 payload 형식 검증 — stdin JSON, tool_input.command 확인
- [x] 7.1 브랜치 이름 이슈 번호 추출 규칙 정의 — `feat/42-slug` 패턴 고정
- [x] 7.2 `scripts/pm-hook.sh` 작성 — gh pr create 감지, project item add→edit, fast path
- [x] 7.3 `.claude/settings.json` PostToolUse(Bash) 훅 추가 — async, 15s timeout
- [x] 7.4 훅 동작 검증 — read 버그 수정 후 dry-run 4종 통과 (config not set, non-Bash, non-pr-create, echo 감지 안 됨)
- [x] 7.5 훅 실패 시 exit 0 무시 검증 — 모든 케이스 exit 0 확인, stderr warning 출력
