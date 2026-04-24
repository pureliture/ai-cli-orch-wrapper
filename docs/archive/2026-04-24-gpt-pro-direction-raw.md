# GPT Pro 방향성 제안 원문

작성일: 2026-04-24

> Historical-only raw note.
> 이 문서는 당시 제공된 GPT Pro 메모를 보존하기 위한 archive 기록이며, 현재 프로젝트
> 포지셔닝이나 구현 기준의 source of truth가 아니다. 현재 기준은
> [../roadmap.md](../roadmap.md)와
> [../pr-implementation-plan.md](../pr-implementation-plan.md)를 따른다.
> 아래 원문에는 현재 구현되지 않은 명령, 과거 우선순위, 이후 조정된 artifact/security 범위가
> 포함되어 있다. issue 후보와 PR 순서는 provenance로만 읽고 active backlog로 사용하지 않는다.

이 문서는 `ai-cli-orch-wrapper` 개선 방향을 논의할 때 사용자가 제공한 GPT Pro 검토
메모를 원문 보존용으로 저장한다. 현재 실행 기준은
[../roadmap.md](../roadmap.md)와 [../pr-implementation-plan.md](../pr-implementation-plan.md)를
따른다.

## 1차 방향성 제안 원문

내 판단은 이렇습니다.
**이 레포는 기능을 더 많이 넣는 것보다, “왜 이게 필요한지”와 “실제로 어떻게 쓰는지”를 30초 안에 보여주는 방향으로 개선해야 가장 잘 통합니다.** 업로드해준 검토 메모에서도 이 프로젝트는 백엔드 API 서버 포트폴리오라기보다, **AI-native 개발 워크플로우를 증명하는 보조 레퍼런스**로 쓰는 게 적합하다고 정리되어 있는데, 이 방향에 동의합니다.

현재 레포는 이미 꽤 좋은 재료를 갖고 있습니다. README 기준으로 `aco` CLI, 설치 가능한 npm 패키지, repo-local harness, context sync, provider runtime을 함께 다루고 있고, 주요 provider로 Gemini와 Codex를 설명하고 있습니다. 아키텍처 문서도 Node wrapper CLI와 Go runtime을 분리하고, Claude 기준 자산을 Codex/Gemini 대상 파일로 동기화하며 manifest로 drift를 추적하는 구조를 설명합니다. CI도 lint, contract, typecheck, test, go-build, go-test, smoke, fixtures로 나뉘어 있어 “장난감 프로젝트”보다는 운영 가능한 CLI에 가깝게 보입니다.

문제는 **처음 보는 사람이 이 가치를 바로 이해하기 어렵다**는 점입니다.

---

## 1. 개선 방향의 핵심: “AI CLI wrapper”가 아니라 “AI 개발 워크플로우 하네스”로 보이게 만들기

지금 이름과 설명만 보면 채용자나 리뷰어가 이렇게 오해할 수 있습니다.

> “Claude, Codex, Gemini CLI를 호출하는 래퍼인가?”

그런데 이 레포가 진짜로 어필할 수 있는 지점은 단순 wrapper가 아닙니다.

더 강한 포지셔닝은 이쪽입니다.

```text
AI CLI를 단발성 코드 생성 도구로 쓰지 않고,
프로젝트 컨텍스트, PR 리뷰, 세션 관리, provider 실행, 검증 결과를
하나의 반복 가능한 개발 워크플로우로 묶는 repo-local AI workflow harness.
```

즉, README 첫 문장을 바꾸는 게 중요합니다.

현재 느낌:

```text
Claude Code 하네스를 외부 AI CLI와 연결하기 위한 aco CLI
```

개선된 느낌:

```text
ai-cli-orch-wrapper is a repo-local AI workflow harness that connects Claude Code,
Codex CLI, and Gemini CLI into repeatable development workflows:
context sync, provider execution, PR review, session tracking, and validation.
```

한국어 포트폴리오용으로는 이렇게 잡으면 좋습니다.

```text
Claude Code, Codex CLI, Gemini CLI를 하나의 개발 워크플로우로 묶기 위한
repo-local AI workflow harness입니다.

단순히 AI CLI를 호출하는 wrapper가 아니라,
프로젝트 컨텍스트 동기화, provider별 실행 추상화, PR 리뷰 자동화,
세션 기록, 결과 조회, CI 검증까지 포함한 개발 자동화 도구로 설계했습니다.
```

이 문장이 레포의 첫 화면에 있어야 합니다.

---

## 2. 가장 먼저 고칠 것: README의 “첫 1분 경험”

이 프로젝트는 이미 구조가 복잡합니다. Node, Go, Claude Code, Codex, Gemini, OpenSpec, GitHub Workflow, slash command가 한 번에 등장합니다. 그래서 처음 읽는 사람은 “오, 많다”는 생각은 하지만 “그래서 뭘 해결하지?”를 놓칠 수 있습니다.

README 맨 위를 아래 순서로 바꾸는 걸 추천합니다.

```md
# ai-cli-orch-wrapper

## What is this?

One CLI to turn AI coding tools into a repeatable repo-local workflow.

## Why?

AI CLI tools are powerful, but each tool has different context files,
auth flows, command styles, and output formats. This project standardizes
those differences into a project-level harness.

## Core workflow

1. Install command pack
2. Sync Claude Code context to Codex/Gemini targets
3. Run multi-provider review
4. Store session output
5. Inspect result/status/cancel
6. Feed review output into PR follow-up workflow

## Demo

<짧은 터미널 GIF 또는 asciinema 링크>

## Quick Start

...
```

특히 `Why?`가 중요합니다. 지금은 “설치 방법”이 빨리 나오는데, 채용자 관점에서는 설치보다 먼저 **문제 정의**를 보고 싶어합니다.

---

## 3. “차별화 포인트”를 명시해야 함

AI CLI 오케스트레이션 계열은 이미 비슷한 흐름의 도구들이 나올 수밖에 없습니다. 예를 들어 PyPI에 공개된 `jleechanorg-orchestration`은 Claude, Codex, Gemini, Cursor 같은 agent CLI를 대상으로 unified run, dispatcher, tmux 기반 세션 격리, task state를 제공한다고 설명되어 있습니다. ([PyPI][1]) 또 `CliRelay`는 여러 AI CLI 도구를 OpenAI/Gemini/Claude/Codex 호환 API 서비스로 감싸는 방향을 내세웁니다. ([GitHub][2])

그래서 이 레포가 “또 하나의 multi-AI CLI wrapper”로 보이면 약합니다.
차별화는 아래처럼 잡아야 합니다.

| 영역        | 일반 AI CLI wrapper           | 이 레포의 차별화 방향                                      |
| ----------- | ----------------------------- | ---------------------------------------------------------- |
| 실행        | 여러 CLI를 호출               | repo-local workflow로 묶음                                 |
| 컨텍스트    | prompt/context 파일 수동 관리 | Claude 기준 자산을 Codex/Gemini 대상으로 sync              |
| 산출물      | stdout 출력                   | session/result/status/cancel로 실행 기록 관리              |
| 리뷰        | AI에게 리뷰 요청              | PR workflow, follow-up issue, multi-provider 검증으로 연결 |
| 운영        | 개인 스크립트                 | npm package + CI + smoke + fixtures                        |
| 채용 포인트 | AI 도구 사용 경험             | AI-native 개발 프로세스 설계 경험                          |

이 표 같은 내용을 README나 `docs/case-study.md`에 넣으면 좋습니다.

---

## 4. 가장 강한 킬러 기능은 `context sync`로 밀기

내 기준에서 이 레포의 제일 좋은 소재는 **context sync**입니다.

공식 GitHub Copilot CLI 문서도 repo-level instruction 파일로 `AGENTS.md`, `GEMINI.md`, `CODEX.md` 같은 위치를 언급하고 있습니다. ([GitHub Docs][3]) 즉, 여러 AI coding tool이 repo-local instruction/context를 읽는 방향은 이미 자연스러운 흐름입니다.

따라서 이 레포의 핵심 가치는 이렇게 말할 수 있습니다.

> “각 AI CLI마다 컨텍스트 파일을 따로 관리하면 drift가 생긴다.
> 이 프로젝트는 Claude Code 기준 자산을 canonical source로 두고, Codex/Gemini 대상 파일을 생성 산출물로 관리한다.”

이건 실무적으로 꽤 설득력 있습니다.
개선 아이디어는 다음과 같습니다.

### `aco sync --diff` 추가

현재 `aco sync --check`, `aco sync`, `aco sync --force`가 있다면, 채용자/사용자에게 더 직관적인 명령은 `--diff`입니다.

```bash
aco sync --diff
```

출력 예시:

```text
Managed targets:
  AGENTS.md              changed
  GEMINI.md              unchanged
  .codex/agents/reviewer.md  drift detected

Drift:
  .codex/agents/reviewer.md
    expected hash: abc123
    current hash:  def456

Recommendation:
  Run `aco sync --force` only if local manual edits can be overwritten.
```

이게 있으면 manifest 기반 drift 추적이 “문서 속 개념”이 아니라 “동작하는 운영 기능”으로 보입니다.

### `aco sync --explain` 추가

```bash
aco sync --explain
```

출력 예시:

```text
Canonical source:
  .claude/agents/
  .claude/skills/
  .claude/settings.json

Generated targets:
  AGENTS.md
  GEMINI.md
  .codex/agents/
  .gemini/agents/

Ownership:
  Files with ACO_MANAGED_BLOCK are managed by aco.
  Manual edits outside managed blocks are preserved.
```

이건 데모에서 매우 좋습니다.

---

## 5. 반드시 넣으면 좋은 기능: `aco doctor`

채용자나 신규 사용자가 레포를 봤을 때 가장 신뢰를 주는 CLI 명령은 보통 `doctor`입니다.

```bash
aco doctor
```

검사 항목은 이런 식이면 좋습니다.

```text
aco doctor

Environment
  ✓ Node >= 18
  ✓ aco CLI installed
  ✓ Git repository detected

Providers
  ✓ gemini CLI found
  ✓ codex CLI found
  ! codex auth expired; run `codex login`

Harness
  ✓ .claude/commands exists
  ✓ .claude/agents exists
  ✓ .aco/sync-manifest.json exists
  ! GEMINI.md drift detected; run `aco sync --diff`

Security
  ✓ .acoignore found
  ✓ no obvious secret patterns in managed context files

CI
  ✓ package smoke command available
```

이 명령 하나만 있어도 프로젝트가 “실사용을 고려했다”는 인상을 줍니다.

특히 이 레포는 provider 인증, context sync, pack install, session store 등 실패 지점이 많습니다. `doctor`는 그 복잡성을 사용자 경험으로 흡수하는 좋은 장치입니다.

---

## 6. 데모 가능성을 위해 `mock provider` 또는 `dry-run provider`를 넣기

이 레포를 포트폴리오로 쓸 때 가장 큰 약점은, 보는 사람이 바로 실행해보기 어렵다는 점입니다. Codex/Gemini 인증이 필요하고, Claude Code 환경도 필요할 수 있습니다.

그래서 **인증 없이 실행 가능한 mock provider**가 있으면 매우 강합니다.

```bash
aco run mock review
```

출력 예시:

```text
[mock-provider] Review completed

Findings:
  - medium: Missing sync conflict test for manual edits outside managed block
  - low: README quick start does not show full PR review workflow

Suggested next command:
  aco result
```

또는:

```bash
aco demo init
aco demo review
```

이렇게 하면 채용 담당자나 면접관이 실제 provider 없이도 “아, 이 도구가 이런 흐름이구나”를 바로 이해합니다.

README에는 이런 식의 데모 섹션을 넣으면 좋습니다.

```bash
# No API key required
npx @pureliture/ai-cli-orch-wrapper demo init
cd aco-demo
aco run mock review
aco result
```

이건 포트폴리오 관점에서 효과가 큽니다.

---

## 7. PR 리뷰 산출물을 “artifact”로 표준화하기

지금은 `aco result`, `aco status`, `aco cancel` 같은 session-aware 명령이 있다는 점이 강점입니다. README도 session 상태와 실패 추적을 핵심 포인트로 설명합니다.

여기서 한 단계 더 나아가면 좋습니다.

AI 리뷰 결과를 그냥 로그로 두지 말고, 사람이 검토 가능한 **표준 artifact**로 남기는 겁니다.

예시:

```text
.aco/sessions/<session-id>/
├── metadata.json
├── input.md
├── prompt.md
├── output.log
├── review.md
├── findings.json
└── validation.json
```

`findings.json`은 이런 구조면 좋습니다.

```json
{
  "provider": "gemini",
  "command": "review",
  "startedAt": "2026-04-24T10:00:00Z",
  "durationMs": 18342,
  "findings": [
    {
      "severity": "medium",
      "category": "test",
      "file": "packages/wrapper/src/sync.ts",
      "summary": "Sync drift branch lacks regression coverage",
      "recommendation": "Add sync-conflict fixture for manual edit preservation"
    }
  ],
  "validation": {
    "typecheck": "passed",
    "tests": "passed"
  }
}
```

그 다음 명령은 이렇게 갈 수 있습니다.

```bash
aco result --format markdown
aco result --format json
aco result --findings-only
```

이 기능은 “AI-native”를 주장할 때 매우 좋습니다.
왜냐하면 AI 결과를 휘발성 답변이 아니라, **검토 가능한 개발 산출물**로 바꾸기 때문입니다.

---

## 8. Multi-provider review aggregator 만들기

현재 레포는 Gemini와 Codex를 주요 provider로 설명하고, GitHub workflow 문서에서는 `/octo:*`, `/gh-pr:multi`, multi-AI review 흐름을 언급합니다. 이걸 더 선명하게 만들면 좋습니다.

예를 들어:

```bash
aco review --providers gemini,codex --target pr
```

결과:

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

이건 단순히 Gemini와 Codex를 병렬 실행하는 게 아니라, **서로 다른 AI 리뷰 결과를 비교하고 사람이 의사결정하기 좋게 정리하는 기능**입니다.

채용 관점에서 특히 좋습니다.

> “AI를 맹신하지 않고, 여러 AI 리뷰 결과를 비교해 공통 지적과 단독 지적을 분리했습니다.”

이 메시지가 6년차 개발자답습니다.

---

## 9. `aco followup`으로 리뷰 결과를 GitHub issue로 전환

이 레포는 GitHub issue/PR 운영 규약도 갖고 있습니다. `/gh-issue`, `/gh-start`, `/gh-pr`, `/gh-pr-followup` 같은 명령으로 이슈/PR 흐름을 관리하는 문서가 있습니다.

여기서 개선할 수 있는 좋은 기능은:

```bash
aco followup --from-session <session-id>
```

역할:

1. AI 리뷰 결과 중 unresolved finding을 읽음
2. severity/category에 따라 issue 후보 생성
3. 사람이 확인
4. GitHub issue body 초안 생성

출력 예시:

```text
3 follow-up candidates found.

[1] type:bug p1
    title: fix sync drift overwrite when manifest hash mismatches

[2] type:task p2
    title: add README demo for mock provider review flow

[3] type:chore p2
    title: align root package description with provider support

Create issue drafts? [y/N]
```

이건 포트폴리오 스토리로 매우 좋습니다.

> “AI 리뷰를 일회성 코멘트로 끝내지 않고, 후속 이슈와 작업 관리로 연결했습니다.”

---

## 10. 보안/거버넌스 문서를 반드시 추가하기

AI-native 개발 도구에서 채용자가 민감하게 보는 건 보안입니다.

지금 레포는 provider 인증 fast-path, env key, OAuth file 등을 다루기 때문에 더더욱 보안 문서가 필요합니다. README에 아주 짧게라도 다음 섹션을 넣는 게 좋습니다.

```md
## Security model

aco never intentionally sends the following to external providers:

- `.env`
- private keys
- access tokens
- files ignored by `.acoignore`
- files ignored by `.gitignore` when configured

Provider execution is explicit. `aco sync` only writes managed target files.
```

그리고 `.acoignore`를 도입하면 좋습니다.

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

추가로:

```bash
aco context inspect
```

출력:

```text
Files included in provider context:
  CLAUDE.md
  .claude/agents/reviewer.md
  .claude/settings.json

Files excluded:
  .env                 matched .acoignore
  secrets/token.json   matched .acoignore
```

이 기능은 실제 보안에도 좋고, 채용자에게도 좋습니다.

---

## 11. Node wrapper와 Go runtime 경계를 더 명확히 하기

현재 아키텍처는 Node wrapper CLI와 Go runtime으로 나뉘어 있습니다. Node는 설치, command pack, sync, provider 실행, session log를 담당하고, Go runtime은 `aco delegate`와 blocking provider 실행을 담당한다고 설명되어 있습니다.

이 구조는 흥미롭지만, 처음 보는 사람에게는 약간 헷갈릴 수 있습니다.

특히 둘 다 `aco run` 계열에 관여하는 것처럼 보이면 질문이 나올 수 있습니다.

> “왜 Node와 Go가 둘 다 필요한가요?”
> “어느 쪽이 public runtime인가요?”
> “Go runtime은 npm 패키지에 포함되나요?”
> “Node session store와 Go blocking runtime은 어떻게 연결되나요?”

이 질문에 답하는 문서를 하나 만들면 좋습니다.

```text
docs/architecture/runtime-boundary.md
```

내용:

```md
# Runtime Boundary

## Public surface

- npm package: @pureliture/ai-cli-orch-wrapper
- public CLI: aco

## Node wrapper responsibilities

- package installation
- pack setup
- provider setup
- context sync
- session store
- result/status/cancel

## Go runtime responsibilities

- blocking delegate execution
- provider process control
- formatter-based model routing

## Why two runtimes?

Node is used for npm distribution and repo-local package UX.
Go is used for process-oriented blocking execution and portable runtime experiments.

## Current limitation

Node session lifecycle and Go delegate lifecycle are intentionally separate.
```

이렇게 솔직하게 써두면 오히려 신뢰가 생깁니다.

---

## 12. 작은 불일치 정리: root package 설명부터 고치기

업로드 메모에서도 지적된 부분인데, root `package.json` 설명은 Gemini CLI 중심으로 보이고, README/architecture는 Gemini와 Codex를 주요 provider로 설명합니다. 실제 `packages/wrapper/package.json`은 command pack setup, provider setup, execution, session lifecycle을 담당하는 `aco` CLI package라고 설명되어 있습니다.

이런 작은 불일치는 별거 아닌 것 같지만, 포트폴리오에서는 손해입니다.
면접관이 보면 “정리 중인 프로젝트인가?”라고 느낄 수 있습니다.

바꾸면 좋은 표현:

```json
{
  "description": "Repo-local AI workflow harness for Claude Code, Codex CLI, and Gemini CLI."
}
```

혹은:

```json
{
  "description": "Installable aco CLI for AI provider setup, context sync, review workflows, and session lifecycle."
}
```

---

## 13. 문서 구조는 “사용자용 / 평가자용 / 기여자용”으로 나누기

현재 문서가 많고, 구조도 나름 잡혀 있습니다. 하지만 포트폴리오 관점에서는 평가자가 볼 문서가 따로 있어야 합니다.

추천 문서 구조:

```text
README.md
docs/
  case-study.md              # 채용자/평가자용
  getting-started.md         # 사용자용
  architecture.md            # 기술 설계
  runtime-boundary.md        # Node/Go 경계
  reference/
    config.md
    context-sync.md
    provider-contract.md
    session-artifacts.md
  guides/
    add-provider.md
    run-multi-provider-review.md
    github-workflow.md
  security.md
  roadmap.md
```

특히 `docs/case-study.md`를 강력 추천합니다.

내용은 이렇게 구성하면 됩니다.

```md
# Case Study: Building a repo-local AI workflow harness

## Problem

AI coding tools are powerful, but each provider has different context files,
auth flows, command styles, and output formats.

## Constraints

- Must work as an npm-installable CLI
- Must support repo-local Claude Code harness
- Must avoid overwriting generated context files accidentally
- Must support provider-specific auth and execution
- Must preserve review outputs as inspectable artifacts

## Design

- Node wrapper for package UX and session lifecycle
- Go runtime for blocking provider execution
- Manifest-based context sync
- Provider abstraction
- GitHub issue/PR workflow commands

## Trade-offs

- Node/Go split increases complexity
- Provider CLI behavior can change
- Multi-provider output requires normalization
- Auth detection must avoid leaking secrets

## Result

...
```

이 문서는 이력서 링크에 가장 좋습니다.

---

## 14. “실패와 한계” 섹션을 넣으면 오히려 더 강해짐

좋은 포트폴리오는 성공만 말하지 않습니다.
6년차라면 한계와 trade-off를 말하는 게 더 강합니다.

README나 case study에 이런 섹션을 넣으면 좋습니다.

```md
## Limitations

- This project does not replace human code review.
- Provider outputs are advisory and must be validated by tests and maintainers.
- Node and Go runtimes currently have separate lifecycle models.
- Provider CLI behavior may change without stable machine-readable APIs.
- Context sync only manages known generated targets and does not infer arbitrary project context.
```

이런 문장은 “AI를 맹신하지 않는 사람”으로 보이게 합니다.

---

## 15. 개선 우선순위

내가 실제로 이 레포를 개선한다면 순서는 이렇게 잡겠습니다.

| 우선순위 | 작업                              | 이유                                    |
| -------- | --------------------------------- | --------------------------------------- |
| P0       | README 첫 화면 개편               | 채용자/사용자가 가치를 바로 이해해야 함 |
| P0       | root/package 설명 불일치 수정     | 작은 불일치가 신뢰를 깎음               |
| P0       | `docs/case-study.md` 추가         | 포트폴리오 링크로 가장 강함             |
| P1       | mock provider 또는 demo mode 추가 | 인증 없이 실행 가능한 데모가 필요       |
| P1       | `aco doctor` 추가                 | 복잡한 환경을 진단 가능하게 만듦        |
| P1       | `aco sync --diff` 추가            | context sync의 강점을 체감 가능하게 함  |
| P1       | session artifact 표준화           | AI 결과를 검증 가능한 산출물로 만듦     |
| P2       | multi-provider review aggregator  | “AI-native workflow”의 차별화 포인트    |
| P2       | `.acoignore`와 security model     | 보안 우려를 선제적으로 해소             |
| P2       | `aco followup` issue draft        | AI review → 작업 관리로 연결            |
| P3       | provider plugin contract          | 확장성 어필                             |
| P3       | metrics/report command            | before/after 성과 측정 가능             |

---

## 16. 바로 만들 수 있는 GitHub issue 후보

레포 개선을 실제 이슈로 쪼갠다면 이렇게 가면 좋습니다.

### Issue 1: `docs: reposition README around AI workflow harness`

```md
## Purpose

README 첫 화면에서 이 프로젝트가 단순 AI CLI wrapper가 아니라
repo-local AI workflow harness임을 명확히 설명한다.

## Scope

- Add 30-second explanation
- Add problem/solution section
- Add core workflow diagram
- Move installation below value proposition
- Add portfolio-oriented case study link

## Acceptance Criteria

- [ ] README 첫 화면에서 문제, 대상 사용자, 핵심 workflow가 보인다
- [ ] `Why not just use Codex/Gemini/Claude directly?` 섹션이 있다
- [ ] 설치 전에 demo 또는 core workflow가 먼저 설명된다
```

### Issue 2: `feat(cli): add aco doctor`

```md
## Purpose

사용자가 provider, auth, harness, sync 상태를 한 번에 진단할 수 있게 한다.

## Scope

- Check Node version
- Check git repository
- Check aco installation
- Check provider CLI availability
- Check provider auth state
- Check `.claude/` harness
- Check sync manifest and drift
- Print actionable next command

## Acceptance Criteria

- [ ] `aco doctor`가 성공/경고/실패를 구분해 출력한다
- [ ] provider 미설치 또는 auth 만료 시 다음 명령을 안내한다
- [ ] drift 감지 시 `aco sync --diff` 또는 `aco sync --force` 안내가 나온다
```

### Issue 3: `feat(sync): add sync diff and explain commands`

```md
## Purpose

context sync의 관리 대상, drift, overwrite 위험을 사용자가 이해할 수 있게 한다.

## Scope

- Add `aco sync --diff`
- Add `aco sync --explain`
- Show managed targets
- Show changed/unchanged/drift state
- Avoid writing files in diff/explain mode

## Acceptance Criteria

- [ ] managed target별 상태가 출력된다
- [ ] manifest hash와 current hash 차이를 볼 수 있다
- [ ] 아무 파일도 수정하지 않는다
```

### Issue 4: `feat(provider): add mock provider for demo`

```md
## Purpose

외부 API key나 provider auth 없이도 프로젝트의 핵심 workflow를 데모할 수 있게 한다.

## Scope

- Register `mock` provider
- Support `aco run mock review`
- Generate deterministic review output
- Store normal session artifact
- Include README demo path

## Acceptance Criteria

- [ ] fresh clone에서 API key 없이 demo가 가능하다
- [ ] `aco result`로 mock output을 조회할 수 있다
- [ ] CI smoke에서 mock provider 경로를 검증한다
```

### Issue 5: `feat(result): standardize review artifact output`

```md
## Purpose

AI provider 출력 결과를 사람이 검토 가능한 markdown/json artifact로 보존한다.

## Scope

- Add `review.md`
- Add `findings.json`
- Add provider metadata
- Add duration, command, status, exit code
- Add `aco result --format json|markdown`

## Acceptance Criteria

- [ ] provider output이 raw log와 structured result로 모두 저장된다
- [ ] severity/category/file/recommendation을 표현할 수 있다
- [ ] result command에서 format 선택이 가능하다
```

### Issue 6: `docs: add security model and .acoignore guide`

```md
## Purpose

AI provider에 전달되는 context와 제외되는 sensitive file 기준을 명확히 한다.

## Scope

- Add `docs/security.md`
- Add `.acoignore` reference
- Document secret redaction policy
- Document provider execution responsibility
- Add examples for `.env`, keys, tokens, credentials

## Acceptance Criteria

- [ ] sensitive file exclusion policy가 문서화되어 있다
- [ ] `.acoignore` 예시가 있다
- [ ] provider에 전달되는 context를 확인하는 방법이 있다
```

---

## 17. 채용/포트폴리오 관점 최종 개선안

이 레포를 정말 잘 통하게 만들려면, 최종적으로 다음 3개 링크만으로 설명 가능해야 합니다.

```text
1. README.md
   → 이 프로젝트가 무엇이고, 왜 필요한지, 어떻게 실행하는지

2. docs/case-study.md
   → 어떤 문제를 어떤 설계로 풀었는지

3. examples/mock-review-session/
   → 실제 실행 결과와 session artifact
```

이 세 개가 있으면 면접관이 긴 문서를 다 읽지 않아도 됩니다.

그리고 이력서에는 이렇게 연결하면 좋습니다.

```text
AI CLI orchestration wrapper 개발
Claude Code 중심의 repo-local harness를 Codex/Gemini CLI와 연결하여,
컨텍스트 동기화, provider 실행 추상화, PR 리뷰 자동화, 세션 artifact 관리,
CI smoke/fixture 검증까지 포함한 AI-native 개발 워크플로우를 설계했습니다.
```

---

## 최종 추천

가장 먼저 할 일은 기능 추가가 아니라 **포지셔닝 정리**입니다.

내가 추천하는 1차 개선 순서는 이겁니다.

```text
1. README 첫 화면 개편
2. root/package 설명 불일치 수정
3. docs/case-study.md 추가
4. mock provider로 인증 없는 demo 제공
5. aco doctor 추가
6. sync --diff / --explain 추가
7. session artifact를 markdown/json으로 표준화
```

이렇게 개선하면 이 레포는 단순 개인 자동화 스크립트가 아니라,
**“AI를 개발 조직의 워크플로우로 제품화할 수 있는 개발자”**를 보여주는 꽤 강한 사이드 프로젝트가 됩니다.

[1]: https://pypi.org/project/jleechanorg-orchestration/0.1.61/?utm_source=chatgpt.com 'jleechanorg-orchestration · PyPI'
[2]: https://github.com/kittors/CliRelay?utm_source=chatgpt.com 'GitHub - kittors/CliRelay: Wrap Gemini CLI, Antigravity, ChatGPT Codex, Claude Code, Qwen Code, iFlow as an OpenAI/Gemini/Claude/Codex compatible API service, allowing you to enjoy the free Gemini 2.5 Pro, GPT 5, Claude, Qwen model through API · GitHub'
[3]: https://docs.github.com/ko/copilot/how-tos/copilot-cli/cli-best-practices?utm_source=chatgpt.com 'GitHub Copilot CLI에 대한 모범 사례 - GitHub 문서'

## 2차 실행계획 평가 원문

좋은 방향입니다. **전략 자체는 맞고, PR 순서도 대체로 합리적입니다.**
내가 평가하면 **8.5/10** 정도입니다.

핵심을 잘 잡았습니다. 이 레포의 가장 큰 문제는 기능 부족이 아니라, 처음 보는 사람이 “그래서 이게 왜 필요한데?”를 바로 이해하기 어렵다는 점입니다. 이전 검토 메모에서도 이 레포는 백엔드 API 서버 포트폴리오라기보다 **AI-native 개발 워크플로우를 증명하는 보조 레퍼런스**로 쓰는 게 좋다고 정리되어 있었는데, 지금 제안한 4단계는 그 방향과 잘 맞습니다.

## 총평

제안한 개선 방식은 좋습니다.

특히 이 흐름이 마음에 듭니다.

```text
포지셔닝 정리
→ 평가자용 증거 문서
→ 인증 없는 데모
→ 운영 기능 강화
```

이 순서가 좋은 이유는, **기능을 더 만들기 전에 평가자가 이해할 수 있는 형태로 먼저 바꾸기 때문**입니다.
이 레포는 이미 README에서 `aco` CLI, npm 패키지, repo-local harness, context sync, provider runtime, Gemini/Codex provider를 설명하고 있습니다. 즉, 재료는 있습니다. 문제는 이 재료가 “강한 한 문장”으로 묶이지 않는다는 점입니다.

그래서 PR 1에서 첫인상을 바꾸고, PR 2에서 case study를 만들고, PR 3에서 바로 실행 가능한 mock demo를 넣는 순서는 매우 좋습니다.

## 가장 잘 잡은 부분

### 1. README/package부터 고치겠다는 판단이 맞음

기능부터 추가하지 않고 README와 package metadata부터 손대는 건 좋은 판단입니다.

현재 root `package.json` 설명은 “Claude Code slash-command pack for Gemini CLI”에 가깝게 보일 수 있습니다. 반면 wrapper package 쪽은 command pack setup, provider setup, execution, session lifecycle을 담당하는 `aco` CLI로 설명됩니다.

이런 작은 불일치는 포트폴리오에서 꽤 치명적일 수 있습니다.
면접관이 보면 이렇게 느낄 수 있습니다.

> “아직 정리 중인 프로젝트인가?”
> “Gemini용 도구인가, Codex/Gemini 통합 도구인가?”
> “Claude Code 하네스인가, 일반 AI CLI wrapper인가?”

그래서 PR 1은 단순 문서 수정이 아니라 **프로젝트 정체성을 고정하는 작업**입니다. 가장 먼저 하는 게 맞습니다.

### 2. `docs/case-study.md`를 넣는 것도 좋음

이건 포트폴리오 관점에서 매우 효과적입니다.

README는 사용자용 문서이고, case study는 평가자용 문서입니다.
채용자나 실무 면접관은 전체 코드를 다 보지 않습니다. 대신 이런 걸 봅니다.

```text
무슨 문제를 풀었나?
왜 이런 설계를 했나?
어떤 trade-off가 있었나?
어디까지 동작하고, 어디부터는 한계인가?
```

이 레포는 아키텍처상 Node wrapper CLI와 Go runtime을 나누고, Node는 설치/pack/sync/session을 담당하며, Go runtime은 `aco delegate`와 blocking provider 실행을 담당한다고 설명합니다. 또 Claude 기준 자산을 Codex/Gemini 대상 파일로 동기화하고 manifest로 drift를 추적하는 구조도 있습니다.

이런 설계는 README에 길게 풀면 부담스럽습니다.
대신 `docs/case-study.md`에서 설명하면 아주 좋습니다.

### 3. mock provider는 거의 필수에 가까움

PR 3의 mock provider는 정말 좋은 선택입니다.

이 레포의 가장 큰 약점은 평가자가 바로 실행하기 어렵다는 점입니다.
Codex/Gemini 인증이 필요하고, Claude Code 하네스 맥락도 알아야 합니다. 그러면 채용자는 실행을 포기하고 README만 훑습니다.

그런데 아래 흐름이 되면 완전히 달라집니다.

```bash
npx @pureliture/ai-cli-orch-wrapper pack setup
aco run mock review
aco result
```

또는 더 간단히:

```bash
aco run mock review
aco result
```

이게 되면 레포가 “설명만 많은 프로젝트”에서 **직접 확인 가능한 CLI 프로젝트**가 됩니다.

특히 mock provider는 단순 장난감이 아니라, session/result 구조를 보여주는 데 매우 좋습니다. 실제 provider 인증 없이도 `aco run → session 기록 → result 조회`라는 핵심 workflow를 증명할 수 있기 때문입니다.

## 다만 보완하면 좋은 부분

현재 계획은 좋지만, 몇 가지 조정하면 더 탄탄해집니다.

## 1. PR 1에 “Non-goals”를 꼭 넣는 게 좋음

“repo-local AI workflow harness”라는 표현은 강하지만, 약간 추상적입니다.
자칫하면 너무 거창해 보일 수 있습니다.

README에 아래 섹션을 짧게 넣는 걸 추천합니다.

```md
## What this is not

- This is not a replacement for human code review.
- This is not a general-purpose AI agent platform.
- This does not train or fine-tune models.
- This does not automatically merge AI-generated code.
- This is a repo-local workflow harness for coordinating AI CLI tools.
```

이걸 넣으면 오히려 신뢰도가 올라갑니다.

왜냐하면 “AI-native” 프로젝트에서 가장 위험한 인상은 **AI가 다 해준다**는 느낌이기 때문입니다.
이 레포는 그렇게 보여서는 안 됩니다.
“AI CLI를 운영 가능한 개발 workflow에 연결한다”가 핵심이어야 합니다.

## 2. PR 2 case study는 README 반복이 되면 안 됨

`docs/case-study.md`가 README의 긴 버전이 되면 효과가 떨어집니다.

case study는 반드시 아래 구조여야 합니다.

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
- Mock provider is for demo only
- Real provider output quality varies
- Node and Go lifecycle boundaries are still evolving
```

이 문서가 있으면 면접에서 거의 그대로 설명할 수 있습니다.

## 3. PR 3 mock provider에는 “가짜 결과”라는 표시가 명확해야 함

mock provider는 데모용으로 좋지만, 잘못 만들면 역효과도 있습니다.

예를 들어 mock provider가 너무 그럴듯한 리뷰 결과를 내면, 평가자가 이렇게 볼 수 있습니다.

> “이거 그냥 가짜 출력 아닌가?”

그래서 mock provider는 목적을 명확히 해야 합니다.

좋은 방향:

```text
mock provider는 AI 품질을 보여주기 위한 것이 아니라,
provider runtime, session lifecycle, result command, artifact format을
인증 없이 검증하기 위한 deterministic provider입니다.
```

출력도 이렇게 표시하는 게 좋습니다.

```text
Provider: mock
Mode: deterministic demo
Purpose: validates aco run/result workflow without external credentials
```

그리고 PR 3에는 반드시 테스트가 있어야 합니다.

```text
- mock provider 등록 테스트
- aco run mock review 실행 테스트
- session 생성 테스트
- aco result 조회 테스트
- CI smoke에 mock flow 추가
```

이렇게 해야 “데모용 장식”이 아니라 “테스트 가능한 provider contract”로 보입니다.

## 4. PR 4와 PR 5 순서는 현재대로 괜찮음

`aco sync --diff / --explain` 다음에 `aco doctor`를 넣는 순서는 좋습니다.

이유는 `doctor`가 제대로 유용하려면 내부적으로 확인할 수 있는 상태가 많아야 합니다.
`sync --diff`가 먼저 생기면 `doctor`가 이런 식으로 안내할 수 있습니다.

```text
! GEMINI.md drift detected
  Run: aco sync --diff
```

즉, PR 4가 PR 5의 재료가 됩니다.

다만 PR 5의 `aco doctor`는 범위가 쉽게 커질 수 있으니 v1은 작게 가는 게 좋습니다.

v1 추천 범위:

```text
- Node version
- aco version
- git repository 여부
- .claude 디렉터리 존재 여부
- provider CLI 존재 여부
- provider auth 상태
- sync manifest 존재 여부
- drift 여부
```

v1에서 하지 말 것:

```text
- 복잡한 secret scanning
- CI 상태 조회
- GitHub API 연동
- provider별 deep diagnostic
```

doctor는 작게 시작해야 합니다.

## 5. security model은 PR 6보다 살짝 앞당겨도 됨

현재 계획은 PR 6에 `docs/security.md + .acoignore`입니다.
괜찮은 순서입니다.

다만 이 레포는 외부 AI provider에 context를 전달하는 도구처럼 보일 수 있기 때문에, README 개편 시점부터 아주 짧은 보안 문구는 들어가는 게 좋습니다.

PR 1에 최소 문구:

```md
## Safety

Provider execution is explicit. This project does not automatically send
arbitrary repository files to external providers. Context sync writes managed
target files only.
```

그리고 PR 6에서 본격화:

```text
docs/security.md
.acoignore
context inspect
secret pattern warning
```

즉, **PR 1에는 짧은 safety note**, **PR 6에는 정식 security model**이 좋습니다.

## 6. PR 7 review artifact 표준화는 매우 중요하지만 범위를 줄이는 게 좋음

`review.md / findings.json / result --format`은 좋은 기능입니다.
다만 이건 생각보다 커질 수 있습니다.

처음부터 완벽한 findings schema를 만들려고 하면 시간이 많이 듭니다.
v1은 이렇게만 가도 충분합니다.

```text
.aco/sessions/<session-id>/
├── metadata.json
├── output.log
└── review.md
```

그리고 `findings.json`은 v1에서는 optional로 두는 것도 좋습니다.

추천 v1:

```bash
aco result --format text
aco result --format markdown
```

추천 v2:

```bash
aco result --format json
aco result --findings-only
```

처음부터 severity/category/file/recommendation schema를 강제하면 provider output normalization 문제가 생깁니다.
PR 7은 “표준화의 시작” 정도로 작게 가는 게 좋습니다.

## 7. PR 8은 지금 당장 하지 않는 게 맞음

`multi-provider aggregator / aco followup`은 멋있지만, 지금 당장 하면 핵심 메시지를 흐릴 수 있다는 판단에 동의합니다.

PR 8은 milestone 2나 3로 빼는 게 좋습니다.

초기 목표는 이겁니다.

```text
이 프로젝트가 무엇인지 이해된다.
인증 없이 실행해볼 수 있다.
context sync와 session/result가 실제 기능처럼 보인다.
```

이 세 가지가 먼저입니다.

그 뒤에야 multi-provider aggregator가 의미가 있습니다.

## 내가 제안하는 약간 수정된 PR 순서

네가 제안한 순서를 거의 유지하되, 나는 이렇게 다듬겠습니다.

```text
PR 1: README 첫 화면 개편 + root/package metadata 정리
      + safety note
      + non-goals
      + 30초 설명
      + 핵심 workflow 다이어그램

PR 2: docs/case-study.md 추가
      + problem / constraints / design / trade-offs / limitations
      + portfolio용 요약 문단

PR 3: mock provider / no-auth demo 추가
      + aco run mock review
      + aco result
      + session 생성 테스트
      + CI smoke에 mock demo 포함

PR 4: aco sync --diff / --explain
      + managed targets 출력
      + drift 감지 설명
      + no-write 보장 테스트

PR 5: aco doctor v1
      + provider/auth/harness/sync 상태 진단
      + actionable next command 출력

PR 6: docs/security.md + .acoignore 정책
      + context exclusion 기준
      + provider context safety
      + secret/token 취급 원칙

PR 7: result artifact v1
      + review.md
      + metadata.json 정리
      + result --format markdown/text
      + findings.json은 optional 또는 v2로 분리

PR 8: multi-provider aggregator / aco followup
      + 별도 milestone으로 보류 가능
```

큰 차이는 세 가지입니다.

첫째, **PR 1에 safety note와 non-goals를 넣자.**
둘째, **PR 3에 session/result 테스트와 CI smoke를 포함하자.**
셋째, **PR 7의 findings.json은 처음부터 과하게 하지 말자.**

## 이 계획의 가장 큰 장점

이 계획은 “기술 부채를 줄이는 순서”가 아니라 **평가 가능성을 높이는 순서**입니다.

그게 좋습니다.

이 프로젝트가 포트폴리오라면, 처음 3개 PR의 효과가 가장 큽니다.

```text
PR 1: 첫인상이 바뀜
PR 2: 면접에서 설명할 문서가 생김
PR 3: 직접 실행 가능한 데모가 생김
```

이 세 개만 완료해도 레포의 인상은 꽤 달라집니다.

기존 인상:

```text
AI CLI 관련 기능이 많은 개인 자동화 레포
```

개선 후 인상:

```text
Claude Code, Codex, Gemini를 repo-local workflow로 연결하는
AI-native 개발 하네스 프로젝트
```

이 차이가 큽니다.

## 최종 평가

**방향은 맞습니다. 실행 순서도 좋습니다.**
다만 성공하려면 각 PR의 목적을 명확히 제한해야 합니다.

가장 중요한 원칙은 이것입니다.

```text
처음에는 기능을 늘리지 말고, 가치 전달력을 높인다.
그다음 인증 없는 데모로 신뢰를 만든다.
그 후 context sync, doctor, artifact를 운영 기능으로 강화한다.
```

내가 보기엔 바로 시작해도 됩니다.
첫 PR은 반드시 작고 선명하게 가져가세요.

```text
PR 1 목표:
“이 레포가 Gemini CLI wrapper가 아니라
repo-local AI workflow harness라는 것을 첫 화면에서 이해하게 만든다.”
```

이 목표만 달성해도 개선 효과가 큽니다.
