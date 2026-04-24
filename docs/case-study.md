# Case Study: Repo-local AI Workflow Harness

작성일: 2026-04-24

`ai-cli-orch-wrapper`는 Claude Code 중심의 repo-local harness를 Codex CLI와 Gemini CLI 대상
context, provider 실행, session 기록과 연결하기 위한 `aco` CLI 작업공간이다. 이 문서는
포트폴리오/평가자 관점에서 이 프로젝트가 어떤 문제를 어떤 설계로 풀고 있는지 설명한다.

## 60초 요약

AI coding CLI는 강력하지만 provider마다 context 파일, 인증 흐름, 명령 형식, 출력 관리 방식이
다르다. 이 저장소는 그런 차이를 개별 스크립트로 처리하지 않고, repo-local 개발 workflow로 묶는
방향을 택했다.

현재 구현된 핵심은 세 가지다.

- Claude Code 기준 자산을 Codex/Gemini 대상 파일로 동기화하는 `aco sync`
- Gemini/Codex provider setup과 `aco run` 실행을 제공하는 Node wrapper CLI
- 실행 결과를 `aco status`, `aco result`, `aco cancel`로 추적하는 session lifecycle

아직 구현되지 않은 `aco doctor`, mock provider, structured findings artifact, multi-provider
aggregator는 roadmap에 planned로 남겨 두었다. 이 프로젝트의 목표는 AI가 review를 대체하게 하는
것이 아니라, AI CLI 사용을 검토 가능하고 반복 가능한 개발 workflow로 만드는 것이다.

## Problem

AI CLI를 단발성 도구로 쓰는 것은 쉽다. 하지만 프로젝트 단위로 반복 가능한 workflow에 넣으려면
다음 문제가 생긴다.

- 각 provider가 기대하는 repo-level instruction/context 파일이 다르다.
- Claude Code, Codex, Gemini의 설정과 agent/skill 표면이 완전히 같지 않다.
- context 파일을 수동 복사하면 drift가 생기고, 어느 파일이 source of truth인지 흐려진다.
- provider 인증과 실행 실패가 CLI별로 다르게 보인다.
- AI review 결과가 stdout에만 남으면 나중에 재검토하거나 follow-up 작업으로 연결하기 어렵다.
- GitHub issue/PR workflow와 AI review output 사이의 연결이 사람의 수작업에 의존한다.

이 프로젝트는 이 문제를 "여러 AI CLI를 한 번에 호출하는 wrapper"가 아니라 "repo-local workflow
harness" 문제로 본다.

## Constraints

설계에서 유지해야 하는 제약은 다음과 같다.

- npm package로 설치 가능한 공개 CLI 표면이 있어야 한다.
- Claude Code harness 자산을 repo-local source로 유지해야 한다.
- Codex/Gemini target context를 생성 산출물로 관리해야 한다.
- 생성 target을 덮어쓸 때 manual edit와 drift를 감지해야 한다.
- provider별 auth와 CLI behavior 차이를 과하게 추상화하지 않아야 한다.
- provider output은 human review와 test validation을 대체하지 않아야 한다.
- Node wrapper와 Go runtime의 책임 경계를 문서와 구현에서 분리해야 한다.
- 보안 문서가 현재 구현보다 강한 보장을 주장하지 않아야 한다.

## Current Implementation

### Public CLI Surface

공개 npm package는 `@pureliture/ai-cli-orch-wrapper`이고, 공개 CLI는 `aco`다.

현재 Node wrapper CLI는 다음 표면을 제공한다.

```text
aco pack install
aco pack setup
aco pack status
aco provider setup <name>
aco sync [--check] [--dry-run] [--force]
aco run <provider> <command>
aco status [--session <id>]
aco result [--session <id>]
aco cancel [--session <id>]
```

주요 provider는 Gemini와 Codex다.

### Context Sync

`aco sync`는 Claude Code 기준 자산을 읽고 Codex/Gemini target으로 변환한다.

source 예시:

```text
CLAUDE.md
.claude/agents/
.claude/skills/
.claude/settings.json
```

generated target 예시:

```text
AGENTS.md
GEMINI.md
.agents/skills/
.codex/agents/
.codex/hooks.json
.gemini/agents/
.gemini/settings.json
.aco/sync-manifest.json
```

핵심은 `.claude/`를 사람이 관리하는 기준 자산으로 두고, Codex/Gemini 대상 파일은
manifest-tracked generated output으로 관리하는 것이다. 현재 `--check`, `--dry-run`, `--force`를
지원하며, `--diff`, `--explain`은 planned work다.

자세한 변환 규칙은 [Context Sync Reference](reference/context-sync.md)를 따른다.

### Provider Execution and Sessions

Node wrapper의 `aco run <provider> <command>`는 provider CLI를 실행하고 session을 만든다.

현재 session store는 사용자 홈 아래에 기록된다.

```text
~/.aco/sessions/<session-id>/
├── task.json
└── output.log
```

`aco status`, `aco result`, `aco cancel`은 이 session lifecycle을 조회하거나 조작한다. planned
artifact v1은 기존 `task.json`과 `output.log`를 유지하면서 `review.md`와
`aco result --format text|markdown`을 추가하는 것이다. `findings.json`과 `validation.json`은
provider output normalization이 필요하므로 v2로 분리한다.

### Node and Go Runtime Boundary

이 저장소에는 두 실행면이 있다.

- Node wrapper CLI: 공개 npm package의 `aco` 표면. package setup, provider setup, context sync,
  session-aware run/result/status/cancel을 담당한다.
- Go runtime: `cmd/aco/`의 blocking runtime. `aco delegate`와 process-oriented provider 실행을
  실험한다. Node session store를 사용하지 않는다.

보안 계약도 이 경계를 따라 나뉜다. Go runtime의 environment allowlist와 path validation은 Go
runtime 경로에 적용된다. Node wrapper의 public `aco run` 경로에 자동 적용되는 보장으로 쓰지
않는다.

자세한 경계는 [Architecture](architecture.md)와
[Go/Node.js Boundary](contract/go-node-boundary.md)를 따른다.

### GitHub Workflow Harness

이 저장소는 public `aco` CLI 외에도 GitHub issue/PR 운영을 위한 repo-local workflow 자산을
함께 관리한다. slash command와 `github-kanban-ops` skill은 `aco`의 핵심 런타임이 아니라 review
follow-up을 돕는 companion surface다. 현재 review follow-up의 canonical workflow는
`/gh-pr-followup`과 `github-kanban-ops` 중심이다.

향후 `aco followup`이 생기더라도 이 표면을 대체하기보다, session/review artifact에서 follow-up
draft를 만드는 보조 경로로 다루는 것이 맞다.

## Design Decisions

### D1: Context Sync를 핵심 차별화로 둔다

여러 AI CLI를 실행하는 것보다 더 중요한 문제는 context drift다. 각 provider가 요구하는 파일을
수동으로 관리하면 source of truth가 흐려진다. 그래서 Claude Code 기준 자산을 canonical source로
두고, Codex/Gemini 파일을 generated target으로 관리한다.

### D2: 공개 package UX는 Node wrapper가 담당한다

npm install과 JavaScript 생태계의 package UX는 Node wrapper가 맡는 편이 자연스럽다. 현재 공개
CLI의 session-aware 동작도 Node wrapper에 있다.

### D3: Go runtime은 process-oriented runtime 실험으로 둔다

Go runtime은 blocking provider execution, process control, formatter-based routing을 실험하기에
적합하다. 다만 Node wrapper와 Go runtime의 lifecycle은 현재 분리되어 있으므로, 둘을 하나의
보안/세션 모델처럼 설명하지 않는다.

### D4: Provider auth는 local heuristic으로만 표현한다

`provider setup`은 provider binary와 local credential file/env 존재를 빠르게 확인한다.
`gemini --version`, `codex --version` fallback은 binary availability 확인이지 remote auth 검증이
아니다. 문서와 향후 `aco doctor`도 이 한계를 유지해야 한다.

### D5: AI 결과는 artifact로 보존하되 human review를 대체하지 않는다

AI review output은 advisory다. 앞으로 artifact를 표준화하더라도 test, maintainer judgment,
human review를 대체하지 않는다.

## Trade-offs

| 결정                                           | 이점                                            | 비용                                                                   |
| ---------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------- |
| Node wrapper + Go runtime 분리                 | npm UX와 process runtime 실험을 나눌 수 있다.   | public surface와 runtime contract를 계속 문서화해야 한다.              |
| Claude source -> Codex/Gemini generated target | context drift를 줄이고 ownership을 명확히 한다. | 모든 provider 설정을 무손실 변환할 수는 없다.                          |
| Session store 유지                             | provider output을 조회/취소/추적할 수 있다.     | artifact schema가 안정되기 전에는 raw log 중심이다.                    |
| Auth를 local heuristic으로 제한                | 빠르고 안전하게 readiness hint를 줄 수 있다.    | 실제 remote auth 성공을 보장하지 않는다.                               |
| Mock provider planned                          | 인증 없는 demo와 CI 검증이 가능해진다.          | AI 품질 데모가 아니라 deterministic runtime 검증임을 명확히 해야 한다. |

## Current Limitations

- 이 프로젝트는 human code review를 대체하지 않는다.
- provider output은 advisory이며 테스트와 maintainer 판단으로 검증해야 한다.
- Node wrapper session lifecycle과 Go delegate lifecycle은 현재 분리되어 있다.
- Go runtime environment allowlist는 Node wrapper provider execution에 자동 적용되지 않는다.
- `aco doctor`, mock provider, `aco sync --diff`, `aco sync --explain`은 아직 planned work다.
- artifact 확장은 아직 구현 전이다. `review.md`는 artifact v1 후보이고,
  `findings.json`/`validation.json`은 v2 후보로 분리한다.
- context sync는 알려진 generated target만 관리하며 임의의 project context를 자동 추론하지 않는다.
- provider CLI behavior는 안정적인 machine-readable API처럼 보장되지 않을 수 있다.

## Planned Improvements

실행 기준은 [PR Implementation Plan](pr-implementation-plan.md)을 따른다.

1. README 첫 화면과 package metadata 정리
2. no-auth demo를 위한 mock provider
3. `aco sync --diff`와 `aco sync --explain`
4. `aco doctor` v1
5. 사용자용 security model과 `.acoignore` policy
6. result artifact v1
7. multi-provider review aggregation
8. follow-up draft / GitHub workflow integration

## Portfolio Summary

이 프로젝트는 "AI CLI를 써봤다"보다 "AI CLI를 개발 workflow로 제품화하려면 어떤 경계와 운영
표면이 필요한가"를 보여주는 보조 레퍼런스에 가깝다. 핵심 설계 포인트는 repo-local context
sync, provider execution abstraction, session lifecycle, GitHub workflow 연결, 그리고 구현된
기능과 planned 기능을 명확히 분리하는 문서화다.
