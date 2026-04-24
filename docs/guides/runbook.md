# Runbook

## Publishing

### 1. Build

```bash
npm run build
```

### 2. Publish package

```bash
cd packages/wrapper
npm publish
```

### 3. Verify

```bash
npx @pureliture/ai-cli-orch-wrapper --version
```

## Installation

```bash
npx @pureliture/ai-cli-orch-wrapper pack setup
```

또는 저장소에서:

```bash
npm install
npm run build
node packages/wrapper/dist/cli.js pack setup
```

## Common Issues

### `aco: command not found`

```bash
npm install -g @pureliture/ai-cli-orch-wrapper
```

### Provider not found / not authenticated

```bash
aco provider setup gemini
aco provider setup codex
```

Gemini CLI: `npm install -g @google/gemini-cli`
Codex CLI: `npm install -g @openai/codex`

`aco provider setup` checks for a provider binary before checking auth. Auth is considered ready when any matching fast-path source is available:

| Provider | Auth sources |
| --- | --- |
| Gemini | `GEMINI_API_KEY`, `GOOGLE_API_KEY`, or `~/.gemini/oauth_creds.json` |
| Codex | `OPENAI_API_KEY` or `~/.codex/auth.json` |

If Codex reports an expired OAuth token, run `codex login`. In headless or CI environments, prefer `GEMINI_API_KEY` for Gemini and `OPENAI_API_KEY` for Codex.

### Slash commands missing after install

```bash
aco pack install
```

Templates are copied from `templates/commands/` to `.claude/commands/`.

## Session Data

Sessions are stored at `~/.aco/sessions/<uuid>/`.

```bash
aco status
aco result
aco cancel --session <id>
```
