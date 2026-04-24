# ai-cli-orch-wrapper

`ai-cli-orch-wrapper`는 Claude Code 중심의 repo-local harness를 Codex CLI와 Gemini CLI 대상
context, provider 실행, session 기록과 연결하기 위한 AI workflow harness입니다.

단순히 외부 AI CLI를 호출하는 wrapper가 아니라, command pack 설치, Claude 기준 자산의
Codex/Gemini target sync, provider 실행, session-aware `result/status/cancel`을 하나의
반복 가능한 개발 워크플로우로 묶는 것이 목표입니다.

현재 source implementation의 Node wrapper는 `aco` CLI를 담당하며, Go runtime은 `aco delegate`와 blocking
provider 실행 실험을 담당합니다. 주요 provider는 **Gemini**와 **Codex**입니다. 공개 npm package는
release 시점에 따라 source implementation보다 뒤처질 수 있으므로, 최신 source 기준 기능을 확인할 때는
로컬 checkout에서 build한 CLI를 사용합니다. 개선 방향과
PR 실행 기준은 [docs/roadmap.md](docs/roadmap.md)와
[docs/pr-implementation-plan.md](docs/pr-implementation-plan.md)를 참고합니다.

이 프로젝트의 변경 관리는 OpenSpec 기반으로 진행합니다. 기능 변경이나 문서 구조 변경은
`openspec/changes/<change-name>/` 아래 proposal, design, spec, tasks를 먼저 명시하고,
구현 후 검증과 archive 흐름으로 이어가는 것을 기본 개발 방식으로 둡니다.

## 현재 구현 범위

현재 source implementation에서 확인할 수 있는 범위:

| 영역 | 현재 가능한 일 | 대표 명령 |
| --- | --- | --- |
| Command pack | Claude slash command pack 설치, 갱신, 상태 확인 | `aco pack setup`, `aco pack status` |
| Context sync | Claude 기준 자산을 Codex/Gemini 대상 context로 동기화하고 drift 확인 | `node packages/wrapper/dist/cli.js sync --check` |
| Provider setup | Gemini/Codex CLI 존재 여부와 local credential readiness 확인 | `aco provider setup <provider>` |
| Provider run | provider별 command 실행과 session 기록 생성 | `aco run gemini review`, `aco run codex review` |
| Session ops | 실행 상태, 결과, 취소 흐름 확인 | `aco status`, `aco result`, `aco cancel --session <id>` |

아직 planned work로 남겨 둔 범위:

- 인증 없는 demo를 위한 mock provider
- `aco doctor`
- review artifact v1과 structured findings v2
- multi-provider aggregation과 follow-up draft

평가자 관점에서는 [docs/case-study.md](docs/case-study.md)에서 문제·제약·설계·한계를 먼저
보고, [docs/roadmap.md](docs/roadmap.md)와
[docs/pr-implementation-plan.md](docs/pr-implementation-plan.md)에서 실행 기준을 확인하는
흐름이 가장 빠릅니다.

## 설치

필요한 기본 환경:

| Dependency | Required | Notes |
| --- | --- | --- |
| Node.js / npm | Yes | npm workspace와 공개 npm CLI 실행에 필요합니다. |
| Claude Code | Yes | repo-local command pack과 harness의 기준 실행면입니다. |
| Gemini CLI | Provider별 | Gemini provider를 사용할 때 필요합니다. |
| Codex CLI | Provider별 | Codex provider를 사용할 때 필요합니다. |

처음 사용하는 경우에는 `pack setup`으로 command pack을 준비하고, 사용할 provider를 하나 이상
설정합니다. 최신 source implementation의 context sync까지 확인하려면 아래 로컬 checkout 흐름을 사용합니다.

```bash
# 방법 1: npx 사용
npx @pureliture/ai-cli-orch-wrapper pack setup
npx @pureliture/ai-cli-orch-wrapper provider setup <provider>
```

저장소 checkout에서 직접 실행할 때는 build 후 `dist/cli.js`를 사용합니다.

```bash
# 방법 2: 저장소에서 직접 실행
npm install
npm run build
node packages/wrapper/dist/cli.js pack setup
node packages/wrapper/dist/cli.js provider setup <provider>
node packages/wrapper/dist/cli.js sync --check
```

설치 후 버전을 확인합니다.

```bash
npx @pureliture/ai-cli-orch-wrapper --version
aco --version
```

`sync --check`는 생성 대상을 수정하지 않고 stale/drift 여부만 확인합니다. 생성 산출물을 의도적으로
갱신해야 할 때만 별도 sync 명령을 실행합니다. 공개 npm package가 아직 source implementation을
따라오지 않은 release에서는 `aco sync`가 없을 수 있습니다.

## Provider 설정

Gemini와 Codex provider는 외부 CLI와 local credential 상태에 의존합니다. Codex provider와 sync 명령은
source implementation 기준 기능이며, 공개 npm package release가 아직 따라오지 않은 경우 로컬 checkout
build 경로로 확인합니다.

| Provider | External CLI install | Local credential sources | Readiness fallback |
| --- | --- | --- | --- |
| Gemini | `npm install -g @google/gemini-cli` | `GEMINI_API_KEY`, `GOOGLE_API_KEY`, `~/.gemini/oauth_creds.json` | `gemini --version` |
| Codex | `npm install -g @openai/codex` | `OPENAI_API_KEY`, `~/.codex/auth.json` | `codex --version` |

```bash
npx @pureliture/ai-cli-orch-wrapper provider setup <provider>
```

로컬 checkout에서 실행하는 경우:

```bash
node packages/wrapper/dist/cli.js provider setup gemini
node packages/wrapper/dist/cli.js provider setup codex
```

`provider setup`은 외부 CLI가 설치되어 있는지 확인한 뒤, local credential readiness를 휴리스틱으로
확인합니다. fallback의 `--version` 실행은 provider binary availability 확인이며 remote 인증 검증이
아닙니다.

Codex OAuth 토큰에 `expires_at` 값이 있고 만료된 경우에는 `codex login`을 다시 실행해야 합니다.
Headless/CI 환경에서는 Gemini에 `GEMINI_API_KEY` 또는 `GOOGLE_API_KEY`, Codex에
`OPENAI_API_KEY`를 설정할 수 있습니다.

## CLI 개요

PATH에 `aco`가 노출된 환경에서는 다음 명령을 중심으로 사용합니다. 단, 공개 npm package release가
source implementation보다 뒤처진 경우 일부 source 기준 명령은 로컬 build CLI로 실행합니다.

| Command group | Commands | Purpose |
| --- | --- | --- |
| Pack | `aco pack install`, `aco pack setup`, `aco pack status` | Claude command pack 설치, 설정, 상태 확인 |
| Provider | `aco provider setup gemini`, `aco provider setup codex` | provider CLI와 credential readiness 확인 |
| Sync | `node packages/wrapper/dist/cli.js sync --check` | Codex/Gemini generated target drift를 읽기 전용으로 확인 |
| Run | `aco run gemini review`, `aco run codex review` | provider command 실행과 session 기록 생성 |
| Session | `aco status`, `aco result`, `aco cancel --session <id>` | session 상태 조회, 결과 확인, 실행 취소 |

자주 쓰는 시작 명령:

```bash
aco pack status
aco provider setup gemini
aco run gemini review
aco status
aco result
```

source checkout에서 sync drift를 확인할 때:

```bash
node packages/wrapper/dist/cli.js sync --check
```

실행 중인 provider 작업을 취소해야 할 때는 session id를 지정합니다.

```bash
aco cancel --session <id>
```

## 이 저장소가 다루는 범위

Claude Code 하네스를 repo-local 자산으로 관리하면서도, 실제 실행은 외부 AI CLI와 연결하려면 다음 관심사를 함께 다뤄야 합니다.

- command pack 설치와 업데이트를 반복 가능한 방식으로 배포
- Claude 중심 설정을 Codex·Gemini 대상 산출물로 동기화
- provider 실행 차이를 감추면서 세션 상태와 실패를 추적
- 하네스 자산과 생성 산출물을 분리해 드리프트를 안전하게 관리

`ai-cli-orch-wrapper`는 이 문제를 **설치 가능한 npm 패키지 + repo-local harness + context sync + provider runtime** 조합으로 풀도록 설계했습니다.

이 README는 설치와 운영 진입점을 제공합니다. 세부 설계, sync contract, GitHub workflow, runbook은 아래의 [문서](#문서) 섹션에서 연결된 문서를 기준으로 봅니다.

## Architecture at a Glance

이 저장소는 두 실행면을 분리합니다.

- **Node wrapper CLI**: 공개 npm package와 source build의 `aco` 명령. command pack 설치,
  provider setup, source 기준 `aco sync`, `aco run`, 세션 로그와 운영 명령 담당
- **Go runtime**: `cmd/aco/`의 runtime 실험. `aco delegate`와 blocking provider 실행 담당

```text
Repo-local harness source
.claude/commands + .claude/agents + .claude/skills + .claude/settings
        │
        │ aco pack / aco sync
        ▼
Generated and managed targets
AGENTS.md + GEMINI.md + .agents/skills + .codex/* + .gemini/* + .aco/sync-manifest.json
        │
        │ aco run <provider> <command>
        ▼
Provider CLIs
Gemini CLI / Codex CLI
        │
        │ session log + lifecycle metadata
        ▼
Session operations
aco status / aco result / aco cancel
```

이 분리는 설치·운영 UX와 provider 실행 런타임의 책임을 나눠, 패키지 사용성과 실행 제어를 동시에 유지하기 위한 결정입니다.

핵심 설계 포인트:

- **repo-local harness + generated target 분리**: `.claude/`는 기준 자산으로 두고, Codex/Gemini 대상 파일은 생성 산출물로 관리
- **managed output + manifest 추적**: `aco sync`는 `.aco/sync-manifest.json`으로 생성 대상의 변경과 드리프트를 추적
- **provider abstraction**: 동일한 `aco` 진입점에서 Gemini·Codex 같은 provider별 실행 차이를 흡수
- **session-aware operations**: `aco status`, `aco result`, `aco cancel`로 실행 상태를 운영 명령으로 노출

자세한 내용은 [docs/architecture.md](docs/architecture.md)를 참고합니다.

## Harness Layout

이 저장소는 repo-local `.claude/`를 하네스 기준면으로 사용합니다. 사람이 직접 유지하는 source surface입니다.

```text
.claude/
├── agents/             # Claude Code agent definitions
├── commands/           # Slash commands used by this repo
├── skills/             # Local workflow skills
├── aco/
│   └── prompts/        # Provider prompt templates
├── settings.json       # Shared Claude Code settings
└── settings.local.json # Local-only settings
```

생성 대상은 하네스 기준면 밖에 둡니다. 일부 파일은 사람이 읽고 검토하지만, source of truth는 `.claude/`와 sync manifest입니다.

```text
AGENTS.md               # Codex project instructions generated from Claude context
GEMINI.md               # Gemini project instructions generated from Claude context
.agents/skills/         # Shared skill surface for Codex/Gemini-compatible workflows
.codex/agents/          # Codex agent target surface
.codex/hooks.json       # Codex hook target surface
.gemini/agents/         # Gemini agent target surface
.gemini/settings.json   # Gemini settings target surface
.aco/sync-manifest.json # Managed output manifest and drift tracking
```

이 구조는 사람이 유지하는 기준 자산과, `aco sync`가 관리하는 생성 산출물을 분리해 운영 중 수동 수정과 자동 생성의 경계를 분명히 하기 위한 것입니다.

자세한 명령 흐름과 운영 규칙은 [docs/guides/github-workflow.md](docs/guides/github-workflow.md)를 참고합니다.

## 저장소 구조

```text
packages/
  wrapper/          — @pureliture/ai-cli-orch-wrapper package: aco CLI, provider runtime, sync engine, pack setup
  installer/        — install-time entrypoints and transitional installer implementation
templates/
  commands/         — Packaged Claude Code slash command templates
  prompts/          — Provider prompt templates
.claude/            — Maintained Claude harness source surface
.agents/skills/     — Shared Codex/Gemini skill surface and GitHub Kanban policy
.codex/agents/      — Generated or maintained Codex custom agent surface
.gemini/            — Gemini command and agent surfaces
cmd/aco/            — Go runtime experiment for delegate/blocking provider execution
docs/               — Architecture, guides, reference docs, roadmap, and runbook
openspec/           — Specs, change proposals, designs, and task lists
```

새 provider를 추가할 때는 provider-specific behavior를 `packages/wrapper/src/providers/` 아래 provider abstraction 뒤에 둡니다. 하네스 정책이나 PM workflow를 바꿀 때는 `.agents/skills/github-kanban-ops/`와 관련 command/template surface의 정렬 여부를 같이 봅니다.

## 개발

```bash
npm install
npm run build
npm test
npm run typecheck
```

문서나 하네스 동기화 동작을 바꿀 때 자주 쓰는 추가 확인:

```bash
npm run test:fixtures
npm run test:smoke
git diff --check
node packages/wrapper/dist/cli.js sync --check
```

GitHub PM command parity나 shared skill 정책을 바꿀 때는 관련 command/template 파일과 shared skill copy가 같이 정렬되어야 합니다. 자세한 유지보수 규칙은 [AGENTS.md](AGENTS.md)와 [docs/guides/contributing.md](docs/guides/contributing.md)를 참고합니다.

커밋 메시지는 저장소의 commit template과 커밋 작성 프롬프트를 기준으로 작성합니다.

```bash
git config commit.template .gitmessage
```

- Template: [.gitmessage](.gitmessage)
- Prompt: [docs/guides/commit-message-prompt.md](docs/guides/commit-message-prompt.md)
- Codex가 커밋을 작성할 때는 prompt의 한국어 작성 규칙, 제목+본문 형식, AI CLI/model contributor trailer 규칙을 따른다.

## 문제 해결

### `aco: command not found`

전역 설치가 필요한 환경이면 package를 전역 설치한 뒤 PATH를 확인합니다.

```bash
npm install -g @pureliture/ai-cli-orch-wrapper
aco --version
```

npx 기반으로만 사용할 수도 있습니다.

```bash
npx @pureliture/ai-cli-orch-wrapper --version
```

### Provider를 찾을 수 없거나 인증되지 않은 경우

먼저 provider별 외부 CLI가 설치되어 있는지 확인하고, provider setup을 다시 실행합니다.

```bash
npm install -g @google/gemini-cli
npm install -g @openai/codex
npx @pureliture/ai-cli-orch-wrapper provider setup gemini
npx @pureliture/ai-cli-orch-wrapper provider setup codex
```

Headless/CI 환경에서는 Gemini에 `GEMINI_API_KEY` 또는 `GOOGLE_API_KEY`, Codex에 `OPENAI_API_KEY`를 설정할 수 있습니다. Codex OAuth를 쓰는 로컬 환경에서 토큰이 만료되면 `codex login`을 다시 실행합니다.

### slash command가 보이지 않는 경우

command pack이 설치되지 않았거나 stale 상태일 수 있습니다.

```bash
aco pack status
aco pack setup
```

### Codex/Gemini target surface가 stale해 보이는 경우

먼저 read-only check로 drift 여부를 확인합니다.

```bash
node packages/wrapper/dist/cli.js sync --check
```

`sync --check`는 생성 대상을 변경하지 않습니다. 공개 npm package release가 아직 source implementation을 따라오지 않은 경우 `aco sync`는 없을 수 있으므로, source checkout에서는 build 후 `node packages/wrapper/dist/cli.js sync --check`로 확인합니다. 의도적으로 generated target을 갱신해야 하는 상황인지 확인한 뒤 sync 명령을 실행합니다. 운영 절차는 [docs/reference/context-sync.md](docs/reference/context-sync.md)와 [docs/guides/runbook.md](docs/guides/runbook.md)를 참고합니다.

## 문서

전체 목차는 [docs/README.md](docs/README.md)를 참고합니다. 주요 진입점:

| Document | When to use |
| --- | --- |
| [Case Study](docs/case-study.md) | 문제 배경, 제약, 설계 선택, 현재 한계를 빠르게 평가할 때 |
| [Roadmap](docs/roadmap.md) | planned work와 구현 우선순위를 확인할 때 |
| [PR Implementation Plan](docs/pr-implementation-plan.md) | PR 단위 실행 기준과 남은 구현 단계를 확인할 때 |
| [Architecture](docs/architecture.md) | wrapper, sync engine, provider runtime의 구조를 자세히 볼 때 |
| [Context Sync Reference](docs/reference/context-sync.md) | managed output, manifest, drift 처리 규칙을 확인할 때 |
| [GitHub Workflow Guide](docs/guides/github-workflow.md) | issue, branch, PR, Project board 운영 방식을 따를 때 |
| [Contributing](docs/guides/contributing.md) | 개발 환경, 검증, 변경 제출 규칙을 확인할 때 |
| [Runbook](docs/guides/runbook.md) | 운영 중 실패나 복구 절차를 더 자세히 볼 때 |
