## 1. Discovery and Ownership Model

- [x] 1.1 Add sync ownership types for `aco`, `external`, `provider-specific`, and `unknown` assets in `packages/wrapper/src/sync/transform-interface.ts`
- [x] 1.2 Add `.aco/sync.yaml` loading with `skills.include` and `skills.exclude` glob support
- [x] 1.3 Add skill frontmatter parsing for `x-aco-owned`, `x-aco-kind`, and `x-aco-targets`
- [x] 1.4 Implement asset classification for ACO-owned shared skills, `gh-*` command-alias skills, OpenSpec skills, Superpowers skills, and unknown local skills
- [x] 1.5 Add unit tests for include/exclude precedence, default deny behavior, and glob matching

## 2. Context Sync Behavior

- [x] 2.1 Update `syncSkills()` so only explicitly allowed ACO-owned shared policy/reference skills are copied to `.agents/skills/`
- [x] 2.2 Preserve recursive copy behavior for allowed skills such as `github-kanban-ops`, including bundled scripts and references
- [x] 2.3 Ensure `openspec-*`, `superpowers-*`, Superpowers named skills, and `gh-*` are skipped without creating `.agents/skills/<name>/`
- [x] 2.4 Update stale target removal so only manifest-owned ACO outputs with matching hashes are auto-removed
- [x] 2.5 Add fixture tests covering `github-kanban-ops`, `openspec-apply-change`, `gh-issue`, and Superpowers skill names

## 3. Manifest and Diagnostics

- [x] 3.1 Extend `.aco/sync-manifest.json` writing to include per-target owner, kind, source, provider, action, target list, hashes, and warnings
- [x] 3.2 Preserve read compatibility for existing hash-only manifests and migrate records on the next successful sync
- [x] 3.3 Record skipped and external assets in the manifest without treating them as generated outputs
- [x] 3.4 Ensure `aco sync --force` cannot overwrite or adopt external assets
- [x] 3.5 Add manifest tests for ACO-owned generated assets, skipped external assets, and legacy manifest migration

## 4. Duplicate Detection and Cleanup

- [x] 4.1 Add a provider exposure index for `.gemini/commands`, `.agents/skills`, `.codex/skills`, `.gemini/skills`, and relevant Claude command surfaces
- [x] 4.2 Detect Gemini duplicate exposure such as `.gemini/commands/gh-issue.toml` plus `.agents/skills/gh-issue/SKILL.md`
- [x] 4.3 Detect OpenSpec/Superpowers external duplicate surfaces such as `.gemini/commands/opsx/`, `.codex/skills/openspec-*`, and `.agents/skills/openspec-*`
- [x] 4.4 Add `aco sync --check` warning output with provider name, exposed name, cause files, and recommended action
- [x] 4.5 Add strict duplicate escalation for `aco sync --check --strict` or CI mode
- [x] 4.6 Add duplicate cleanup dry-run and force-clean behavior for manifest-owned versus ambiguous duplicate assets

## 5. Pack Install and Provider Surfaces

- [x] 5.1 Scope `aco pack install` and `aco pack setup` to ACO-owned command pack assets only
- [x] 5.2 Ensure `aco pack setup` does not create OpenSpec or Superpowers copies in `.agents/skills`, `.codex/skills`, or `.gemini/commands/opsx`
- [x] 5.3 Keep Gemini `gh-*` command entrypoints in `.gemini/commands` and Claude `gh-*` entrypoints in `.claude/commands`
- [x] 5.4 Remove `.agents/skills/gh-*` from generated/shared skill outputs and document Codex `$gh-*` as deferred Codex-only design work
- [x] 5.5 Update or add `aco pack status` output so ACO command pack status and external integration observations are reported separately

## 6. Repository Cleanup and Documentation

- [x] 6.1 Remove or mark for cleanup tracked `.agents/skills/gh-*` command-alias skill copies
- [x] 6.2 Remove or document cleanup for tracked `.gemini/commands/opsx/` OpenSpec command copies
- [x] 6.3 Remove or document cleanup for tracked `.codex/skills/openspec-*` OpenSpec skill copies
- [x] 6.4 Update `docs/reference/context-sync.md` to state that `.agents/skills` is not a mirror of `.claude/skills`
- [x] 6.5 Update `docs/architecture.md`, `CLAUDE.md`, and `AGENTS.md` with ACO-owned versus external asset ownership rules
- [x] 6.6 Update `openspec/changes/aco-v2-context-sync-layer/design.md` and `specs/context-sync/spec.md` so the older mirror-all skill sync proposal no longer conflicts with this change

## 7. Verification

- [x] 7.1 Add unit tests for `syncSkills()` allowlist behavior, external skips, command-alias skips, and manifest skipped records
- [x] 7.2 Add integration fixture with `github-kanban-ops`, `openspec-apply-change`, `gh-issue`, `.gemini/commands/gh-issue.toml`, `.gemini/commands/opsx/apply.toml`, and `.codex/skills/openspec-apply-change/SKILL.md`
- [x] 7.3 Verify the fixture creates only `.agents/skills/github-kanban-ops/` and emits duplicate/external warnings
- [x] 7.4 Run `openspec validate prevent-external-skill-command-duplication --type change --strict`
- [x] 7.5 Run targeted sync tests, then `npm run typecheck`, `npm test`, `npm run test:fixtures`, and `git diff --check`
- [x] 7.6 Run `aco sync --check --strict` against this repository and confirm duplicate diagnostics match the migration plan
