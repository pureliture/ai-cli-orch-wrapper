# ai-cli-orch-wrapper

Claude Code 하네스를 외부 AI CLI와 연결하기 위한 `aco` CLI와 관련 자산을 함께 관리하는 저장소입니다.

기본 문서 흐름은 상단에서 빠른 설치와 운영 경로를 안내하고, 아래로 갈수록 런타임 구조와 하네스 구성, context sync 방식을 설명합니다.

현재 문서 기준 주요 provider는 **Gemini**와 **Codex**입니다.

## 설치

```bash
# 방법 1: npx 사용
npx @pureliture/ai-cli-orch-wrapper pack setup
npx @pureliture/ai-cli-orch-wrapper provider setup <provider>

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

## Provider 설정

```bash
npx @pureliture/ai-cli-orch-wrapper provider setup gemini
npx @pureliture/ai-cli-orch-wrapper provider setup codex

# 또는 로컬 checkout에서
node packages/wrapper/dist/cli.js provider setup gemini
node packages/wrapper/dist/cli.js provider setup codex
```

필요한 외부 CLI:

- Gemini CLI: `npm install -g @google/gemini-cli`
- Codex CLI: `npm install -g @openai/codex`

## CLI 개요

```bash
# PATH에 aco가 노출된 환경에서 실행
aco pack install
aco pack setup
aco pack status
aco provider setup gemini
aco provider setup codex
aco run gemini review
aco run codex review
aco result
aco status
aco cancel --session <id>
```

## 이 저장소가 다루는 범위

Claude Code 하네스를 repo-local 자산으로 관리하면서도, 실제 실행은 외부 AI CLI와 연결하려면 다음 관심사를 함께 다뤄야 합니다.

- command pack 설치와 업데이트를 반복 가능한 방식으로 배포
- Claude 중심 설정을 Codex·Gemini 대상 산출물로 동기화
- provider 실행 차이를 감추면서 세션 상태와 실패를 추적
- 하네스 자산과 생성 산출물을 분리해 드리프트를 안전하게 관리

`ai-cli-orch-wrapper`는 이 문제를 **설치 가능한 npm 패키지 + repo-local harness + context sync + provider runtime** 조합으로 풀도록 설계했습니다.

## Architecture at a Glance

이 저장소는 두 실행면을 분리합니다.

- **Node wrapper CLI**: command pack 설치, provider setup, `aco sync`, 세션 로그와 운영 명령 담당
- **Go runtime**: `aco delegate`와 blocking provider 실행 담당

이 분리는 설치·운영 UX와 provider 실행 런타임의 책임을 나눠, 패키지 사용성과 실행 제어를 동시에 유지하기 위한 결정입니다.

핵심 설계 포인트:

- **repo-local harness + generated target 분리**: `.claude/`는 기준 자산으로 두고, Codex/Gemini 대상 파일은 생성 산출물로 관리
- **managed output + manifest 추적**: `aco sync`는 `.aco/sync-manifest.json`으로 생성 대상의 변경과 드리프트를 추적
- **provider abstraction**: 동일한 `aco` 진입점에서 Gemini·Codex 같은 provider별 실행 차이를 흡수
- **session-aware operations**: `aco status`, `aco result`, `aco cancel`로 실행 상태를 운영 명령으로 노출

자세한 내용은 [docs/architecture.md](docs/architecture.md)를 참고합니다.

## Harness Layout

이 저장소는 repo-local `.claude/`를 하네스 기준면으로 사용합니다.

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

생성 대상은 하네스 기준면 밖에 둡니다.

```text
AGENTS.md
GEMINI.md
.codex/agents/
.codex/hooks.json
.gemini/agents/
.gemini/settings.json
.aco/sync-manifest.json
```

이 구조는 사람이 유지하는 기준 자산과, `aco sync`가 관리하는 생성 산출물을 분리해 운영 중 수동 수정과 자동 생성의 경계를 분명히 하기 위한 것입니다.

자세한 명령 흐름과 운영 규칙은 [docs/guides/github-workflow.md](docs/guides/github-workflow.md)를 참고합니다.

## 저장소 구조

```text
packages/
  wrapper/          — @pureliture/ai-cli-orch-wrapper package (aco CLI, provider runtime, pack setup)
  installer/        — internal workspace kept for transitional implementation code
templates/
  commands/         — Claude Code slash command templates
  prompts/          — provider prompt templates
openspec/           — specs and change proposals
```

## 개발

```bash
npm install
npm run build
npm test
npm run typecheck
```

## 문제 해결

### `aco: command not found`

```bash
npm install -g @pureliture/ai-cli-orch-wrapper
```

### Provider를 찾을 수 없거나 인증되지 않은 경우

```bash
npx @pureliture/ai-cli-orch-wrapper provider setup gemini
npx @pureliture/ai-cli-orch-wrapper provider setup codex
```

### slash command가 보이지 않는 경우

```bash
aco pack install
```

## 문서

전체 목차는 [docs/README.md](docs/README.md)를 참고합니다. 주요 진입점:

- [Architecture](docs/architecture.md)
- [GitHub Workflow Guide](docs/guides/github-workflow.md)
- [Context Sync Reference](docs/reference/context-sync.md)
- [Contributing](docs/guides/contributing.md)
- [Runbook](docs/guides/runbook.md)
