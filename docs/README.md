# 문서

이 디렉터리는 `ai-cli-orch-wrapper` 저장소의 문서를 **누가 왜 읽는가**에 따라
분류해 관리한다. 문서를 추가할 때는 아래 기준에 따라 적절한 위치를 선택한다.

## 현재 상태 요약

`ai-cli-orch-wrapper`는 Claude Code 세션 안에서 사용자의 명시적 동의를 받은 뒤
Codex/Antigravity 같은 외부 AI CLI에 작업을 위임하고, 결과는 session/run artifact로 저장하며,
Claude Code에는 bounded brief만 반환해 토큰 사용량을 줄이는 generic external AI delegation
wrapper다. Claude Code는 supervisor이자 final synthesizer로 남고, 외부 provider 출력은
advisory로 취급한다.

현재 구현된 표면은 Node wrapper CLI의 pack/provider setup, `aco sync`와 Go delegate runtime의
blocking provider 실행 실험으로 나뉜다. 사용자 진입점은 Claude Code의 `/aco <자연어 작업>`,
Codex의 `$aco <자연어 작업>`이며, 내부적으로 `aco ask`/`aco run` 등 하부 CLI plumbing이 실행된다.
MVP에서 기본 provider는 no-auth `mock`이며, real Codex/Antigravity provider는 자연어로 명시했을
때 선택된다.

현재 문서는 프로젝트의 재포지셔닝과 개선 계획도 함께 담고 있다. 현재 Goal 2 hardening의
구현 기준과 검증 증거는 [plans/consent-gated-delegation-hardening/](plans/consent-gated-delegation-hardening/)에
두고, 이전 PR 분할 기준은 [pr-implementation-plan.md](pr-implementation-plan.md)에 역사적 실행 계획으로
보존한다. 원문 제안은 [archive/2026-04-24-gpt-pro-direction-raw.md](archive/2026-04-24-gpt-pro-direction-raw.md)에
보존한다.

문서 역할은 다음처럼 나눈다. `roadmap.md`는 방향과 우선순위, `plans/`는 현재 목표별
spec/plan/review/validation ledger, `pr-implementation-plan.md`는 이전 PR별 실행 기준,
`archive/`는 판단 근거 보존용 기록이다. archive 문서의 issue 후보나 PR 순서는 현재 실행
기준으로 사용하지 않는다.

## 빠른 시작

패키지를 설치해서 Claude Code command pack과 provider prompt를 배치한다. 아래는 Antigravity를
예시 provider로 사용한다. Codex도 주요 provider로 지원한다.

```bash
npx @pureliture/ai-cli-orch-wrapper pack setup
npx @pureliture/ai-cli-orch-wrapper provider setup antigravity
npx @pureliture/ai-cli-orch-wrapper provider setup codex
```

저장소 checkout에서 직접 확인할 때는 빌드 후 wrapper CLI를 실행한다.

```bash
npm install
npm run build
node packages/wrapper/dist/cli.js pack setup
node packages/wrapper/dist/cli.js provider setup antigravity
node packages/wrapper/dist/cli.js provider setup codex
node packages/wrapper/dist/cli.js sync --check
```

주요 운영 명령:

```bash
aco pack status
aco sync --check
aco doctor
```

위임 작업은 Claude Code에서 `/aco <자연어 작업>`, Codex에서 `$aco <자연어 작업>`으로 실행한다.
예시: `/aco antigravity로 이 PR을 리뷰해줘`. `/aco`는 실행 계획(dry-run)을 먼저 제시하고
동의 시 실행한다.

<details>
<summary>내부/maintainer/디버그용 CLI plumbing</summary>

`aco ask`는 위임 스킬이 내부적으로 호출하는 하부 명령이다. `aco run`은 출력 정책을
`stream-only`로 두어 대형 출력의 메모리 보존을 억제한다. `aco ask`는 `brief` 모드에서
`bounded` 정책으로 출력 미리보기 크기를 제한한다. provider 실행 전 `--dry-run`으로 계획을
확인하고, 실제 실행에는 `--yes`가 필요하다. full provider output은 Claude Code stdout으로
바로 흘리지 않고 `~/.aco/sessions/<session-id>/output.log`에 저장하며, run-level 요약은
`~/.aco/runs/<run-id>/brief.md`와 `ledger.json`에 저장한다.

</details>

## 독자별 탐색 경로

### 평가자 또는 포트폴리오 리뷰어

1. 이 문서의 [현재 상태 요약](#현재-상태-요약) — 무엇이 구현되어 있고 무엇이 계획인지
2. [case-study.md](case-study.md) — 문제, 제약, 설계, trade-off, 현재 한계
3. [architecture.md](architecture.md) — CLI 런타임, context sync, 저장소 구조
4. [security.md](security.md) — consent gate, output modes, artifact storage, secrets policy
5. [reference/session-artifacts.md](reference/session-artifacts.md) — `~/.aco/runs`와 `~/.aco/sessions` layout
6. [guides/runbook.md](guides/runbook.md) — consent-gated delegation demo와 운영 절차
7. [roadmap.md](roadmap.md) — 프로젝트 포지셔닝과 개선 우선순위
8. [plans/consent-gated-delegation-hardening/](plans/consent-gated-delegation-hardening/) — Goal 2 hardening spec, plan, review, validation ledger
9. [contract/go-node-boundary.md](contract/go-node-boundary.md) — Go/Node.js 책임 경계

### 패키지를 설치·운영하는 사용자

1. [guides/runbook.md](guides/runbook.md) — 설치·배포·일반 문제 해결
2. [reference/context-sync.md](reference/context-sync.md) — `aco sync` 동작과 변환 규칙
3. [reference/project-board.md](reference/project-board.md) — Project #3 필드·뷰 정의

### Claude Code 하네스 관리자

1. [guides/github-workflow.md](guides/github-workflow.md) — 슬래시 커맨드, 이슈·PR 운영, CI/CD
2. [architecture.md](architecture.md) — CLI 런타임, context sync, 저장소 구조
3. [contract/go-node-boundary.md](contract/go-node-boundary.md) — Go/Node.js 책임 경계

> 기여자 가이드는 Phase 1 범위에서 제외한다. 기여자 온보딩과 개발 흐름 정리는
> Phase 2에서 별도로 다룬다.

## 문서 분류

| 카테고리                                                 | 답해야 하는 질문                             | 주 독자               |
| -------------------------------------------------------- | -------------------------------------------- | --------------------- |
| [`case-study.md`](case-study.md)                         | 어떤 문제를 어떤 설계로 풀었나               | 평가자, 신규 기여자   |
| [`architecture.md`](architecture.md)                     | 왜 이렇게 설계됐나                           | 신규 기여자, 아키텍트 |
| [`roadmap.md`](roadmap.md)                               | 무엇을 먼저 개선할 것인가                    | 평가자, 관리자        |
| [`pr-implementation-plan.md`](pr-implementation-plan.md) | 이전 PR 분할 기준과 역사적 실행 계획         | 구현자, 관리자        |
| [`plans/`](plans/)                                       | 현재 목표의 spec/plan/review/validation 기록 | 구현자, 관리자        |
| [`contract/`](contract/)                                 | 정확히 어떻게 동작하는가 (규범)              | 구현자, 외부 통합자   |
| [`guides/`](guides/)                                     | 어떻게 하나 (작업 단위)                      | 기여자, 운영자        |
| [`reference/`](reference/)                               | 이 필드/설정/명령의 정의는                   | 운영자, 툴 사용자     |
| [`archive/`](archive/)                                   | 과거에 어떻게 결정됐나                       | 컨텍스트 추적자       |

## 엔지니어링 참조

1. [architecture.md](architecture.md) — 전체 그림
2. [plans/consent-gated-delegation-hardening/01-hardening-spec.md](plans/consent-gated-delegation-hardening/01-hardening-spec.md) — Goal 2 hardening contract
3. [plans/consent-gated-delegation-hardening/04-validation.md](plans/consent-gated-delegation-hardening/04-validation.md) — Goal 2 구현·검증 결과
4. [contract/README.md](contract/README.md) — 규범 계약 문서 인덱스
5. [contract/go-node-boundary.md](contract/go-node-boundary.md) — Go/Node.js 책임 경계
6. [contract/process-execution-contract.md](contract/process-execution-contract.md) — 프로세스 실행 계약
7. [reference/ubiquitous-language.md](reference/ubiquitous-language.md) — provider invocation과 run/session artifact의 canonical terms

## 아카이브

- [archive/](archive/) — 브레인스토밍 세션 기록, 완료된 계획 문서

## 남은 문서화 단계

- **Phase 2**: 기여자 가이드 개선, `reference/context-sync.md` 심화, 문서 간 일관성 점검
- **Phase 3**: VitePress 도입, 검색·사이드바·배포 구조화

## 작성 규칙

- 파일·디렉터리명은 **kebab-case 소문자** 사용 (`contributing.md`, `github-workflow.md`)
- `archive/` 하위 항목은 **`YYYY-MM-DD-<slug>.md`** 접두어로 시점을 파일명에 명시
- 각 하위 디렉터리는 `README.md` 인덱스를 둬 탐색 경로를 제공
- 신규 외부 링크를 추가할 때는 이 `docs/README.md`를 거치거나 각 하위 `README.md`
  를 경유하도록 구성해 깊은 경로 링크의 rot을 줄인다
