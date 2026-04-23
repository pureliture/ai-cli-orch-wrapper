# Contributing

## Prerequisites

- Node.js >= 18
- npm >= 9

## Development Setup

```bash
git clone <repo>
cd ai-cli-orch-wrapper
npm install
npm run build
```

## Project Layout

```text
packages/
  wrapper/           — public package: @pureliture/ai-cli-orch-wrapper
    src/cli.ts       — aco entry point
    src/commands/    — pack/provider setup commands
    src/providers/   — gemini, registry
    src/session/     — session lifecycle
  installer/         — internal transitional workspace
templates/           — slash commands and prompts copied by `aco pack install`
docs/                — architecture, runbook, contributing
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile the public `aco` package |
| `npm test` | Run wrapper unit tests |
| `npm run typecheck` | Typecheck the public `aco` package |

## Running Tests

```bash
npm test
npm run typecheck
```

## Pull Request Checklist

- [ ] `npm run build` passes
- [ ] `npm test` passes
- [ ] `npm run typecheck` passes
- [ ] docs updated if the public package or CLI surface changed
