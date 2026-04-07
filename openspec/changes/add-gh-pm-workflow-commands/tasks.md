## 1. Infrastructure: Labels

- [x] 1.1 `scripts/setup-github-labels.sh`에 `sprint:v3` 레이블 추가 (`--force`, color: `E9D5FF`)
- [x] 1.2 `scripts/setup-github-labels.sh`에 `sprint:v4` 레이블 추가 (`--force`, color: `E9D5FF`)
- [x] 1.3 `scripts/setup-github-labels.sh`에 `origin:review` 레이블 추가 (`--force`, color: `BFDBFE`)
- [x] 1.4 `bash scripts/setup-github-labels.sh` 실행 후 GitHub에서 레이블 3종 존재 확인

## 2. Base Commands: /gh-issue

- [x] 2.1 `templates/commands/gh-issue.md` 생성 — `gh issue create` + 레이블 + Project #3 Backlog 배정 (`gh project item-add`)
- [x] 2.2 커맨드 파일에 conventional commit 제목 형식 안내 포함
- [x] 2.3 Epic 연결 옵션 (Parent epic: #N) 본문 포함 로직 추가

## 3. Base Commands: /gh-start

- [x] 3.1 `templates/commands/gh-start.md` 생성 — 이슈 번호 인자 파싱, `gh issue view` 제목 조회
- [x] 3.2 branch slug 생성 로직 포함: `iconv -t ASCII//TRANSLIT` + sed로 non-ASCII 처리, 40자 truncation
- [x] 3.3 `gh project item-edit` — Project #3 Status → In Progress (`68368c4f`)
- [x] 3.4 `gh issue edit --add-label status:in-progress` 포함
- [x] 3.5 `git checkout -b <type>/<N>-<slug>` 브랜치 생성 포함

## 4. Base Commands: /gh-pr

- [x] 4.1 `templates/commands/gh-pr.md` 생성 — `gh pr create` + conventional commit 제목
- [x] 4.2 PR body에 `Closes #N` 포함
- [x] 4.3 PR body에 CI checklist 포함 (`npm test`, manual smoke, docs check)
- [x] 4.4 PR body에 Epic 체크박스 수동 처리 reminder 포함

## 5. Base Commands: /gh-followup

- [x] 5.1 `templates/commands/gh-followup.md` 생성 — PR 번호 인자 파싱
- [x] 5.2 `origin:review` + `type:*` 레이블 조합으로 이슈 생성
- [x] 5.3 이슈 body 첫 줄에 `From: #<PR_NUMBER> review comment` 포함
- [x] 5.4 이슈 body에 `See also: #<PR_NUMBER>` 링크 포함
- [x] 5.5 Project #3 Backlog 자동 배정 포함

## 6. Multi Variants

- [x] 6.1 `templates/commands/gh-issue/multi.md` 생성 — `/octo:multi` 안내 후 `/gh-issue` 진행 안내
- [x] 6.2 `templates/commands/gh-start/multi.md` 생성 — `/octo:multi` 안내 후 `/gh-start` 진행 안내
- [x] 6.3 `templates/commands/gh-pr/multi.md` 생성 — PR readiness 검증 후 `/gh-pr` 진행 안내
- [x] 6.4 `templates/commands/gh-followup/multi.md` 생성 — followup 내용 검증 후 `/gh-followup` 진행 안내
- [x] 6.5 각 multi.md에 `/octo:multi` 미설치 시 안내 메시지 포함

## 7. Documentation

- [x] 7.1 `docs/pm-board.md`에 `/gh-*` 커맨드 계열 구조 표 추가 (`/opsx:*`, `/gh-*`, `/octo:*` 3축)
- [x] 7.2 `docs/pm-board.md`에 이슈 제목 신규 컨벤션 섹션 추가 (conventional commit 형식, V3부터 적용)
- [x] 7.3 `docs/pm-board.md`에 `origin:review` 레이블 사용 가이드 추가

## 8. Verification

- [ ] 8.1 `/gh-issue` 호출 → 이슈 생성 및 Project Backlog 배정 확인
- [ ] 8.2 `/gh-start #N` 호출 → In Progress 전환 + 브랜치 생성 확인 (한국어 제목 포함)
- [ ] 8.3 `/gh-pr` 호출 → PR 생성 및 Closes #N 포함 확인
- [ ] 8.4 `/gh-followup` 호출 → origin:review 레이블 + From: 본문 확인
- [ ] 8.5 `/gh-issue:multi` 호출 → 안내 메시지 출력 확인
