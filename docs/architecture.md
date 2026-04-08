# Architecture

## Current Structure

The repository now targets one public npm package and one public CLI:

```text
npm package: @pureliture/ai-cli-orch-wrapper
CLI: aco
```

`aco` owns both runtime commands and setup commands:

```text
aco run ...
aco pack install
aco pack setup
aco provider setup <name>
```

## Repository Layout

```text
packages/
  wrapper/     # public package implementation
  installer/   # internal transitional workspace (not public)
templates/
  commands/    # copied to .claude/commands/
  prompts/     # copied to .claude/aco/prompts/
```

## Key Decisions

### D1: Single public package

Only `@pureliture/ai-cli-orch-wrapper` is intended to be published. Internal workspaces may remain during migration, but they are not part of the public API.

### D2: Single public CLI

`aco` is the only public command. Historical installer functionality is routed through:

- `aco pack install`
- `aco pack setup`
- `aco pack status`
- `aco provider setup <name>`

### D3: Runtime lifecycle remains in wrapper

The `aco` CLI still owns:

- provider dispatch
- session/task lifecycle
- output/error log handling
- cancellation/status commands

### D4: Pack installation is file copy

`aco pack install` copies templates from `templates/commands/` into `.claude/commands/`. Symlinks are still avoided because they are fragile across Node version manager changes.
