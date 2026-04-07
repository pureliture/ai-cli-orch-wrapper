## Context

현재 PM 워크플로우는 Claude Code 세션에서 자연어로 수동 실행된다. 이슈 생성, 보드 상태 전환, 브랜치 생성, PR 생성, 리뷰 후속 이슈 작성이 세션마다 다른 방식으로 실행되어 보드 상태 불일치와 컨텍스트 낭비를 초래한다.

프로젝트는 이미 두 축의 slash command 체계를 갖는다: `/opsx:*` (설계/스펙), `/octo:*` (AI 오케스트레이션). 이번 변경은 세 번째 축인 `/gh-*` (GitHub 추적)를 추가해 설계 → 구현 추적 → AI 검증 루프를 slash command만으로 완성한다.

**관련 자원:**
- GitHub Project #3: `PVT_kwHOA6302M4BT5fA`
- Status field ID: `PVTSSF_lAHOA6302M4BT5fAzhBFN48`
- In Progress option ID: `68368c4f` (Gemini가 실제 API로 확인)
- Repo: `pureliture/ai-cli-orch-wrapper`

## Goals / Non-Goals

**Goals:**
- 4개 base commands + 4개 `:multi` variants를 `templates/commands/` 아래 Markdown 파일로 구현
- 각 커맨드는 `gh` CLI 호출 시퀀스만 포함 — 분기 로직 없음
- 이슈 제목 컨벤션을 conventional commit 형식으로 전환 (V3부터)
- `sprint:v3`, `sprint:v4`, `origin:review` 레이블을 idempotent하게 추가
- non-ASCII (한국어) 이슈 제목에서 안전한 branch slug 생성

**Non-Goals:**
- 커맨드의 범용화 (다른 레포 지원)
- Epic 체크박스 자동 업데이트 (파싱 취약 — reminder 메시지로 대체)
- 기존 이슈 제목 일괄 마이그레이션
- `gh` CLI 인증 관리

## Decisions

### D1. 커맨드 구현 방식: Markdown slash command 파일
**결정**: `templates/commands/*.md` 파일에 `gh` CLI 호출 시퀀스 직접 작성.

**Why**: Claude Code가 Markdown 파일을 slash command로 로드하는 기존 패턴 유지. bash 스크립트 별도 파일 불필요 — CLAUDE.md의 "Keep command template markdown files thin" 원칙과 일치.

**Alternatives**: bash script + wrapper md → 불필요한 파일 증가, 경로 취약.

### D2. :multi variants 디렉토리 구조
**결정**: `templates/commands/gh-issue/multi.md` 형태의 서브디렉토리. 설치 시 `.claude/commands/gh-issue/multi.md`로 복사되어 Claude Code에서 `:`를 디렉토리 구분자로 인식해 `/gh-issue:multi`로 호출.

**Why**: 3개 provider 합의. 기존 `:multi` suffix 패턴과 일치 (`/gh-issue:multi` = 의도가 명확한 invoation).

### D3. Project ID 하드코딩
**결정**: 커맨드 파일에 `PM_PROJECT_ID`와 `PM_STATUS_FIELD_ID`를 직접 하드코딩.

**Why**: Gemini가 실제 API로 ID를 확인 완료. ENV var 분리는 유지보수성을 높이지만 커맨드 파일 내 `$PM_PROJECT_ID` 참조 시 Claude Code의 shell 변수 보간 동작이 보장되지 않음. 이슈 본문의 "hardcode 허용" 결정과 일치. 프로젝트 재생성 시 ID 변경은 grep으로 1-pass 수정 가능.

### D4. Branch slug 생성 (non-ASCII 처리)
**결정**: `/gh-start` 커맨드에서 이슈 제목을 `iconv` + `sed`로 ASCII slug로 변환.

```bash
# 제목: "feat: add /gh-* pm workflow commands"
TITLE=$(gh issue view $N --repo pureliture/ai-cli-orch-wrapper --json title -q .title)
SLUG=$(echo "$TITLE" | sed 's/^[a-z]*: //' | iconv -t ASCII//TRANSLIT | \
  tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/-\+/-/g' | sed 's/^-\|-$//g' | cut -c1-40)
BRANCH="${TYPE}/${N}-${SLUG}"
```

**Why**: 한국어/특수문자 이슈 제목이 존재하는 프로젝트에서 `iconv -t ASCII//TRANSLIT`이 가장 안전. Codex가 명시적으로 risk로 제기.

### D5. 이슈 제목 컨벤션 전환
**결정**: V3부터 `feat: description` 형식으로 즉시 전환. 기존 이슈 마이그레이션 없음.

**Why**: Sonnet이 실제 이슈 #24의 `[Sprint V3.2]` 제목 변경 비용을 직접 확인 후 즉시 전환 지지. sprint/type 정보는 `sprint:v3`, `type:task` 레이블로 완전 분리.

### D6. Labels idempotency
**결정**: `setup-github-labels.sh`에서 `gh label create --force` 사용. 존재해도 실패 없이 upsert.

**Why**: `--force` flag는 동일 이름 레이블 존재 시 업데이트(색상/설명 동기화). Codex가 재실행 안전성을 명시적 risk로 제기.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| GitHub Projects v2 CLI API 변경 (field/option ID 변경) | 커맨드 파일 상단에 ID 상수 주석으로 명시 → grep으로 일괄 수정 |
| Branch slug 충돌 (동일 prefix 이슈 다수) | slug에 이슈 번호 포함 (`N-slug`) → 충돌 원천 차단 |
| `:multi` variants가 `/octo:multi` 미설치 환경에서 실패 | multi.md 첫 줄에 prerequisite 안내 메시지 포함 |
| 이슈 제목 컨벤션 drift (레거시 형식 혼재) | `/gh-issue` 커맨드가 제목 형식을 enforce하는 안내 포함 |
| Epic 체크박스 자동 업데이트 미지원 | `/gh-pr` body에 수동 처리 reminder 명시 |

## Migration Plan

1. `scripts/setup-github-labels.sh` 업데이트 후 실행 → 레이블 동기화
2. `templates/commands/gh-*.md` 파일 생성 → `aco-install pack install`로 `.claude/commands/`에 설치
3. V3 이후 신규 이슈부터 conventional commit 형식 적용 (기존 이슈 변경 없음)
4. `docs/pm-board.md` 업데이트로 팀 공유

**Rollback**: `templates/commands/gh-*.md` 파일 삭제 후 재설치 → slash command 비활성화. 레이블은 남아있어도 무해.

## Open Questions

- (없음 — 3개 provider 합의로 모든 주요 결정 확정)
