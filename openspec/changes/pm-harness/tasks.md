## 0. 선행 확인

- [ ] 0.1 `package.json` workspace scripts/bin/prepack 이름 확인 — CI script 이름 고정 기준
- [ ] 0.2 `gh auth status` 및 repo 권한 확인
- [ ] 0.3 publish 대상 패키지 결정 — packages/wrapper, packages/installer 중 npm publish 대상과 public/private 여부 명시

## 1. GitHub 레이블 체계

- [ ] 1.1 `scripts/setup-github-labels.sh` 작성 — type/area/priority/status 레이블 일괄 생성, 색상 그룹 적용 (중복 실행 idempotent 보장)
- [ ] 1.2 스크립트 실행 및 레이블 생성 검증 (`gh label list`)
- [ ] 1.3 기존 이슈에 레이블 소급 적용 (해당 이슈 있는 경우)

## 2. GitHub Projects V2 보드 설정

- [ ] 2.1 GitHub UI에서 Projects V2 생성 — Status 5단계 옵션 설정
- [ ] 2.2 Priority(P0/P1/P2), Size(S/M/L), Sprint(Iteration), Target date 필드 추가
- [ ] 2.3 Active Sprint(Board), Triage(Table), Roadmap(Table) 3종 뷰 생성
- [ ] 2.4 `docs/pm-board.md`에 project number, Status/Priority field id, 각 option id 기록 — 훅 구현 선행 조건

## 3. GitHub Actions CI 워크플로우

- [ ] 3.0 0.1 결과 기반 CI npm scripts 존재 확인 및 누락 시 추가
- [ ] 3.1 `.github/workflows/ci.yml` 작성 — lint job (eslint + prettier), `name:` 필드 고정
- [ ] 3.2 ci.yml에 typecheck job 추가 — wrapper → installer 순차, `tsc --build` 방식으로 의존성 해결
- [ ] 3.3 ci.yml에 test job 추가 (`needs: [lint, typecheck]`)
- [ ] 3.4 ci.yml에 smoke job 추가 (`needs: [test]`) — `npm pack --json | jq -r '.[].filename'`으로 tarball 동적 탐색, `npm install --prefix $RUNNER_TEMP/aco-install` + PATH 주입
- [ ] 3.5 CI 워크플로우 PR로 검증 — 4개 job 모두 통과 확인
- [ ] 3.6 ci.yml job `name:` 값과 branch protection required check 이름 일치 확인

## 4. GitHub Actions Release 워크플로우

- [ ] 4.1 `npx changeset init` 실행 — changesets 초기화, Fixed/Independent 모드 결정 (동기화 권장)
- [ ] 4.2 `.github/workflows/release.yml` 작성 — changesets 단독으로 시작 (release-drafter 미포함)
- [ ] 4.3 workflow permissions 명시 — `contents: write`, `pull-requests: write`, npm publish용 `NPM_TOKEN` secret 설정
- [ ] 4.4 GITHUB_TOKEN으로 changesets version PR 생성 가능 여부 확인 — 불가 시 PAT 사용

## 5. PR 템플릿 및 브랜치 보호

- [ ] 5.1 `.github/PULL_REQUEST_TEMPLATE.md` 작성 — CI passes, Closes #N, openspec 링크 체크박스
- [ ] 5.2 GitHub UI에서 브랜치 보호 규칙 설정 — lint/typecheck/test/smoke 필수, Squash-merge 강제

## 6. Claude Code 명령어

- [ ] 6.1 `.claude/commands/pm-triage.md` 작성 — 미분류 이슈 조회 + 레이블 제안 흐름
- [ ] 6.2 `.claude/commands/pm-status.md` 작성 — 스프린트 현황 요약

## 7. Claude Code Hooks

- [ ] 7.0 Claude Code PostToolUse 훅 payload 형식 검증 — 환경변수명·형식 확인 후 fixture 문서화 (이 결과 없이 7.1 진행 금지)
- [ ] 7.1 브랜치 이름 이슈 번호 추출 규칙 정의 — `feat/42-slug` 패턴 고정
- [ ] 7.2 `scripts/pm-hook.sh` 작성 — **1차: `gh pr create` 감지만 구현** (git checkout 훅은 2차로 유예), Project item add-item → status update 순서, 이슈 번호 없으면 즉시 exit 0
- [ ] 7.3 `.claude/settings.json` PostToolUse(Bash) 훅 추가 — 기존 hooks 보존(merge), fast path(비대상 명령어 즉시 exit)
- [ ] 7.4 훅 동작 검증 — `gh pr create` 실행 시 이슈 In Review 이동 확인
- [ ] 7.5 훅 실패 시 exit 0 무시 동작 검증, 잘못된 repo/project 방지를 위해 `git remote get-url origin` 검증 포함
