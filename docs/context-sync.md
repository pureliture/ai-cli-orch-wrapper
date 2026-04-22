# Context Sync

`aco sync` synchronizes Claude Code project configuration into Codex and Gemini project-level configuration.

## Supported CLI Surfaces (as of 2026-04-22)

| Surface | Codex CLI 0.122.0 | Gemini CLI 0.38.2 |
|---------|-------------------|-------------------|
| Project guidance | `AGENTS.md` | `GEMINI.md` |
| Skills | `.agents/skills/<skill>/SKILL.md` | `.agents/skills/<skill>/SKILL.md` |
| Custom agents | `.codex/agents/*.toml` | `.gemini/agents/*.md` |
| Hooks | `.codex/hooks.json` + `codex_hooks` feature flag | `.gemini/settings.json` hooks |
| Non-interactive prompt | `codex exec [PROMPT]` | `gemini --prompt <prompt>` |
| Reasoning effort CLI flag | **not supported** | **not supported** |

Both Codex and Gemini use `.agents/skills/<skill>/` as the shared skill directory. `aco sync` copies `.claude/skills/<skill>/` to `.agents/skills/<skill>/` recursively. Do not use `.codex/skills` or `.gemini/skills` directly — they are not the shared surface.

## Source Discovery Order

`aco sync` reads source files in this order:

1. `CLAUDE.md` at repository root
2. `.claude/CLAUDE.md` (optional)
3. `.claude/rules/*.md` sorted lexicographically (optional)
4. `.claude/skills/*/SKILL.md` skill directories
5. `.claude/agents/*.md` agent files
6. `.claude/settings.json` hooks (`.claude/hooks.json` is accepted as legacy fallback only)

## Lossy Conversion Warnings

Not all Claude Code configuration can be represented in Codex or Gemini. The following fields are dropped or converted with semantic loss. Warnings are recorded in `.aco/sync-manifest.json`.

### Reasoning Effort

`reasoningEffort` in `.claude/agents/*.md` is a vendor-neutral expression of intent. Neither Codex CLI nor Gemini CLI supports a `--reasoning-effort` runtime flag.

- **Codex**: `model_reasoning_effort` is written to `.codex/agents/*.toml` only when the field is present in the agent spec. This is a config-level field, not a runtime CLI flag.
- **Gemini**: `reasoningEffort` is omitted entirely. A manifest warning is recorded.
- **Runtime**: `aco delegate` never passes `--reasoning-effort` to either provider CLI.

### Gemini Read-Only Enforcement

`workspaceMode: read-only` and `permissionProfile: restricted` can be expressed in Codex as `sandbox_mode = "read-only"`. In Gemini, only best-effort tool restrictions are available. A manifest warning is recorded indicating that read-only enforcement is not fully equivalent.

### Hook Semantics

Claude Code supports `async: true` for hooks that fire without blocking the agent. Codex and Gemini hooks run synchronously inside the agent loop. When a Claude hook has `async: true`, a warning is recorded and the generated target hook does not claim fire-and-forget semantics.

Unsupported hook events (events not present in the target CLI surface) are skipped and recorded as warnings.

Timeout units differ: Claude Code hooks use seconds; Gemini hooks use milliseconds. `aco sync` converts automatically.

## Usage

```bash
# Sync Claude context to Codex and Gemini targets
aco sync

# Check if sync is current (exits 1 if stale)
aco sync --check

# Preview changes without writing
aco sync --dry-run

# Overwrite manifest-owned generated targets that have drifted
aco sync --force
```

## Generated Files

`aco sync` manages the following outputs:

| Output | Type | Description |
|--------|------|-------------|
| `AGENTS.md` | Managed block | Codex project guidance from Claude context |
| `GEMINI.md` | Managed block | Gemini project guidance from Claude context |
| `.agents/skills/<skill>/` | Directory | Skill directories copied from `.claude/skills/` |
| `.codex/agents/*.toml` | File | Codex custom agent definitions |
| `.codex/hooks.json` | File | Codex hook configuration |
| `.codex/config.toml` | Managed block | Codex feature flags (`codex_hooks = true`) |
| `.gemini/agents/*.md` | File | Gemini custom agent definitions |
| `.gemini/settings.json` | File | Gemini settings with hook entries |
| `.aco/sync-manifest.json` | File | Sync ownership manifest with hashes and warnings |

## Manifest Conflict Detection

`aco sync` tracks generated file hashes in `.aco/sync-manifest.json`. If a manifest-owned target has been manually modified since the last sync, `aco sync` refuses to overwrite it without `--force`. Run `aco sync --check` to inspect stale or drifted targets.

## Pack Setup Integration

`aco pack setup` automatically runs `aco sync` after installing command and prompt templates. Sync warnings are surfaced in setup output. Fatal sync conflicts (unowned target drift) cause setup to fail before writing, with instructions to resolve using `aco sync --check` or `aco sync --force`.
