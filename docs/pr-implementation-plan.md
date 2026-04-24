# PR Implementation Plan

작성일: 2026-04-24

이 문서는 `ai-cli-orch-wrapper`를 repo-local AI workflow harness로 개선하기 위한
PR1-PR8a/8b 실행 기준이다. [roadmap.md](roadmap.md)는 방향성과 우선순위를 정리하고, 이 문서는
각 PR을 실제 개발 단위로 자르기 위한 scope, non-goals, acceptance criteria, verification을
정의한다.

원본 GPT Pro 제안과 이후 리뷰는
[archive/2026-04-24-gpt-pro-direction-raw.md](archive/2026-04-24-gpt-pro-direction-raw.md)에
보존한다. 반복해서 개발 기준으로 써야 하는 결정사항은 이 문서에 canonical하게 정리한다.

## 사용 원칙

- 각 PR은 하나의 명확한 사용자 가치만 완성한다.
- 구현된 기능과 planned 기능을 문서에서 섞지 않는다.
- 아직 없는 명령은 README에서 현재 기능처럼 소개하지 않는다.
- portfolio appeal보다 실제 실행 가능성과 검증 가능성을 우선한다.
- AI provider 출력은 advisory로 다루며 human review와 test validation을 대체하지 않는다.
- 기능 PR은 테스트 또는 smoke 검증을 포함한다.
- 문서 PR은 기존 `docs/README.md` 인덱스와 링크를 함께 갱신한다.

## PR 흐름

```text
PR 1: README 첫 화면 + package metadata
PR 2: docs/case-study.md
PR 3: mock provider / no-auth demo
PR 4: aco sync --diff / --explain
PR 5: aco doctor v1
PR 6: docs/security.md + .acoignore policy
PR 7: result artifact v1
PR 8a: multi-provider review aggregator
PR 8b: follow-up draft / GitHub workflow integration
```

의존성:

```text
PR 1 -> PR 2 -> PR 3
PR 4 -> PR 5
PR 3 + PR 7 -> PR 8a -> PR 8b
PR 6 can start after PR 1, but full policy should wait for provider/context details.
```

권장 milestone:

| Milestone                 | PRs      | 목표                                                           |
| ------------------------- | -------- | -------------------------------------------------------------- |
| M1: Positioning and proof | PR 1-3   | 첫인상, case study, no-auth 실행 증거 확보                     |
| M2: Operational hardening | PR 4-7   | sync, doctor, security, artifact를 운영 기능으로 강화          |
| M3: Workflow closure      | PR 8a-8b | review 결과를 multi-provider 판단과 follow-up 작업 관리로 연결 |

## PR 1: README 첫 화면 개편 + package metadata

### 목표

첫 화면에서 이 저장소가 Gemini CLI wrapper가 아니라, Claude Code, Codex CLI, Gemini CLI를
repo-local 개발 워크플로우로 묶는 AI workflow harness임을 이해하게 만든다.

### 배경

현재 README와 root `package.json`은 Gemini 중심 command pack처럼 읽힐 수 있다. 실제 구현은
`aco` CLI, provider setup, context sync, session lifecycle, Node/Go runtime boundary를 함께
다룬다. 포지셔닝과 metadata가 구현 범위를 따라와야 한다.

### 포함 범위

- README 첫 문단 재작성
- `What is this?`, `Why?`, `Core workflow` 섹션 추가
- 설치 섹션을 value proposition 아래로 이동
- `What this is not` 또는 `Non-goals` 추가
- 짧은 `Safety` note 추가
- root `package.json` description 수정
- 필요하면 root package keywords 정리
- `docs/README.md`에 roadmap/case study 계획 링크 정리

### Non-goals

- `docs/case-study.md` 본문 작성
- mock provider 구현
- `aco doctor`, `sync --diff`, `sync --explain` 구현
- 상세 security model 작성
- 아직 없는 기능을 현재 기능처럼 소개

### README 메시지 기준

권장 첫 문장:

```text
ai-cli-orch-wrapper is a repo-local AI workflow harness that connects
Claude Code, Codex CLI, and Gemini CLI into repeatable development workflows:
context sync, provider execution, PR review, session tracking, and validation.
```

권장 한국어 설명:

```text
Claude Code, Codex CLI, Gemini CLI를 하나의 개발 워크플로우로 묶기 위한
repo-local AI workflow harness입니다.
```

### Non-goals 예시

```md
## What this is not

- This is not a replacement for human code review.
- This is not a general-purpose AI agent platform.
- This does not train or fine-tune models.
- This does not automatically merge AI-generated code.
- This is a repo-local workflow harness for coordinating AI CLI tools.
```

### Safety note 예시

```md
## Safety

Provider execution is explicit. This project does not automatically send
arbitrary repository files to external providers. `aco sync` writes managed
target files only.
```

### 예상 파일

- `README.md`
- `package.json`
- `docs/README.md`

### Acceptance criteria

- README 첫 화면에서 문제, 대상 사용자, 핵심 workflow가 보인다.
- root package description이 Gemini-only 도구처럼 읽히지 않는다.
- `What this is not`이 AI 자동화의 경계를 명확히 한다.
- Safety note가 provider 실행과 sync 쓰기 범위를 짧게 설명한다.
- 아직 구현되지 않은 기능은 현재 기능처럼 소개하지 않는다.

### Verification

```bash
npx prettier --check README.md docs/README.md package.json
npm run typecheck
```

문서-only 변경이면 typecheck는 필수는 아니지만 package metadata를 수정했다면 한 번 확인한다.

### Review checklist

- README가 너무 길어져 Quick Start를 밀어내지 않았는가?
- "AI-native" 표현이 과장으로 보이지 않는가?
- mock provider나 doctor가 현재 기능처럼 보이지 않는가?
- root package와 wrapper package description이 충돌하지 않는가?

## PR 2: `docs/case-study.md` 추가

### 목표

평가자와 면접관이 문제, 제약, 설계, trade-off, 현재 한계를 한 페이지에서 이해하게 한다.

### 배경

README는 사용자용 문서이고, case study는 평가자용 문서다. 코드 전체를 읽지 않아도 설계
판단과 프로젝트 의도를 파악할 수 있어야 한다.

### 포함 범위

- `docs/case-study.md` 추가
- problem, constraints, design, trade-offs, current result, limitations 작성
- README와 `docs/README.md`에서 case study로 링크
- 구현된 기능과 planned 기능을 분리
- portfolio용 요약 문단 추가

### Non-goals

- README 내용을 길게 반복
- future command를 현재 기능처럼 소개
- 경쟁 도구 비교를 과하게 확장
- 구현 변경

### 권장 구조

```md
# Case Study: Building a repo-local AI workflow harness

## Problem

AI CLI tools have different context files, auth flows, command styles,
and output formats. This creates drift and makes review workflows hard to repeat.

## Constraints

- Must be installable as an npm package
- Must support repo-local Claude Code harness
- Must support Codex/Gemini target context
- Must avoid unsafe overwrites during sync
- Must preserve provider output as inspectable session data

## Design

- Node wrapper CLI for package UX, setup, sync, and session lifecycle
- Go runtime for blocking delegate execution
- Manifest-based context sync
- Provider abstraction
- GitHub issue/PR workflow commands

## Trade-offs

- Node/Go split increases complexity
- Provider CLI behavior can change
- Multi-provider review needs normalization
- Context sync must avoid leaking sensitive files

## Current limitations

- Not a replacement for human review
- Real provider output quality varies
- Node and Go lifecycle boundaries are still evolving
```

### 예상 파일

- `docs/case-study.md`
- `docs/README.md`
- `README.md`

### Acceptance criteria

- "왜 만들었는가", "무엇을 설계했는가", "무엇이 한계인가"가 한 문서에 보인다.
- README 반복이 아니라 설계 의사결정 중심으로 작성되어 있다.
- 구현된 기능과 planned 기능이 분리되어 있다.
- 평가자가 읽을 60초 요약 문단이 있다.

### Verification

```bash
npx prettier --check README.md docs/README.md docs/case-study.md
```

### Review checklist

- Node/Go 경계를 솔직하게 설명하는가?
- context sync가 왜 핵심인지 설득되는가?
- 한계가 숨겨져 있지 않은가?
- portfolio 문장과 실제 구현이 맞는가?

## PR 3: mock provider / no-auth demo

### 목표

외부 API key나 provider auth 없이 `aco run -> session -> result` workflow를 검증할 수 있게
한다.

### 배경

Gemini/Codex 인증이 없으면 평가자가 직접 실행하기 어렵다. mock provider는 AI 품질을
보여주는 기능이 아니라, provider runtime과 session lifecycle을 deterministic하게 검증하는
도구다.

### 포함 범위

- `mock` provider 등록
- `aco run mock review` 지원
- deterministic review output 생성
- mock output에 demo 목적 명시
- session 생성 및 `aco result` 조회 가능
- provider registry 테스트
- run/result lifecycle 테스트
- 테스트용 session store isolation 또는 session root override 경로 명시
- CI smoke에 mock flow 추가
- README에 no-auth demo path 추가

### Non-goals

- 실제 AI 품질 흉내
- provider별 auth flow 대체
- multi-provider aggregator
- artifact schema 전체 구현

### mock 출력 기준

출력에는 반드시 mock임을 명시한다.

```text
Provider: mock
Mode: deterministic demo
Purpose: validates aco run/result workflow without external credentials

Findings:
  - medium: README should show the no-auth demo path.
  - low: sync drift output would be easier to inspect with --diff.
```

### 예상 파일

- `packages/wrapper/src/providers/mock.ts`
- `packages/wrapper/src/providers/registry.ts`
- `packages/wrapper/tests/providers.test.ts`
- `packages/wrapper/tests/session.test.ts` 또는 신규 run 테스트
- `packages/wrapper/tests/smoke.ts`
- `README.md`
- `packages/wrapper/README.md`

### Acceptance criteria

- fresh clone에서 외부 provider auth 없이 mock demo가 가능하다.
- `aco run mock review`가 normal session을 생성한다.
- `aco result`로 mock output을 조회할 수 있다.
- mock provider가 registry에 등록되어 있다.
- CI smoke에서 mock flow를 검증한다.
- 출력과 문서가 mock provider를 AI 품질 데모로 오해하게 만들지 않는다.

### Verification

```bash
npm run build
npm test
npm run test:smoke
node packages/wrapper/dist/cli.js run mock review --input "demo"
node packages/wrapper/dist/cli.js result
```

demo verification은 global `~/.aco/sessions`에 의존하지 않는다. `HOME="$(mktemp -d)"` 같은
isolated home을 사용하거나, PR3 scope에 포함한 session store override 경로를 사용한 뒤
`aco result --session <id>`로 생성된 session을 명시 조회한다. published npm package path와
repo-checkout path 중 어느 경로를 fresh clone 보장 대상으로 삼는지도 PR3에서 명시한다.

### Review checklist

- mock provider가 실제 provider contract를 우회하지 않는가?
- deterministic output이 테스트에 안정적인가?
- session store 권한과 파일 쓰기 규칙을 유지하는가?
- README가 no-auth demo를 너무 크게 과장하지 않는가?

## PR 4: `aco sync --diff` / `aco sync --explain`

### 목표

context sync의 관리 대상, drift, overwrite 위험을 사용자가 파일 쓰기 없이 이해하게 한다.

### 배경

context sync는 이 레포의 핵심 차별화다. 현재 `--check`, `--dry-run`, `--force`는 있지만,
평가자와 사용자가 managed target별 상태를 한눈에 보는 표면이 부족하다.

### 포함 범위

- `aco sync --diff`
- `aco sync --explain`
- managed target별 상태 출력
- expected hash와 current hash 차이 표시
- drift, stale, unchanged 구분
- no-write 보장
- help text 갱신
- 테스트 추가
- docs/reference/context-sync.md 갱신

### Non-goals

- `aco doctor`
- interactive conflict resolver
- arbitrary project context inference
- `.acoignore` 정책 구현

### 출력 예시

```text
Managed targets:
  AGENTS.md                    changed
  GEMINI.md                    unchanged
  .codex/agents/reviewer.toml  drift detected

Drift:
  .codex/agents/reviewer.toml
    expected hash: abc123
    current hash:  def456

Recommendation:
  Review local edits before running `aco sync --force`.
```

`--explain` 예시:

```text
Canonical sources:
  CLAUDE.md
  .claude/agents/
  .claude/skills/
  .claude/settings.json

Generated targets:
  AGENTS.md
  GEMINI.md
  .codex/agents/
  .gemini/agents/

Ownership:
  Files tracked in .aco/sync-manifest.json are managed by aco.
```

### 예상 파일

- `packages/wrapper/src/cli.ts`
- `packages/wrapper/src/sync/sync-engine.ts`
- `packages/wrapper/src/sync/manifest.ts`
- `packages/wrapper/tests/sync.test.ts`
- `packages/wrapper/tests/sync-conflict.test.ts`
- `docs/reference/context-sync.md`
- `README.md`

### Acceptance criteria

- `aco sync --diff`는 파일을 수정하지 않는다.
- `aco sync --explain`은 파일을 수정하지 않는다.
- managed target별 상태가 출력된다.
- drift가 있는 대상은 expected/current hash를 확인할 수 있다.
- 기존 `--check`, `--dry-run`, `--force` 동작이 깨지지 않는다.

### Verification

```bash
npm test --workspace=packages/wrapper
npm run typecheck --workspace=packages/wrapper
node packages/wrapper/dist/cli.js sync --explain
node packages/wrapper/dist/cli.js sync --diff
```

no-write 보장은 dirty working tree가 아니라 temp fixture 또는 isolated test directory에서
검증한다. 핵심은 diff/explain 실행 전후의 fixture 파일 hash가 동일한지 확인하는 것이다.

### Review checklist

- no-write mode가 정말 파일을 쓰지 않는가?
- manifest 없는 fresh repo에서 메시지가 이해 가능한가?
- drift와 stale을 혼동하지 않는가?
- doctor가 나중에 재사용할 수 있는 내부 API가 있는가?

## PR 5: `aco doctor` v1

### 목표

사용자가 provider, auth, harness, sync 상태를 한 번에 진단하고 다음 명령을 알 수 있게 한다.

### 배경

이 프로젝트는 실패 지점이 많다. Node version, git repo 여부, provider binary, auth,
`.claude/` harness, sync manifest, drift를 한 번에 점검하는 작은 doctor가 필요하다.

### 포함 범위

- `aco doctor` command 추가
- Node version 확인
- aco version 출력
- git repository 여부 확인
- `.claude/` harness 존재 여부 확인
- provider CLI availability 확인
- provider credential-presence heuristic 확인
- sync manifest 존재 여부 확인
- drift 여부 확인
- actionable next command 출력
- tests 추가

### Non-goals

- 복잡한 secret scanning
- CI 상태 조회
- GitHub API 연동
- provider별 deep diagnostic
- 자동 수정
- interactive prompt

### 출력 예시

```text
aco doctor

Environment
  ok  Node >= 18
  ok  Git repository detected

Providers
  ok  gemini CLI found
  warn codex auth expired; run `codex login`

Harness
  ok  .claude/commands exists
  ok  .claude/agents exists
  warn GEMINI.md drift detected; run `aco sync --diff`
```

### 예상 파일

- `packages/wrapper/src/cli.ts`
- `packages/wrapper/src/commands/doctor.ts`
- `packages/wrapper/tests/doctor.test.ts`
- `packages/wrapper/package.json`
- `packages/wrapper/tests/smoke.ts`
- `README.md`
- `docs/guides/runbook.md`

### Acceptance criteria

- `aco doctor`가 success/warning/failure를 구분해 출력한다.
- provider 미설치 또는 로컬 credential/auth 파일 상태 문제 시 다음 명령을 안내한다.
- `gemini --version`, `codex --version` fallback은 인증 검증이 아니라 binary availability 확인으로 표기한다.
- drift 감지 시 `aco sync --diff` 또는 `aco sync --force` 안내가 나온다.
- doctor v1은 외부 네트워크 호출을 하지 않는다.
- provider readiness는 실제 remote auth 검증이 아니라 local heuristic임을 설명한다.
- `packages/wrapper/package.json`의 explicit test file list에 `tests/doctor.test.ts`를 추가한다.

### Verification

```bash
npm run build
npm test --workspace=packages/wrapper
npm run typecheck --workspace=packages/wrapper
node packages/wrapper/dist/cli.js doctor
```

doctor tests는 ambient machine state에 의존하지 않고 temp HOME, temp repo, mock provider binary를
사용한다. provider availability/auth heuristic, harness detection, manifest/drift 상태를 fixture로
검증한다.

### Review checklist

- doctor가 너무 많은 일을 하려 하지 않는가?
- 실패 메시지가 actionable한가?
- auth check가 secret을 출력하지 않는가?
- `sync --diff`가 없는 상태를 가정하지 않는가? 이 PR은 PR4 이후에 진행한다.

## PR 6: security model + `.acoignore` policy

### 목표

AI provider에 전달되는 context와 제외되는 sensitive file 기준을 명확히 한다.

### 배경

외부 AI provider를 호출하는 도구는 보안 인상이 중요하다. Go runtime에는 환경 변수 allowlist와
path validation 계약이 있지만, 사용자용 security model은 별도로 필요하다.

중요한 경계: public npm package의 `aco run`, `aco result`, `aco status`, `aco cancel`은
Node wrapper 경로가 담당한다. Go delegate runtime의 환경 변수 allowlist와 process execution
계약은 Go runtime 경로에만 적용된다. PR6의 security model은 두 실행면을 섞지 않고 설명해야
한다.

### 포함 범위

- `docs/security.md` 추가
- `.acoignore` 정책 문서화
- 기본 제외 예시 추가
- provider execution responsibility 설명
- context sync와 provider run의 보안 경계 설명
- secret/token 취급 원칙 설명
- Node public runtime과 Go delegate runtime의 security boundary 설명
- Node provider process가 어떤 environment/context를 받는지 현재 구현 기준으로 설명
- Go runtime allowlist가 Node wrapper 실행에 적용되지 않는다는 점 명시
- README Safety section에서 상세 문서로 링크

### Non-goals

- 완전한 secret scanner 구현
- GitHub secret scanning 대체
- provider별 sandbox 완전 보장
- `aco context inspect` 구현. 이 명령은 future command로만 언급한다.

### `.acoignore` 예시

```text
.env
.env.*
*.pem
*.key
secrets/
credentials/
node_modules/
dist/
build/
```

### 예상 파일

- `docs/security.md`
- `README.md`
- `docs/README.md`
- 필요 시 `.acoignore.example`

### Acceptance criteria

- sensitive file exclusion policy가 문서화되어 있다.
- `.acoignore` 예시가 있다.
- provider execution이 explicit하다는 점이 설명되어 있다.
- Go runtime allowlist와 Node provider 실행의 차이를 혼동하지 않는다.
- public security model이 Node wrapper 경로와 Go delegate 경로를 분리한다.
- 현재 구현되지 않은 `.acoignore` 적용이나 secret scanning을 이미 보장하는 것처럼 쓰지 않는다.
- `aco context inspect`는 future command로만 표기한다.

### Verification

```bash
npx prettier --check README.md docs/README.md docs/security.md
```

### Review checklist

- 보안 보장이 실제 구현보다 강하게 쓰이지 않았는가?
- `.gitignore`와 `.acoignore` 관계가 명확한가?
- env var allowlist가 Go runtime에만 적용되는지 설명되어 있는가?
- Node wrapper provider execution이 inherited environment를 받을 수 있는지 현재 코드 기준으로 설명했는가?
- provider가 받는 stdin/prompt/context 경계가 설명되어 있는가?

## PR 7: result artifact v1

### 목표

provider 출력 결과를 raw log뿐 아니라 사람이 검토 가능한 markdown artifact로 보존한다.

### 배경

현재 session store는 `task.json`과 `output.log` 중심이다. review 결과를 장기적으로
multi-provider aggregation과 follow-up issue로 연결하려면 artifact 표준화가 필요하다. 다만
처음부터 `findings.json` schema를 강제하면 provider output normalization 문제가 커진다.

### 포함 범위

- session metadata 정리
- `review.md` 생성
- `aco result --format text`
- `aco result --format markdown`
- mock provider 결과를 markdown artifact로 저장
- docs/reference/session-artifacts.md 추가
- tests 추가

### Optional 또는 v2

- `findings.json`
- `validation.json`
- `aco result --format json`
- `aco result --findings-only`
- severity/category/file/recommendation schema 강제

### Non-goals

- 모든 provider output을 구조화된 findings로 normalize
- AI 결과의 correctness 판단 자동화
- multi-provider aggregator
- GitHub issue 생성

### artifact v1 구조

```text
~/.aco/sessions/<session-id>/
├── task.json
├── output.log
└── review.md
```

장기 목표 구조:

```text
~/.aco/sessions/<session-id>/
├── metadata.json
├── input.md
├── prompt.md
├── output.log
├── review.md
├── findings.json
└── validation.json
```

v1에서는 기존 `task.json` 호환성을 유지한다.

### 예상 파일

- `packages/wrapper/src/session/store.ts`
- `packages/wrapper/src/cli.ts`
- `packages/wrapper/tests/session.test.ts`
- `packages/wrapper/tests/providers.test.ts`
- `docs/reference/session-artifacts.md`
- `docs/README.md`
- `README.md`

### Acceptance criteria

- provider output이 기존 `output.log`에 계속 저장된다.
- `aco run <provider> review`는 `review.md` artifact를 남긴다.
- `aco run <provider> <non-review-command>`의 artifact 생성 여부가 명확히 정의되어 있다.
- `aco result --format text`는 기존 동작과 호환된다.
- `aco result --format markdown`은 `review.md` 또는 markdown renderable output을 반환한다.
- `findings.json`은 v1에서 강제하지 않는다.

### Verification

```bash
npm run build
npm test --workspace=packages/wrapper
node packages/wrapper/dist/cli.js run mock review --input "demo"
node packages/wrapper/dist/cli.js result --format text
node packages/wrapper/dist/cli.js result --format markdown
```

### Review checklist

- 기존 session 사용자를 깨지 않는가?
- `aco result` 기본 출력이 바뀌어도 괜찮은가? 가능하면 기본은 기존 text 유지.
- review.md 생성 조건이 명확한가?
- artifact path가 사용자 홈 아래에 안전하게 생성되는가?

## PR 8 split: aggregation before follow-up

이전 계획에서는 aggregation과 follow-up을 하나의 PR로 묶었지만, 구현 범위가 크므로
PR8a와 PR8b로 분리한다.

## PR 8a: multi-provider review aggregator

### 목표

review 결과를 여러 provider 관점에서 비교하고 공통 지적과 provider별 단독 지적을 구분한다.

### 배경

이 PR은 milestone 2 또는 3로 미루는 것이 좋다. PR3 mock provider, PR7 artifact v1이 있어야
결과 비교가 의미 있게 동작한다.

### 포함 범위

- existing review session IDs를 입력으로 받는 summary command
- provider별 review session 실행은 v2로 분리
- agreed findings / provider-only findings 구분
- markdown 기반 summary 생성
- structured findings schema가 없으면 best-effort summary로 제한
- deterministic fixture 또는 mock provider 기반 테스트

### Non-goals

- AI review를 human review로 대체
- 자동 merge
- 자동 issue 생성 without confirmation
- provider output quality ranking
- 완전한 natural language deduplication
- GitHub issue draft 생성
- `/gh-pr-followup` workflow 변경
- provider process orchestration

### 전제 조건

- mock provider 또는 deterministic fixture로 aggregator 테스트 가능
- result artifact v1이 존재
- findings schema가 없으면 markdown 기반 summary로 제한
- input contract는 existing session IDs 또는 explicit artifact paths다.

### 출력 예시

```text
Multi-provider review summary

Agreed findings:
  - high: Missing conflict handling when sync manifest is corrupted

Gemini-only findings:
  - medium: README quick start lacks demo path

Codex-only findings:
  - low: Provider registry naming could be clearer

Recommended action:
  1. Fix high severity finding
  2. Convert medium findings to follow-up issues
  3. Ignore low severity naming comment for now
```

### 예상 파일

- `packages/wrapper/src/commands/review.ts`
- `packages/wrapper/src/session/store.ts`
- `packages/wrapper/tests/review.test.ts`
- `docs/guides/run-multi-provider-review.md`

### Acceptance criteria

- aggregator는 provider 결과를 공통/단독 지적으로 분리해 보여준다.
- aggregator는 이 PR에서 provider를 직접 실행하지 않고 existing session/artifact input만 소비한다.
- mock provider 또는 fixture로 CI에서 검증할 수 있다.
- structured findings가 없을 때는 markdown summary로 동작하고 stateful unresolved/ignored tracking을 요구하지 않는다.

### Verification

```bash
npm run build
npm test --workspace=packages/wrapper
npm run test:smoke
```

### Review checklist

- provider별 단독 지적을 truth처럼 단정하지 않는다.
- artifact schema가 충분히 안정된 뒤 진행하는가?

## PR 8b: follow-up draft / GitHub workflow integration

### 목표

review summary 또는 향후 structured findings를 GitHub follow-up draft로 연결한다.

### 배경

이 레포는 이미 `/gh-pr-followup`과 `github-kanban-ops` 중심의 review follow-up workflow를
문서화한다. CLI follow-up은 이 표면을 대체하지 않고, session/review artifact에서 follow-up
후보를 만드는 보조 경로로 설계해야 한다.

### 포함 후보

- `aco followup --from-session <id>` 또는 `--from-review <id>`
- unresolved finding 후보 추출
- GitHub issue body draft 생성
- `/gh-pr-followup` workflow와 연결하는 guide 업데이트
- dry-run/draft mode 테스트

### Non-goals

- 자동 issue 생성 without confirmation
- 기존 `/gh-pr-followup` slash command 대체
- GitHub write operation을 기본값으로 수행
- provider output을 확정 사실처럼 취급

### 전제 조건

- PR8a의 aggregator summary가 존재한다.
- structured findings schema가 없으면 follow-up 후보는 markdown 기반 best-effort로 제한한다.
- GitHub issue 생성은 draft 또는 explicit confirmation이 필요하다.

### 예상 파일

- `packages/wrapper/src/commands/followup.ts`
- `packages/wrapper/tests/followup.test.ts`
- `docs/guides/github-workflow.md`
- `docs/guides/run-multi-provider-review.md`

### Acceptance criteria

- follow-up은 issue draft를 만들며 자동 생성은 explicit confirmation 뒤에만 한다.
- existing `/gh-pr-followup` workflow와 책임이 충돌하지 않는다.
- GitHub API 또는 `gh`가 없는 환경에서도 dry-run/draft mode로 테스트할 수 있다.
- unresolved/ignored state가 필요하면 별도 findings schema PR을 선행 조건으로 둔다.

### Verification

```bash
npm run build
npm test --workspace=packages/wrapper
```

### Review checklist

- GitHub write operation은 명시적 confirmation 뒤에만 가능한가?
- draft body가 기존 issue/label/project 규약과 맞는가?
- slash command workflow를 대체하지 않고 보조하는가?

## Cross-PR Guardrails

### Documentation guardrails

- README는 현재 기능을 중심으로 쓰고, planned 기능은 roadmap/case study에서 분리한다.
- `docs/README.md`는 독자별 탐색 경로를 유지한다.
- `docs/roadmap.md`는 우선순위와 방향성 문서로 유지한다.
- 이 문서는 PR 실행 기준으로 유지한다.

### Testing guardrails

- provider registry 변경은 provider test를 추가한다.
- session lifecycle 변경은 session test를 추가한다.
- CLI flag 추가는 help text와 error path를 테스트한다.
- no-write command는 dirty working tree의 `git diff`가 아니라 temp fixture로 파일 쓰기 없음을 검증한다.
- docs-only PR도 markdown formatting을 확인한다.

### Security guardrails

- token, API key, OAuth content는 출력하지 않는다.
- provider auth check는 secret value를 redaction 없이 log하지 않는다.
- provider execution은 explicit command에서만 발생한다고 문서화한다.
- `.acoignore`는 provider context policy와 연결될 때까지 과장하지 않는다.

### Portfolio guardrails

- "AI-native"라는 표현은 workflow 설계 맥락에서만 사용한다.
- mock provider는 AI 품질이 아니라 runtime/session/result 검증을 위한 도구로 설명한다.
- limitations를 README 또는 case study에 반드시 둔다.
- Node/Go split은 장점뿐 아니라 complexity trade-off도 설명한다.

## 현재 저장 상태

2026-04-24 기준:

- `docs/roadmap.md`: 방향성 리뷰와 issue 후보를 저장한다.
- `docs/pr-implementation-plan.md`: PR1-PR8a/8b 실행 기준을 저장한다.
- `docs/archive/2026-04-24-gpt-pro-direction-raw.md`: 원본 GPT Pro 제안과 평가를 보존한다.

기본 개발 기준은 이 문서와 `docs/roadmap.md`를 사용한다. archive 문서는 판단 근거 추적용이며,
현재 실행 기준으로 직접 사용하지 않는다.
