# ai-cli-orch-wrapper

Gemini CLI용 Claude Code command pack을 설치하고 실행하는 `aco` CLI 패키지입니다.

## 설치

```bash
# 방법 1: npx 사용
npx @pureliture/ai-cli-orch-wrapper pack setup
npx @pureliture/ai-cli-orch-wrapper provider setup gemini

# 방법 2: 저장소에서 직접 실행
npm install
npm run build
node packages/wrapper/dist/cli.js pack setup
node packages/wrapper/dist/cli.js provider setup gemini
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
# 또는 로컬 checkout에서
node packages/wrapper/dist/cli.js provider setup gemini
```

필요한 외부 CLI:

- Gemini CLI: `npm install -g @google/gemini-cli`

## CLI 개요

```bash
# PATH에 aco가 노출된 환경에서 실행
aco pack install
aco pack setup
aco pack status
aco provider setup gemini
aco run gemini review
aco result
aco status
aco cancel --session <id>
```

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
```

### slash command가 보이지 않는 경우

```bash
aco pack install
```

## 문서

전체 목차는 [docs/README.md](docs/README.md)를 참고한다. 주요 진입점:

- [Architecture](docs/architecture.md)
- [Contributing](docs/guides/contributing.md)
- [Runbook](docs/guides/runbook.md)
