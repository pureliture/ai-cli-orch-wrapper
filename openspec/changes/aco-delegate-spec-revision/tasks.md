## 1. Spec Verification

- [x] 1.1 Cross-reference `specs/skill-classifier/spec.md` scenarios with `skill-classifier.ts` implementation
- [x] 1.2 Cross-reference `specs/sync-config/spec.md` scenarios with `sync-config.ts` implementation
- [x] 1.3 Cross-reference `specs/context-sync/spec.md` scenarios with `skill-transform.ts` and `sync-engine.ts` implementation
- [x] 1.4 Cross-reference `specs/cli-sync-command/spec.md` scenarios with `sync-engine.ts` strict mode and cleanup behavior
- [x] 1.5 Cross-reference `specs/aco-pack-setup/spec.md` scenarios with `pack-install.ts` and sync integration
- [x] 1.6 Cross-reference `specs/external-provider-surface-guardrails/spec.md` scenarios with `duplicate-detector.ts` implementation

## 2. Test Alignment

- [x] 2.1 Verify every spec scenario has a corresponding test in `packages/wrapper/tests/sync.test.ts`
- [x] 2.2 Verify `matchesGlob` tests cover exact match, prefix wildcard, suffix wildcard, and regex escape
- [x] 2.3 Verify `classifySkill` tests cover all precedence levels (exclude, include, built-in, frontmatter, heuristic, default deny)
- [x] 2.4 Verify manifest v2 tests cover `targets`, `skipped`, and legacy `targetHashes` compatibility
- [x] 2.5 Verify duplicate detection tests cover provider exposure index, cross-name canonical deduplication, and cleanup targets
- [x] 2.6 Verify `runSync` tests cover strict mode, cleanDuplicates, and forceClean behavior

## 3. Documentation Alignment

- [x] 3.1 Update `docs/reference/context-sync.md` to state that `.agents/skills` is not a mirror and only ACO-owned skills are synced
- [x] 3.2 Update `CLAUDE.md` or `.claude/CLAUDE.md` sync-related sections to reflect ownership-aware behavior
- [x] 3.3 Update `AGENTS.md` if it contains stale mirror-all skill sync references
- [x] 3.4 Verify `docs/architecture.md` accurately describes the classification → planning → duplicate detection → execution flow

## 4. Original Spec Archive

- [x] 4.1 Archive the original `prevent-external-skill-command-duplication` change or mark it as superseded
- [x] 4.2 Add a reference in the new proposal pointing to the original change for historical context
- [x] 4.3 Verify `openspec/config.yaml` and CI pipeline reference the correct canonical change

## 5. Final Validation

- [x] 5.1 Run `npm run typecheck` and confirm no type errors
- [x] 5.2 Run `npm test` and confirm all tests pass
- [x] 5.3 Run `npm run test:fixtures` and confirm fixture tests pass
- [x] 5.4 Run `aco sync --check --strict` against this repository and confirm no duplicate warnings
- [x] 5.5 Run `openspec verify aco-delegate-spec-revision --type change --strict` if available
- [x] 5.6 Run `git diff --check` and confirm no whitespace issues
