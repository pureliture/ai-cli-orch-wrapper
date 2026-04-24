# AI Workflow Harness 방향성 리뷰

작성일: 2026-04-24

이 문서는 GPT Pro가 제안한 레포 방향성을 현재 저장소 상태와 대조해 리뷰하고,
앞으로의 개선 우선순위를 정리한다. 목적은 기능 명세를 확정하는 것이 아니라,
`ai-cli-orch-wrapper`가 어떤 프로젝트로 보여야 하는지와 어떤 보완이 가장 큰 효과를
내는지 합의 가능한 기준을 남기는 것이다.

## 결론

제안의 큰 방향은 타당하다. 이 저장소는 단순히 Gemini나 Codex CLI를 호출하는 wrapper로
보이기보다, Claude Code 중심의 repo-local harness를 여러 AI CLI 실행면과 연결하는
**AI 개발 워크플로우 하네스**로 설명해야 한다.

가장 먼저 개선할 것은 기능 추가가 아니라 포지셔닝이다. 현재 README와 루트
`package.json` 설명은 Gemini 중심 command pack처럼 읽히는 부분이 남아 있다. 반면 실제
레포는 이미 다음 요소를 함께 다룬다.

- npm으로 설치 가능한 `aco` CLI
- Claude Code 기준 command/agent/skill 자산
- Codex/Gemini 대상 context sync
- provider setup과 실행 추상화
- session-aware `run`, `status`, `result`, `cancel`
- Go runtime과 Node wrapper의 실행 책임 분리
- GitHub issue/PR 운영을 위한 slash command workflow

따라서 첫 화면의 메시지는 다음처럼 바뀌는 것이 맞다.

```text
ai-cli-orch-wrapper is a repo-local AI workflow harness that connects
Claude Code, Codex CLI, and Gemini CLI into repeatable development workflows:
context sync, provider execution, session tracking, and repo-local review workflows.
```

한국어 포트폴리오 설명도 같은 축으로 유지한다.

```text
Claude Code, Codex CLI, Gemini CLI를 하나의 개발 워크플로우로 묶기 위한
repo-local AI workflow harness입니다. 단순 provider wrapper가 아니라
프로젝트 컨텍스트 동기화, provider별 실행 추상화, PR 리뷰 자동화,
세션 기록, 결과 조회, CI 검증까지 포함한 개발 자동화 도구로 설계했습니다.
```

## 현재 상태 확인

이 문서는 최초 리뷰 시점의 baseline과 이 worktree에서 정리한 문서 방향을 함께 기록한다.
아래 표는 "무엇이 이미 있는가"와 "무엇을 다음 PR에서 더 선명하게 해야 하는가"를 구분하기
위한 기준이다.

| 영역                 | 현재 상태                                                                      | 판단                                                        |
| -------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| README 포지셔닝      | harness 중심 intro와 docs 진입점은 보강했지만, 첫 1분 구조는 더 다듬어야 한다. | PR1에서 What/Why/Core workflow/Non-goals/Safety를 완성한다. |
| 루트 package 설명    | `"Claude Code slash-command pack for Gemini CLI"`로 남아 있다.                 | Codex와 workflow harness 범위를 반영하지 못한다.            |
| wrapper package 설명 | command pack, provider setup, execution, session lifecycle을 설명한다.         | 루트 설명보다 현재 구현에 가깝다.                           |
| context sync         | `aco sync`, `--check`, `--dry-run`, `--force`가 있다.                          | 핵심 차별화 소재로 밀 수 있다.                              |
| sync diff/explain    | `--diff`, `--explain`은 없다.                                                  | `--dry-run`보다 평가자에게 보이는 설명력이 약하다.          |
| session lifecycle    | `task.json`, `output.log`, `status/result/cancel`이 있다.                      | raw log 중심이라 review artifact 표준화 여지가 있다.        |
| doctor               | `aco doctor`는 없다.                                                           | 복잡한 provider/auth/sync 실패 지점을 흡수하기에 좋다.      |
| mock provider        | fixture에는 mock provider binary가 있지만 공개 provider registry에는 없다.     | 인증 없는 demo 경로로 제품화할 여지가 크다.                 |
| runtime boundary     | `docs/architecture.md`, `docs/contract/go-node-boundary.md`가 있다.            | 이미 좋은 내용이 있으나 README에서 더 잘 연결해야 한다.     |
| 보안 문서            | Go 환경 변수 allowlist와 path validation 계약은 있다.                          | 사용자 관점의 security model, `.acoignore` 문서가 부족하다. |

## 현재 구현과 planned 범위

| 구분          | 현재 구현된 범위                                                                  | planned 범위                                                                         |
| ------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 포지셔닝      | README와 architecture가 `aco`, provider, sync, session을 설명한다.                | README 첫 화면을 workflow harness 중심으로 재구성한다.                               |
| provider 실행 | Node wrapper의 `aco run <provider> <command>`가 Gemini/Codex provider를 호출한다. | mock provider와 no-auth demo를 추가한다.                                             |
| context sync  | `aco sync`, `--check`, `--dry-run`, `--force`가 있다.                             | `--diff`, `--explain`을 추가해 drift와 ownership을 설명한다.                         |
| session 결과  | `task.json`, `output.log`, `aco result/status/cancel`이 있다.                     | v1은 `review.md`와 text/markdown result를 추가하고, `findings.json`은 v2로 분리한다. |
| 보안 문서     | Go runtime allowlist와 path validation 계약이 있다.                               | public Node wrapper와 Go delegate runtime의 보안 경계를 분리해 설명한다.             |

## 외부 맥락

외부 비교는 포지셔닝을 돕는 보조 근거로만 사용해야 한다. AI CLI orchestration 계열은
빠르게 변하기 때문에 특정 경쟁 도구와 기능 개수로 경쟁하기보다, 이 레포가 어디에서
다른지를 명확히 해야 한다.

- `jleechanorg-orchestration`은 Python/tmux 기반으로 Claude, Codex, Gemini, Cursor
  같은 agent CLI를 실행·조율하는 방향의 패키지다. 제공 메모의 링크는 `0.1.61`이지만,
  PyPI는 더 최신 버전이 있음을 표시한다.
- `CliRelay`는 여러 AI CLI와 provider를 API-compatible proxy endpoint로 감싸는 방향을
  내세운다.
- GitHub Copilot CLI 문서는 repo-level instruction 파일 위치로 `AGENTS.md`,
  `GEMINI.md`, `CODEX.md` 같은 파일을 함께 언급한다. 이는 context sync가 단순 편의
  기능이 아니라 여러 AI coding tool이 repo-local instruction을 공유하는 흐름과 맞닿아
  있음을 보여준다.

이 레포의 차별화는 proxy, tmux session manager, multi-agent dispatcher가 아니라
**repo-local 개발 workflow 자산을 provider 실행, context sync, review follow-up,
검증 결과와 묶는 것**이다.

## 제안 리뷰

### 1. README 첫 1분 경험 개편

수용한다. 가장 먼저 효과가 나는 작업이다.

현재 README는 설치와 provider setup이 빠르게 나오지만, 처음 보는 사람에게는
"왜 필요한가"가 먼저 보이지 않는다. README 첫 화면은 다음 순서가 적합하다.

1. What is this?
2. Why?
3. Core workflow
4. No-auth demo 또는 짧은 terminal transcript
5. Quick Start
6. Architecture at a glance

핵심은 설치 명령을 숨기는 것이 아니라, 설치 전에 문제 정의와 해결 방식을 먼저 보여주는
것이다.

### 2. "AI CLI wrapper"가 아니라 "workflow harness"로 포지셔닝

수용한다. 다만 구현되지 않은 기능까지 현재 기능처럼 쓰면 안 된다.

README와 case study는 "implemented", "planned", "experimental"을 분리해야 한다. 예를
들어 `aco doctor`, mock provider, artifact schema, aggregator는 아직 planned로 표기해야
한다. 포트폴리오 문서에서 과장보다 정확성이 더 중요하다.

### 3. context sync를 핵심 기능으로 전면화

강하게 수용한다.

이 레포에서 가장 설득력 있는 소재는 `.claude/`를 canonical source로 두고 Codex/Gemini
대상 파일을 생성 산출물로 관리하는 구조다. 여러 AI coding tool이 각자 instruction
파일을 요구하는 상황에서, 수동 복사로 생기는 drift를 manifest와 managed block으로
관리한다는 이야기는 실무적이다.

대표 generated target은 `AGENTS.md`, `GEMINI.md`, `.agents/skills/`, `.codex/agents/`,
`.codex/hooks.json`, `.gemini/agents/`, `.gemini/settings.json`이다. 특히 `.agents/skills/`는
Codex와 Gemini가 공유하는 skill target이며, provider별 skill 디렉터리로 복사하지 않는다.

추가하면 좋은 CLI 표면은 다음 순서다.

1. `aco sync --diff`: managed target별 changed/unchanged/drift를 보여준다.
2. `aco sync --explain`: canonical source, generated target, ownership rule을 설명한다.

이미 `--dry-run`이 있으므로 `--diff`는 내부적으로 현재 sync plan을 더 사람이 읽기 좋은
형태로 보여주는 방향에서 시작할 수 있다.

### 4. `aco doctor`

수용한다. 운영 강화 단계로 둔다.

이 레포는 실패 지점이 많다. Node 버전, git repo 여부, provider binary, provider auth,
`.claude/` harness, sync manifest, drift, smoke command를 한 번에 점검하는 명령은 신규
사용자의 진입 비용을 낮춘다.

주의할 점은 `doctor`가 provider 실행을 과하게 시도하지 않아야 한다는 것이다. 인증 확인은
현재 `provider setup`의 fast-path 방식처럼 로컬 파일과 환경 변수를 먼저 보고, 외부 CLI
호출은 명확히 제한된 fallback으로 유지해야 한다.

### 5. mock provider 또는 demo mode

수용한다. 포트폴리오 효과가 매우 크다.

현재 fixture에는 mock provider binary를 만드는 흐름이 있지만, 사용자가 실행할 수 있는
공개 demo provider는 아니다. 인증 없이 다음 흐름이 가능하면 README 설득력이 크게 좋아진다.

```bash
npx @pureliture/ai-cli-orch-wrapper demo init
cd aco-demo
aco run mock review
aco result
```

초기 구현은 `aco run mock review`처럼 provider registry에 deterministic output provider를
추가하는 편이 가장 단순하다. `demo init`은 그 다음 단계로 둬도 된다.

### 6. review artifact 표준화

수용하되, mock provider와 session 호환성을 먼저 고려한다.

현재 session store는 `task.json`과 `output.log` 중심이다. 첫 단계의 artifact v1은 기존
호환성을 유지하면서 `review.md`와 `aco result --format text|markdown`을 추가하는 정도가
적절하다. `findings.json`, `validation.json`, `aco result --format json`은 provider output
normalization이 필요하므로 v2로 분리한다.

일반 provider output은 항상 구조화된 findings를 주지 않는다. 따라서 artifact v1은 raw
`output.log`를 계속 보존하고, markdown review artifact만 안정화하는 방향이 안전하다.

### 7. multi-provider review aggregator

좋은 방향이지만 후속 workflow 단계로 둔다.

aggregator는 "여러 AI가 공통으로 지적한 사항"과 "provider 단독 지적"을 분리한다는 점에서
AI-native workflow 메시지가 강하다. 다만 artifact schema가 안정되기 전에는 markdown summary
기반 best-effort 비교로 제한해야 한다. 우선순위는 다음이 맞다.

1. provider output 저장
2. markdown review artifact
3. `aco result --format text|markdown`
4. multi-provider aggregation

### 8. `aco followup`

방향은 좋지만 multi-provider aggregation 이후로 둔다.

이 레포에는 이미 `/gh-pr-followup` command와 GitHub workflow 문서가 있다. 따라서 CLI
명령으로 `aco followup --from-session <id>`를 추가하는 것은 자연스럽다. 다만 이 기능은
multi-provider aggregation과 분리해야 한다. 먼저 markdown summary 기반 aggregation을 만들고,
그 다음 follow-up draft와 GitHub workflow 연동을 별도 PR로 다루는 순서가 낫다.

### 9. 보안 모델과 `.acoignore`

수용한다. 운영 강화 단계에 가깝다.

AI provider에 어떤 파일과 환경이 전달되는지는 사용자가 민감하게 보는 지점이다. 현재
Go runtime 쪽에는 환경 변수 allowlist와 path validation 계약이 있지만, README에서 바로
이해할 수 있는 사용자용 보안 모델은 부족하다.

추가할 문서는 다음을 포함해야 한다.

- provider execution은 명시적 명령에서만 발생한다.
- `aco sync`는 managed target만 쓴다.
- `.env`, key, token, credential 파일은 기본 제외 대상이어야 한다.
- `.acoignore`가 도입되면 provider context 수집과 sync 대상에서 어떻게 작동하는지
  설명한다.
- `aco context inspect` 같은 명령은 장기적으로 provider에 전달될 context를 보여준다.

### 10. Node/Go runtime boundary 문서

부분 수용한다.

내용 자체는 이미 `docs/architecture.md`와 `docs/contract/go-node-boundary.md`에 있다. 새로
긴 문서를 만들기보다 README와 docs index에서 이 문서를 더 잘 연결하는 것이 먼저다. 다만
평가자용 문서에서는 다음 질문에 짧게 답해야 한다.

- 왜 Node와 Go가 둘 다 있는가?
- npm package의 public surface는 무엇인가?
- Node session lifecycle과 Go delegate lifecycle은 어디서 분리되는가?
- 현재 제한은 무엇인가?

필요하면 나중에 `docs/architecture/runtime-boundary.md`를 추가하되, 기존
`docs/contract/go-node-boundary.md`와 중복되지 않게 "평가자용 설명"으로만 둔다.

## 권장 실행 순서

이 표는 GitHub Project의 `Priority` 필드를 대체하지 않는다. 실제 triage priority는 Project
`Priority` field에 기록하고, 이 문서는 어떤 개선을 먼저 검토할지 설명하는 roadmap 순서로만
사용한다.

| 단계                  | 작업                                             | 이유                                                |
| --------------------- | ------------------------------------------------ | --------------------------------------------------- |
| Foundation            | README 첫 화면을 workflow harness 중심으로 개편  | 첫 30초 안에 가치가 보여야 한다.                    |
| Foundation            | 루트 `package.json` description 정리             | Gemini-only 인상을 줄여야 한다.                     |
| Foundation            | `docs/case-study.md` 추가                        | 포트폴리오/평가자용 단일 링크가 필요하다.           |
| Demo                  | mock provider 또는 no-auth demo path 추가        | 인증 없이 핵심 workflow를 보여줘야 한다.            |
| Operational hardening | `aco doctor` 추가                                | provider/auth/sync 환경 문제를 진단 가능하게 한다.  |
| Operational hardening | `aco sync --diff`, `aco sync --explain` 추가     | context sync의 차별화가 CLI에서 보이게 한다.        |
| Operational hardening | 사용자용 security model과 `.acoignore` 문서 추가 | 외부 provider 실행에 대한 신뢰를 만든다.            |
| Operational hardening | review artifact schema 도입                      | AI 결과를 검토 가능한 산출물로 만든다.              |
| Workflow closure      | multi-provider review aggregator                 | 여러 AI 결과를 비교해 의사결정을 돕는다.            |
| Workflow closure      | `aco followup --from-session`                    | review 결과를 GitHub issue workflow로 연결한다.     |
| Future extension      | provider plugin contract                         | 확장성 어필은 core workflow 이후에 다룬다.          |
| Future extension      | metrics/report command                           | 효과 측정은 artifact와 workflow 안정화 이후에 둔다. |

## 후속 구현 PR 권장 범위

아래 범위는 현재 문서 baseline PR이 아니라, 이 roadmap을 따른 뒤 실제 구현을 시작할 때의 첫
기능/문서 PR 기준이다. 첫 구현 PR은 기능 추가보다 문서 정리로 제한하는 편이 좋다. PR1-PR8a/8b의
상세 실행 기준은 [pr-implementation-plan.md](pr-implementation-plan.md)를 따른다.

권장 범위:

- README 첫 화면에 30초 설명, problem/solution, core workflow 추가
- 설치 섹션을 value proposition 아래로 이동
- "Why not just use Codex/Gemini/Claude directly?" 섹션 추가
- 루트 `package.json` description 정리
- `docs/case-study.md` 추가
- `docs/README.md`에 case study, roadmap, runtime boundary 진입점 추가

첫 구현 PR에서 피할 것:

- 아직 없는 `aco doctor`, mock provider, aggregator를 현재 기능처럼 소개
- Node/Go runtime 경계를 새로 재해석하면서 기존 contract 문서와 충돌시키는 것
- README에 너무 많은 implementation detail을 넣는 것

## GitHub issue 후보

이 섹션은 방향성 리뷰에서 나온 초기 issue 후보를 보존한다. 실제 PR scope, non-goals,
acceptance criteria, verification은 [pr-implementation-plan.md](pr-implementation-plan.md)가
우선한다.

### Issue 1: task: reposition README around AI workflow harness

목적:

README 첫 화면에서 이 프로젝트가 단순 AI CLI wrapper가 아니라 repo-local AI workflow
harness임을 명확히 설명한다.

범위:

- 30초 설명 추가
- problem/solution 섹션 추가
- core workflow 추가
- 설치 섹션을 value proposition 아래로 이동
- case study 링크 추가

완료 기준:

- README 첫 화면에서 문제, 대상 사용자, 핵심 workflow가 보인다.
- "Why not just use Codex/Gemini/Claude directly?" 섹션이 있다.
- 설치 전에 demo 또는 core workflow가 먼저 설명된다.

### Issue 2: chore: align package metadata with provider support

목적:

루트 package metadata가 Gemini-only command pack처럼 보이는 문제를 정리한다.

범위:

- 루트 `package.json` description 수정
- 필요한 경우 keywords에 `codex-cli`, `ai-workflow`, `context-sync` 추가
- wrapper package description과 README 표현을 맞춘다.

완료 기준:

- 루트 설명이 Claude Code, Codex CLI, Gemini CLI를 함께 다루는 repo-local workflow
  harness로 읽힌다.
- package metadata와 README 첫 문단이 충돌하지 않는다.

### Issue 3: task: add portfolio case study

목적:

평가자가 문제, 제약, 설계, trade-off, 결과를 한 페이지에서 이해할 수 있게 한다.

범위:

- `docs/case-study.md` 추가
- problem, constraints, design, trade-offs, current result, limitations 작성
- README에서 case study로 연결

완료 기준:

- "왜 만들었는가", "무엇을 설계했는가", "무엇이 한계인가"가 한 문서에서 보인다.
- 구현된 기능과 예정 기능이 분리되어 있다.

### Issue 4: task: add mock provider for demo

목적:

외부 API key나 provider auth 없이 핵심 workflow를 데모할 수 있게 한다.

범위:

- `mock` provider 등록
- `aco run mock review` 지원
- deterministic review output 생성
- 기존 session store에 output 저장
- README demo path 추가

완료 기준:

- fresh clone에서 API key 없이 demo가 가능하다.
- `aco result`로 mock output을 조회할 수 있다.
- CI smoke에서 mock provider 경로를 검증한다.

### Issue 5: task: add aco doctor

목적:

사용자가 provider, auth, harness, sync 상태를 한 번에 진단할 수 있게 한다.

범위:

- Node version 확인
- git repository 확인
- provider CLI availability 확인
- provider credential-presence heuristic 확인
- `.claude/` harness 확인
- `.aco/sync-manifest.json`과 drift 확인
- actionable next command 출력

완료 기준:

- `aco doctor`가 success/warning/failure를 구분해 출력한다.
- provider 미설치 또는 로컬 credential/auth 파일 상태 문제 시 다음 명령을 안내한다.
- `gemini --version`, `codex --version` fallback은 인증 검증이 아니라 binary availability 확인으로 표기한다.
- drift 감지 시 `aco sync --diff` 또는 `aco sync --force` 안내가 나온다.

### Issue 6: task: add sync diff and explain modes

목적:

context sync의 관리 대상, drift, overwrite 위험을 사용자가 이해할 수 있게 한다.

범위:

- `aco sync --diff`
- `aco sync --explain`
- managed target별 상태 출력
- manifest hash와 current hash 차이 표시
- diff/explain mode에서는 파일을 쓰지 않는다.

완료 기준:

- managed target별 changed/unchanged/drift 상태가 출력된다.
- manifest hash와 current hash 차이를 볼 수 있다.
- 아무 파일도 수정하지 않는다.

### Issue 7: task: standardize review artifact output

목적:

AI provider 출력 결과를 raw log와 함께 사람이 검토 가능한 markdown artifact로 보존한다.

범위:

- session directory에 `review.md` 추가
- 기존 `task.json`과 `output.log` 호환성 유지
- `aco result --format text|markdown` 추가
- `findings.json`, `validation.json`, `--format json`은 v2로 분리

완료 기준:

- provider output이 기존 raw log에 계속 저장된다.
- review 결과를 markdown artifact로 조회할 수 있다.
- result command에서 format 선택이 가능하다.
- v1은 structured findings schema를 강제하지 않는다.

### Issue 8: task: add security model and .acoignore guide

목적:

AI provider에 전달되는 context와 제외되는 sensitive file 기준을 명확히 한다.

범위:

- `docs/security.md` 추가
- `.acoignore` 예시 추가
- secret redaction/exclusion policy 설명
- provider execution responsibility 설명
- `aco context inspect`는 future command로 분리해 명시
- Node public runtime과 Go delegate runtime의 security boundary를 분리해 설명
- secret scanning과 `.acoignore` 적용을 현재 구현보다 강하게 보장하지 않음

완료 기준:

- sensitive file exclusion policy가 문서화되어 있다.
- `.acoignore` 예시가 있다.
- provider에 전달되는 context를 확인하는 방법 또는 예정 명령이 설명되어 있다.
- Go runtime allowlist가 Node wrapper provider execution에 자동 적용되는 것처럼 쓰지 않는다.

## 한계와 원칙

README와 case study에는 한계를 명시하는 편이 낫다.

- 이 프로젝트는 human code review를 대체하지 않는다.
- provider output은 advisory이며 테스트와 maintainer 판단으로 검증해야 한다.
- Node wrapper session lifecycle과 Go delegate lifecycle은 현재 분리되어 있다.
- 외부 provider CLI의 behavior는 안정적인 machine-readable API처럼 보장되지 않는다.
- context sync는 알려진 generated target만 관리하며 임의의 프로젝트 context를 자동 추론하지
  않는다.
- 보안 모델은 "무엇을 보내지 않을 것인가"와 "사용자가 무엇을 확인할 수 있는가"를
  명확히 해야 한다.

## 문서 구조 제안

기존 문서 구조를 크게 갈아엎기보다, 독자별 진입점을 추가하는 방식이 좋다.

```text
README.md
docs/
  case-study.md              # 평가자/포트폴리오용
  roadmap.md                 # 방향성 및 개선 우선순위
  architecture.md            # 전체 기술 설계
  security.md                # 사용자용 보안 모델
  contract/
    go-node-boundary.md      # 구현자용 runtime contract
    process-execution-contract.md
  reference/
    context-sync.md
    project-board.md
    session-artifacts.md     # artifact schema 도입 시 추가
  guides/
    runbook.md
    contributing.md
    github-workflow.md
    run-multi-provider-review.md
```

평가자에게는 다음 3개 링크만으로 설명 가능해야 한다.

1. `README.md`: 무엇이고 왜 필요한지, 어떻게 실행하는지
2. `docs/case-study.md`: 어떤 문제를 어떤 설계로 풀었는지
3. `examples/mock-review-session/`: 인증 없이 볼 수 있는 실제 session artifact

## 참고 링크

- Local Archive: [GPT Pro Direction Raw](archive/2026-04-24-gpt-pro-direction-raw.md)
- Local: [Case Study](case-study.md)
- PyPI: [jleechanorg-orchestration](https://pypi.org/project/jleechanorg-orchestration/0.1.61/)
- GitHub: [CliRelay](https://github.com/kittors/CliRelay)
- GitHub Docs: [Copilot CLI best practices](https://docs.github.com/ko/copilot/how-tos/copilot-cli/cli-best-practices)
- Local: [Architecture](architecture.md)
- Local: [Context Sync Reference](reference/context-sync.md)
- Local: [Go/Node.js Boundary](contract/go-node-boundary.md)
