## Context

aco v2 already resolves `.claude/agents/*.md` frontmatter and runs Codex/Gemini as blocking provider CLIs. The missing layer is durable project configuration parity: Codex and Gemini should see the same repository guidance, reusable skills, agent personas, and relevant hook policy that Claude Code users already maintain.

The design is based on these verified CLI surfaces as of 2026-04-22:

| Surface | Codex CLI 0.122.0 | Gemini CLI 0.38.2 |
|---------|-------------------|-------------------|
| Project guidance | `AGENTS.md` | `GEMINI.md` |
| Skills | `.agents/skills/<skill>/SKILL.md` | `.agents/skills/<skill>/SKILL.md` alias, also `.gemini/skills` |
| Custom agents | `.codex/agents/*.toml` | `.gemini/agents/*.md` |
| Hooks | `.codex/hooks.json` plus `codex_hooks` feature flag | `.gemini/settings.json` hooks |
| Non-interactive prompt | `codex exec [PROMPT]` | `gemini --prompt <prompt>` |
| Reasoning effort flag | no `--reasoning-effort` CLI flag | no `--reasoning-effort` CLI flag |

The current proposal also referenced sources that do not exist in this repo (`.claude/CLAUDE.md`, `.claude/hooks.json`) while the actual source files are root `CLAUDE.md` and `.claude/settings.json`.

## Goals / Non-Goals

**Goals:**
- Generate Codex and Gemini project-level configuration from the existing Claude Code project setup.
- Keep root `CLAUDE.md`, optional `.claude/CLAUDE.md`, optional `.claude/rules/*.md`, `.claude/skills/*`, `.claude/agents/*.md`, and `.claude/settings.json` as source inputs.
- Write generated outputs idempotently with explicit ownership markers and a sync manifest.
- Convert agent personas into the latest Codex and Gemini custom-agent formats.
- Convert hooks only when semantics are representable, and report unsupported fields rather than silently preserving false guarantees.
- Ensure `aco delegate` uses only provider CLI flags supported by the installed CLI surface.

**Non-Goals:**
- Fully emulate Claude Code hooks in Codex/Gemini when their lifecycle or async behavior differs.
- Provision MCP servers or translate Claude Code plugins.
- Automatically run `aco sync` inside every `aco delegate` invocation.
- Replace `.aco/formatter.yaml` as the provider/model routing source of truth.
- Guarantee Gemini read-only enforcement beyond the tools/configuration Gemini currently exposes.

## Decisions

### 1. Source Discovery Uses Repository Reality, Not Only `.claude/`

**Decision:** The sync layer SHALL read source files in this order:

1. `CLAUDE.md` at repository root, when present.
2. `.claude/CLAUDE.md`, when present.
3. `.claude/rules/*.md`, sorted lexicographically, when present.
4. `.claude/skills/*/SKILL.md` skill directories.
5. `.claude/agents/*.md` agent files.
6. `.claude/settings.json` hooks, with `.claude/hooks.json` accepted only as a legacy fallback.

**Rationale:** This repo stores the canonical repository context in root `CLAUDE.md` and hooks in `.claude/settings.json`. Designing only around `.claude/CLAUDE.md` and `.claude/hooks.json` would miss the current project.

**Alternative considered:** Require users to move everything under `.claude/`. Rejected because it would create churn and conflict with existing Claude Code conventions.

### 2. Generated Outputs Are Managed by Blocks and a Manifest

**Decision:** `AGENTS.md` and `GEMINI.md` SHALL be updated using a managed block:

```md
<!-- BEGIN ACO GENERATED CONTEXT -->
...
<!-- END ACO GENERATED CONTEXT -->
```

File and directory outputs that cannot use blocks (`.agents/skills`, `.codex/agents`, `.gemini/agents`, hook files) SHALL be tracked in `.aco/sync-manifest.json` with source path, target path, source hash, target hash, transformer version, and generated-at timestamp.

**Rationale:** Root context files are likely to contain user-authored content. Managed blocks prevent aco from overwriting unrelated instructions while still allowing deterministic regeneration.

**Alternative considered:** Full-file overwrite. Rejected because it would destroy user-maintained `AGENTS.md` or `GEMINI.md` content.

### 3. Skills Sync Copies Directories, Not Markdown Files

**Decision:** A skill source is a directory under `.claude/skills/` containing `SKILL.md`. The sync layer SHALL recursively copy the whole directory to `.agents/skills/<skill>/`, preserving `scripts/`, `references/`, `agents/openai.yaml`, templates, and other bundled assets.

**Rationale:** Codex and Gemini both use the Agent Skills directory shape. Copying only `*.md` would break any skill that depends on bundled assets.

**Alternative considered:** Also write `.codex/skills` and `.gemini/skills`. Rejected for v1 because `.agents/skills` is supported by both tools and avoids duplicate skill discovery.

### 4. Agent Transform Is Provider-Specific and Lossy by Design

**Decision:** The transformer SHALL parse Claude agent frontmatter and body, resolve model/provider through `.aco/formatter.yaml`, then emit separate Codex and Gemini agent definitions.

| Claude agent field | Codex `.codex/agents/*.toml` | Gemini `.gemini/agents/*.md` |
|--------------------|------------------------------|-------------------------------|
| `id` | `name` | `name` |
| `when` | `description` | `description` |
| body + `promptSeedFile` | `developer_instructions` | Markdown body |
| resolved model | `model` | `model` |
| `reasoningEffort` | `model_reasoning_effort` when supported by Codex config | omitted with manifest warning |
| `workspaceMode: read-only` | `sandbox_mode = "read-only"` | restrict tools to read/search where possible |
| `workspaceMode: edit` | `sandbox_mode = "workspace-write"` | inherit or grant edit-capable tools |
| `turnLimit` | no direct v1 mapping unless supported | `max_turns` |

Unsupported or lossy fields SHALL be recorded in the manifest warning list and surfaced in `aco sync --check`.

**Rationale:** Codex and Gemini custom agents are real project surfaces, but they are not equivalent. Explicit lossy conversion prevents false parity claims.

**Alternative considered:** Copy `.claude/agents/*.md` directly to both targets. Rejected because Codex expects TOML and Gemini expects different frontmatter keys.

### 5. Hook Conversion Must Adapt Semantics, Not Copy JSON

**Decision:** Hook conversion SHALL read Claude Code hook configuration from `.claude/settings.json` by default. It SHALL emit:

- `.codex/hooks.json` in Codex hook schema.
- `.codex/config.toml` with `[features] codex_hooks = true` merged into any managed config block or managed file.
- `.gemini/settings.json` hook entries in Gemini hook schema.
- `.gemini/hooks/*` wrapper scripts only when the source command requires path normalization or compatibility adaptation.

The transformer SHALL reject or warn on fields that cannot be preserved:

| Claude hook field | Codex handling | Gemini handling |
|-------------------|----------------|-----------------|
| `matcher` | preserve regex where event supports matcher | preserve matcher where event supports matcher |
| `timeout` | seconds | milliseconds |
| `async: true` | warning: Codex hooks are not equivalent async fire-and-forget | warning: Gemini hooks are synchronous |
| unsupported event | warning and skip | warning and skip |

**Rationale:** Codex and Gemini hooks run inside the agent loop and can block or alter model context. A direct copy would misrepresent async semantics and timeout units.

**Alternative considered:** Shell out to `gemini hooks migrate --from-claude`. Rejected as the only implementation path because aco needs deterministic generated output and manifest ownership; the Gemini migrator may still be useful for compatibility tests.

### 6. Provider Runtime Hardening Is Part of This Change

**Decision:** `aco delegate` provider launch code SHALL pass only flags present in the current provider CLI help surface. Specifically:

- Codex runtime may pass `exec`, `--skip-git-repo-check`, `--full-auto`, `--model`, `--sandbox`, `--cd`, and prompt input as supported.
- Gemini runtime may pass `--model`, `--prompt`, `--approval-mode`, `--sandbox`, or `--yolo` only where the selected provider path intentionally supports them.
- Neither provider runtime SHALL pass `--reasoning-effort`.

`reasoningEffort` remains valid in `.claude/agents/*.md` as vendor-neutral intent, but v1 sync maps it only to supported generated config surfaces. If no supported surface exists, the transformer records a warning and preserves runtime success.

**Rationale:** The current provider code can pass unsupported flags. Context sync would amplify this by generating agent files that encourage reasoning-effort use while runtime invocations fail.

**Alternative considered:** Keep dormant `effortMap` entries for future CLI support. Rejected; support must be added only when verified.

### 7. Runtime Sync Check Stays Out of `aco delegate`

**Decision:** `aco delegate` SHALL NOT run sync or block on drift detection. Drift detection belongs to `aco sync --check` and `aco pack setup`.

**Rationale:** The v2 blocking contract keeps provider execution predictable and avoids hidden filesystem writes during delegation.

**Alternative considered:** Auto-sync before each delegate. Rejected because it adds IO, writes generated files during task execution, and can change provider context unexpectedly.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Generated context diverges from Claude source | `.aco/sync-manifest.json` hashes and `aco sync --check` |
| User-authored `AGENTS.md` or `GEMINI.md` is overwritten | Managed block updates only; fail on unowned conflicting full-file targets |
| Hook conversion gives false safety guarantees | Warn and skip unsupported fields/events; record warnings in manifest |
| Gemini read-only agents cannot be perfectly enforced | Use best-effort tool restrictions and document lossy mapping |
| Codex hooks require feature flag | Generate or merge `.codex/config.toml` with `codex_hooks = true` |
| Generated skills become duplicate-discovered | Use `.agents/skills` only for shared v1 output |
| Formatter model aliases resolve to unsupported model slugs | `aco sync --check` surfaces warnings; runtime keeps provider CLI error behavior |

## Migration Plan

1. Add sync transformer modules and manifest writer.
2. Add `aco sync`, `aco sync --check`, and `aco sync --dry-run`.
3. Update `aco pack setup` to run sync after installing Claude templates.
4. Harden provider launch args before enabling generated agent output.
5. Add fixtures for current repo shape: root `CLAUDE.md`, `.claude/settings.json`, skill directories with assets, and `.claude/agents/*.md`.
6. Document generated files and add recommended `.gitignore` entries only if needed.

Rollback is file-based: remove generated managed blocks and manifest-owned output paths, then re-run the previous `aco pack setup` behavior.

## Open Questions

- Should `aco sync` default to writing generated hook files, or require `--hooks` until hook conversion has more production mileage?
- Should stale manifest warnings be emitted by `aco pack setup` as warnings or hard failures?
- Should generated `.codex/config.toml` be a fully managed file or a managed TOML merge section?
