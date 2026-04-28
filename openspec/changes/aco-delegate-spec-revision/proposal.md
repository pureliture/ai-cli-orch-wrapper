## Why

The initial `prevent-external-skill-command-duplication` spec (GitHub issue #82) was authored before the implementation was complete. Since then, the codebase has evolved significantly — ownership-aware skill classification, `.aco/sync.yaml` configuration, duplicate detection, strict mode, and conservative cleanup have all been implemented and refined through multiple review cycles (commits ad66a82, 6fe1f30, 35fac46). The original spec no longer accurately reflects the actual architecture, interfaces, or behavior. This revision updates the spec so that design artifacts, task lists, and requirement definitions stay in sync with the implemented reality.

## What Changes

- **BREAKING**: `SyncManifest` version upgraded from `1` to `2` with ownership-aware `targets`, `skipped`, and `warnings` arrays.
- Revise `skill-transform` spec to document the actual `classifySkill` precedence chain (`.aco/sync.yaml` exclude → include → built-in defaults → frontmatter → heuristics → default deny).
- Update `sync-engine` spec to reflect the actual duplicate detection integration, strict/CI mode behavior, and conservative cleanup flow.
- Add `sync-config` spec for `.aco/sync.yaml` loading, glob matching, and include/exclude precedence.
- Add `skill-classifier` spec documenting the built-in external name sets, command-alias prefixes, and ACO-owned defaults.
- Update `duplicate-detector` spec to match the actual provider exposure index and cross-name canonical duplicate detection.
- Update `context-sync` delta spec to reflect the ownership-aware manifest model and skipped-record behavior.
- Update `aco-pack-setup` delta spec to clarify that pack setup is scoped to ACO-owned command pack assets only.
- Align all test coverage claims with the actual test suite in `packages/wrapper/tests/sync.test.ts`.

## Capabilities

### New Capabilities
- `sync-config`: Load and apply `.aco/sync.yaml` include/exclude glob rules with correct precedence.
- `skill-classifier`: Classify discovered skills into `aco`, `external`, `provider-specific`, or `unknown` ownership.

### Modified Capabilities
- `context-sync`: Skill sync now default-deny with explicit allowlist; manifest v2 carries ownership and skipped metadata.
- `cli-sync-command`: `aco sync --check` now detects and reports duplicate provider-surface warnings; `--strict` promotes them to errors.
- `aco-pack-setup`: Pack setup scoped to ACO-owned command pack assets only; does not spread external assets.
- `external-provider-surface-guardrails`: Duplicate detection includes provider exposure index, cross-name canonical deduplication, and safe cleanup with `--force-clean`.

## Impact

- `packages/wrapper/src/sync/`: All transform modules updated with ownership-aware interfaces.
- `packages/wrapper/src/sync/transform-interface.ts`: Extended type definitions for `AssetOwner`, `AssetKind`, `SyncConfig`, `ManifestTargetRecord`, `ManifestSkippedRecord`.
- `packages/wrapper/src/sync/skill-classifier.ts`: New built-in classifier with hardcoded policy sets.
- `packages/wrapper/src/sync/sync-config.ts`: New `.aco/sync.yaml` loader and glob matcher.
- `packages/wrapper/src/sync/skill-transform.ts`: Rewritten with classification integration, skipped records, and stale target removal.
- `packages/wrapper/src/sync/sync-engine.ts`: Duplicate detection integration, strict mode, conservative cleanup.
- `packages/wrapper/src/sync/duplicate-detector.ts`: Full provider exposure index and cleanup target generation.
- `packages/wrapper/tests/sync.test.ts`: Expanded test coverage for classification, manifest v2, duplicate detection, and cleanup.
- `openspec/changes/prevent-external-skill-command-duplication/`: Original spec archived; this revision supersedes it.
