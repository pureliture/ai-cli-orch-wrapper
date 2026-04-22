## 1. Proposal and Design Alignment

- [x] 1.1 Confirm latest supported surfaces for Codex CLI and Gemini CLI in tests or fixtures
- [x] 1.2 Update user-facing docs to state that `.agents/skills` is the shared skill target
- [x] 1.3 Document lossy conversion warnings for hooks, Gemini read-only behavior, and reasoning effort

## 2. Sync Core

- [x] 2.1 Add `packages/wrapper/src/sync/transform-interface.ts` with source discovery, transform plan, warning, and output abstractions
- [x] 2.2 Add source discovery for root `CLAUDE.md`, optional `.claude/CLAUDE.md`, optional `.claude/rules/*.md`, `.claude/skills/*/SKILL.md`, `.claude/agents/*.md`, and `.claude/settings.json`
- [x] 2.3 Add managed block updater for `AGENTS.md` and `GEMINI.md`
- [x] 2.4 Add `.aco/sync-manifest.json` writer/reader with source hashes, target hashes, transformer version, and warnings
- [x] 2.5 Add conflict detection for manifest-owned targets and untracked target paths

## 3. Context and Skill Transforms

- [x] 3.1 Implement Claude context aggregation into Codex `AGENTS.md`
- [x] 3.2 Implement Claude context aggregation into Gemini `GEMINI.md`
- [x] 3.3 Implement recursive skill directory copy from `.claude/skills/<skill>/` to `.agents/skills/<skill>/`
- [x] 3.4 Implement stale managed skill removal only when target hash still matches manifest ownership
- [x] 3.5 Add tests for skills with `scripts/`, `references/`, and metadata assets

## 4. Agent Transforms

- [x] 4.1 Parse `.claude/agents/*.md` frontmatter and body with existing aco v2 frontmatter rules
- [x] 4.2 Resolve provider/model through `.aco/formatter.yaml` for generated agent targets
- [x] 4.3 Implement Codex `.codex/agents/*.toml` generation
- [x] 4.4 Implement Gemini `.gemini/agents/*.md` generation
- [x] 4.5 Add manifest warnings for unsupported or lossy fields such as Gemini `reasoningEffort`
- [x] 4.6 Add fixture tests for reviewer, researcher, and executor agent transforms

## 5. Hook Transforms

- [x] 5.1 Read hook source from `.claude/settings.json` with `.claude/hooks.json` fallback
- [x] 5.2 Implement Codex `.codex/hooks.json` generation
- [x] 5.3 Implement managed `.codex/config.toml` hook feature enablement
- [x] 5.4 Implement Gemini `.gemini/settings.json` hook generation with timeout conversion to milliseconds
- [x] 5.5 Emit warnings for `async: true`, unsupported events, unsupported fields, and non-equivalent target semantics
- [x] 5.6 Add fixture tests for the existing `PostToolUse` Bash hook in `.claude/settings.json`

## 6. CLI Command

- [x] 6.1 Add `aco sync` command to `packages/wrapper/src/cli.ts`
- [x] 6.2 Add `aco sync --check`
- [x] 6.3 Add `aco sync --dry-run`
- [x] 6.4 Add `aco sync --force`
- [x] 6.5 Ensure command output includes created, updated, removed, skipped, warning, and conflict counts

## 7. Pack Setup Integration

- [x] 7.1 Run sync after existing `aco pack setup` install steps
- [x] 7.2 Preserve setup idempotency when generated files already exist and are current
- [x] 7.3 Surface sync warnings and manifest path in setup output
- [x] 7.4 Fail setup on fatal sync conflicts without overwriting user files

## 8. Provider Runtime Compatibility

- [x] 8.1 Remove unsupported `--reasoning-effort` from Codex provider runtime args
- [x] 8.2 Remove unsupported `--reasoning-effort` from Gemini CLI provider runtime args
- [x] 8.3 Add provider argument construction tests for Codex model + reasoning effort
- [x] 8.4 Add provider argument construction tests for Gemini model + reasoning effort
- [x] 8.5 Review formatter `launchArgs` handling and reject or warn on known unsupported provider flags

## 9. Verification

- [x] 9.1 Run `openspec validate aco-v2-context-sync-layer --type change --strict`
- [x] 9.2 Run TypeScript typecheck and wrapper unit tests
- [x] 9.3 Run Go provider tests for `internal/provider` and `cmd/aco`
- [x] 9.4 Run `aco sync --dry-run` against this repository and inspect planned outputs
- [x] 9.5 Run `aco sync --check` after generation to confirm manifest freshness
