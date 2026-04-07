## Context

ai-cli-orch-wrapper는 npm workspace 구조(packages/wrapper, packages/installer, templates/)의 TypeScript 프로젝트다. 현재 CI/CD 워크플로우, 이슈 추적 체계, 릴리즈 자동화가 없다. Claude Code가 유일한 관리 도구이며, GitHub Copilot + Codex가 PR 리뷰를 담당한다. 모든 구성 요소는 이벤트 드리븐(GitHub Actions) 또는 훅 기반(Claude Code settings.json)으로 동작해야 하며 aco 바이너리 수정은 없다.

## Goals / Non-Goals

**Goals:**
- GitHub Issues/Projects를 Jira 방식(Epic/Story/Task/Bug)으로 운영할 수 있는 레이블 + 보드 체계 구축
- PR마다 lint/typecheck/test/smoke 4종 게이트를 자동으로 통과해야만 머지 허용
- main 머지 시 changelog 생성 + npm 패키지 자동 릴리즈
- Claude Code 명령어로 이슈 트리아지/스프린트 현황을 CLI에서 즉시 확인
- git checkout/pr create 감지 시 이슈 상태를 자동으로 이동

**Non-Goals:**
- aco 바이너리 코드 변경
- sentinel 기반 데몬 모니터링
- 리뷰 코멘트 → 자동 수정 → resolved 루프 (추후 구현)
- AI 리뷰 에이전트 별도 구현 (Copilot/Codex가 담당)
- GitHub Projects V2 필드를 API로 자동 생성 (UI 수동 설정)

## Decisions

### 1. 전체 CI vs 선택적 CI (path filter)
**결정: 전체 CI 실행**

4개 AI 토론 전원 합의. npm workspace 의존성 전파로 인해 path filter는 조용한 회귀를 허용할 위험이 있다. 패키지 2개 규모에서 실행 시간 차이는 무의미하다.

**대안**: `dorny/paths-filter` 액션으로 패키지별 선택 실행 → 패키지 5개 이상 시 재검토.

### 2. npm workspace 실행 순서
**결정: 순차 실행 (wrapper → installer)**

병렬 매트릭스는 빌드 아티팩트 경합 + 캐시 충돌로 간헐적 실패 위험. wrapper 빌드 결과를 installer가 참조하므로 순서 의존성이 있다.

```yaml
run: |
  npm run -w packages/wrapper typecheck
  npm run -w packages/installer typecheck
```

**대안**: `strategy.matrix` 병렬 실행 → 패키지 수 증가 시 재검토.

### 3. smoke test 위치
**결정: 별도 job 분리 (`needs: [test]`)**

단위 테스트 실패 vs 바이너리 패키징 실패를 즉시 구분하기 위해 분리. GitHub Actions UI에서 job 단위로 실패를 식별할 수 있다.

**smoke 구현 방식**: `npm pack --workspaces` → 실제 설치 → `aco --version` 실행. dist/ 직접 실행이 아니라 사용자 설치 경로를 재현한다.

```bash
npm pack --workspaces --pack-destination /tmp/aco-pack
npm install -g /tmp/aco-pack/aco-wrapper-*.tgz
aco --version
aco run --help
```

### 4. 릴리즈 파이프라인
**결정: changesets (버전 관리) + release-drafter (changelog)**

4개 AI 토론 전원 합의. semantic-release는 커밋 메시지 컨벤션 하나 실수하면 버전이 잘못 올라간다. changesets는 명시적 파일(.changeset/*.md)로 의도를 기록해 실수를 즉시 파악할 수 있다. release-drafter는 레이블 기반 changelog 생성 보조 역할.

**역할 분리**:
- `changesets`: 버전 결정권자 (semver bump)
- `release-drafter`: changelog 서기 (PR 레이블 기반 카테고리 분류)

**대안**: `semantic-release` 단독 → 컨벤션 의존도 리스크로 제외.

### 5. Claude Code 훅 전략
**결정: PostToolUse(Bash) 패턴 매칭**

`git checkout -b`와 `gh pr create` 명령어를 감지해 이슈 상태를 자동 이동한다. 훅은 shell 스크립트를 실행하며 `gh` CLI로 Projects V2 상태를 업데이트한다.

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Bash",
      "hooks": [{"type": "command", "command": "scripts/pm-hook.sh"}]
    }]
  }
}
```

`pm-hook.sh`는 실행된 bash 명령어를 환경변수로 받아 패턴 매칭 후 `gh project item-edit`을 호출한다.

**제약**: Claude Code PostToolUse 훅은 bash 명령어 전체 문자열을 환경변수로 전달받는다. 명령어 파싱이 필요하며 오탐 가능성을 고려해 실패 시 무시(exit 0)해야 한다.

### 6. 브랜치 보호 필수 체크
**결정: lint + typecheck + test + smoke 전부 필수, publish/changelog 제외**

Sonnet이 정확히 짚은 점: release-drafter와 changesets publish는 main push 이후 트리거되므로 PR 필수 체크로 걸면 머지 자체가 차단된다.

## Risks / Trade-offs

| 리스크 | 완화 방안 |
|--------|-----------|
| `pm-hook.sh` 패턴 매칭 오탐 → 이슈 상태 잘못 이동 | 훅 실패 시 exit 0으로 무시, 이슈 번호 없으면 스킵 |
| changesets PR 생성 봇과 브랜치 보호 충돌 | changesets GitHub App에 bypass 권한 부여 |
| smoke test에서 global install 권한 문제 (CI 환경) | `--prefix` 로컬 설치로 대체 또는 `npx` 직접 실행 |
| GitHub Projects V2 필드를 API로 자동화 불가 | 초기 1회 UI 수동 설정 + 설정 스크린샷을 docs에 보존 |
| release-drafter + changesets 중복 버전 관리 | changesets가 버전 결정, release-drafter는 changelog만 담당으로 역할 명시 |

## Migration Plan

1. `scripts/setup-github-labels.sh` 실행 → 레이블 일괄 생성
2. GitHub Projects V2 UI에서 필드 수동 설정
3. `.github/workflows/ci.yml` 머지 → CI 활성화
4. `.github/workflows/release.yml` + `.github/release-drafter.yml` 머지 → 릴리즈 활성화
5. `changesets` 초기화 (`npx changeset init`)
6. `.claude/settings.json` 훅 추가
7. `.claude/commands/` 명령어 파일 추가
8. GitHub 브랜치 보호 규칙 UI에서 설정

**롤백**: 워크플로우 파일 삭제, 훅 제거로 즉시 원상복구. 레이블/Projects는 유지해도 무방.

## Open Questions

- `pm-hook.sh`가 받는 환경변수 정확한 형식 확인 필요 (Claude Code PostToolUse 훅 문서)
- changesets GitHub App 설치 필요 여부 vs `GITHUB_TOKEN` 직접 사용 가능 여부
- GitHub Projects V2 필드를 `gh` CLI로 자동 생성 가능한지 추가 조사 필요
