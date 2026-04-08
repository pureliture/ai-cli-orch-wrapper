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
aco provider setup copilot
```

Gemini CLI: `npm install -g @google/gemini-cli`  
Copilot CLI: `npm install -g @github/copilot && gh auth login`

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
