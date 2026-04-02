## Why

`ai-cli-orch-wrapper` is structured as a repo-local bash command pack: `.claude/commands/` and `.claude/aco/lib/adapter.sh` are committed as live runtime files with no real installation step. This makes distribution, portability, and lifecycle management impossible — the pack breaks when moved, has no versioned release surface, and cannot be adopted by other projects without forking the repo.

## What Changes

- **BREAKING** Remove `.claude/commands/` as live runtime artifacts; replace with `templates/` source tree
- **BREAKING** Remove bash-direct provider spawning from all slash commands
- Add `packages/installer/` — npm-publishable CLI (`npx aco-install`) that copies templates and places a wrapper binary
- Add `packages/wrapper/` — provider-based Node.js runtime that owns execution, session, task, and output lifecycle
- Add `templates/commands/` and `templates/prompts/` as the canonical template source (copied into user's `.claude/` on install)
- Introduce provider plugin interface: `GeminiProvider`, `CopilotProvider` (extensible to others)
- Split setup UX: `pack setup` (installs command templates + wrapper) vs `provider setup` (authenticates/installs CLI tool)
- Consolidate task/session/output management inside wrapper (replaces ad-hoc bash tmpfile patterns)

## Capabilities

### New Capabilities

- `installer`: npm/npx installable CLI that copies command templates and places the wrapper binary into the user's environment
- `wrapper-runtime`: provider-agnostic Node.js runtime that normalises execution, permission profiles, and task/session/output lifecycle
- `provider-interface`: extensible provider plugin contract (`GeminiProvider`, `CopilotProvider`); each provider declares its binary, auth check, invocation flags, and stream protocol
- `pack-setup-ux`: first-class `aco pack setup` vs `aco provider setup <name>` separation, with validation and status reporting

### Modified Capabilities

<!-- No existing openspec specs — this is greenfield spec coverage for the project -->

## Impact

- `package.json`: `private: true` → scoped workspace; new `packages/installer` and `packages/wrapper` packages added
- `.claude/commands/**/*.md`: become templates under `templates/commands/`; no longer executed directly from repo
- `.claude/aco/lib/adapter.sh`: logic migrates into `packages/wrapper/src/providers/`; file removed
- `.claude/aco/tests/`: migrate to `packages/wrapper/tests/`
- All relative-path `source` calls in slash commands eliminated
- Node.js / npm required at install time (already implicit via existing `gemini` and `copilot` CLI deps)
