# Contributing

## Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9 (workspaces support)
- **TypeScript** — installed as a dev dependency; no global install needed

## Development Setup

```bash
git clone <repo>
cd ai-cli-orch-wrapper
npm install          # installs all workspace deps
npm run build        # build wrapper then installer
```

Build order is fixed: `packages/wrapper` must compile before `packages/installer` because the installer depends on wrapper's `dist/`.

## Project Layout

```
packages/
  wrapper/           — @pureliture/aco-wrapper: provider interface, session store, aco CLI
    src/
      cli.ts         — aco entry point
      providers/     — gemini.ts, copilot.ts, interface.ts, registry.ts
      session/       — store.ts (task.json + output.log lifecycle)
      util/          — spawn-stream.ts, which.ts
      index.ts       — public API re-exports
  installer/         — @pureliture/aco-install: npx installer
    src/
      cli.ts
      commands/pack-install.ts
templates/
  commands/          — slash command .md templates (gemini/, copilot/)
  prompts/           — provider prompt templates (gemini/, copilot/)
docs/                — architecture, contributing, runbook
```

<!-- AUTO-GENERATED -->
## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile both packages (wrapper → installer) |
| `npm test` | Run wrapper unit tests (providers + session) |
| `npm run test:smoke` | Provider availability smoke check (requires CLIs in PATH) |
<!-- END AUTO-GENERATED -->

## Running Tests

```bash
npm test            # unit tests — no external dependencies required
npm run test:smoke  # checks gemini/copilot binary availability
```

Tests live in `packages/wrapper/tests/`:
- `providers.test.ts` — GeminiProvider, CopilotProvider, ProviderRegistry
- `session.test.ts` — SessionStore lifecycle
- `smoke.ts` — live binary detection

To add a test, add a new `*.test.ts` file and register it in the `test` script inside `packages/wrapper/package.json`.

## Adding a Provider

1. Create `packages/wrapper/src/providers/<name>.ts` implementing `IProvider`.
2. Register it in `packages/wrapper/src/providers/registry.ts` via `ProviderRegistry.register()`.
3. Add templates under `templates/commands/<name>/` and `templates/prompts/<name>/`.
4. Add tests in `packages/wrapper/tests/providers.test.ts`.

## Code Style

- `strict: true` TypeScript — no `any`, no implicit returns.
- No linter or formatter is configured yet. Follow the style of surrounding code.

## Pull Request Checklist

- [ ] `npm run build` passes with no errors
- [ ] `npm test` passes (22/22)
- [ ] New behaviour is covered by tests
- [ ] `docs/architecture.md` updated if a design decision changed
