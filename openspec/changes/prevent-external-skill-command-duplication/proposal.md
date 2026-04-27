## Why

`aco sync` currently treats every `.claude/skills/<skill>/SKILL.md` directory as a shared Codex/Gemini skill and recursively copies it into `.agents/skills/`. That broad replication duplicates command-alias skills such as `gh-*`, duplicates external OpenSpec/Superpowers assets, and creates drift risk when upstream tools update their own installed skills or commands.

This needs to change now because Gemini already has provider-specific command entries under `.gemini/commands/`, while OpenSpec and Superpowers have moved toward upstream-managed skill/plugin surfaces instead of ACO-maintained command forks.

## What Changes

- Change shared skill sync from broad mirror semantics to default-deny, explicit allow semantics.
- Sync only ACO-owned shared policy/reference skills, such as `github-kanban-ops`, into `.agents/skills/`.
- Treat OpenSpec, Superpowers, marketplace/plugin skills, and command-alias skills as external or provider-specific assets instead of shared sync outputs.
- Add ACO-owned metadata support through skill frontmatter and `.aco/sync.yaml`, including include/exclude glob rules where exclude has highest precedence.
- Stop generating or preserving `.agents/skills/gh-*`, `.agents/skills/openspec-*`, and `.agents/skills/superpowers-*` as shared skill outputs.
- Add duplicate provider-surface detection for command/skill names that can be exposed twice to the same provider, with strict/CI escalation.
- Extend `.aco/sync-manifest.json` so generated, skipped, and external assets carry ownership, kind, source, target, action, and warning metadata.
- Scope `aco pack install` and `aco pack setup` to ACO-owned command pack assets and separate external integration status from ACO command pack status.
- Document safe migration and cleanup for already-generated duplicate surfaces such as `.gemini/commands/opsx/` and `.codex/skills/openspec-*`.

## Capabilities

### New Capabilities

- `external-provider-surface-guardrails`: Detect duplicate provider command/skill exposure, classify external assets, and provide safe cleanup guidance for generated duplicates.

### Modified Capabilities

- `context-sync`: Change skill synchronization from mirror-all to explicit ACO-owned allowlist policy, and record ownership/skipped/external metadata.
- `cli-sync-command`: Extend `aco sync --check` and strict/CI behavior to report duplicate provider-surface warnings without writing files.
- `aco-pack-setup`: Prevent pack setup from spreading external OpenSpec/Superpowers assets and separate ACO command pack readiness from external integration status.

## Impact

- **packages/wrapper/src/sync/**: skill classification, `.aco/sync.yaml` loading, ownership-aware manifest model, duplicate detector, and cleanup planning.
- **packages/wrapper/src/commands/pack-install.ts**: pack install/setup scope and status output.
- **packages/wrapper/src/cli.ts**: `aco sync --check` duplicate reporting and strict/CI escalation options.
- **templates/commands/** and **.claude/commands/**: remain ACO-owned command pack surfaces; external command packs are not vendored.
- **.agents/skills/**: keep ACO-owned shared policy/reference skills only; remove command alias and external duplicate skills.
- **.gemini/commands/** and **.codex/skills/**: document and clean up duplicated OpenSpec provider-specific copies where ACO generated them.
- **docs/reference/context-sync.md**, **docs/architecture.md**, **CLAUDE.md**, **AGENTS.md**, and existing OpenSpec context-sync docs/specs: update provider surface ownership rules.
