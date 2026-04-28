## Context

The initial `prevent-external-skill-command-duplication` spec was created before implementation and diverged from the actual codebase. Through review cycles (commits ad66a82, 6fe1f30, 35fac46), the implementation stabilized with the following architecture:

- **Source discovery** (`source-discovery.ts`): Remains broad — all `.claude/skills/*/SKILL.md` files are discovered.
- **Classification** (`skill-classifier.ts`): New module. Applies a precedence chain to decide ownership: `.aco/sync.yaml` exclude → include → built-in ACO-owned defaults → frontmatter (`x-aco-owned`) → naming heuristics → default deny.
- **Config loading** (`sync-config.ts`): New module. Loads `.aco/sync.yaml` with `js-yaml`, supports glob matching with `*` wildcard, and defines default-deny with common external patterns (`openspec-*`, `superpowers-*`, `gh-*`) in `exclude`.
- **Skill transform** (`skill-transform.ts`): Rewritten. Uses classification to filter eligible skills, records skipped assets with reasons, computes directory hashes for stale target removal, and respects legacy `targetHashes` for backward compatibility.
- **Duplicate detection** (`duplicate-detector.ts`): Builds a provider exposure index from `.gemini/commands`, `.agents/skills`, `.codex/skills`, `.claude/commands`, and planned outputs. Detects same-provider-name collisions and cross-name canonical duplicates for OpenSpec.
- **Sync engine** (`sync-engine.ts`): Orchestrates the flow: load config → discover → plan → detect duplicates → detect conflicts → check mode (with strict duplicate escalation) → cleanup → write outputs → write manifest v2.
- **Manifest** (`manifest.ts`): Version `2` with `targets` (ownership-aware records), `skipped` (external/provider-specific assets), and `warnings` arrays. Legacy `targetHashes` kept for read compatibility.

## Goals / Non-Goals

**Goals:**
- Document the actual classification precedence chain as implemented.
- Document the actual manifest v2 schema and migration behavior.
- Document the actual duplicate detection and cleanup flow.
- Document the actual `.aco/sync.yaml` config schema and glob semantics.
- Document the actual strict/CI mode behavior.
- Ensure all spec artifacts are testable against the existing test suite.

**Non-Goals:**
- Re-design any implementation behavior. This is a spec alignment, not a feature change.
- Add new requirements beyond what is already implemented.
- Modify the test suite (unless tests are found to contradict the spec).

## Decisions

### 1. Keep the Precedence Chain Documented as Implemented

**Decision:** The spec SHALL document the exact precedence chain in `skill-classifier.ts`: (1) `.aco/sync.yaml` exclude, (2) `.aco/sync.yaml` include, (3) built-in defaults (`github-kanban-ops`), (4) frontmatter (`x-aco-owned`), (5) naming heuristics, (6) default deny.

**Rationale:** This ordering emerged from review feedback. Exclude has highest precedence because it is the safety guard. Include overrides defaults because it is an explicit maintainer decision. Frontmatter is advisory (does not override config) because repo-level policy should take precedence over self-declared metadata.

**Alternative considered:** Make frontmatter override config. Rejected because a skill author could inadvertently override central policy.

### 2. Manifest v2 with Legacy Compatibility

**Decision:** The spec SHALL define manifest v2 with `targets`, `skipped`, and `warnings`, while keeping `targetHashes` for backward read compatibility.

**Rationale:** The implementation already writes v2 and reads legacy v1 manifests. The spec must reflect this.

### 3. Duplicate Detection Includes Provider Exposure Index

**Decision:** The spec SHALL document the actual duplicate detector behavior: index built from `.gemini/commands`, `.agents/skills`, `.codex/skills`, `.claude/commands`, and planned outputs.

**Rationale:** The implementation scans all these surfaces. The original spec only partially described this.

### 4. Cleanup Is Conservative

**Decision:** The spec SHALL document the actual cleanup behavior: only manifest-owned (`owner === 'aco'`) assets are auto-removed; ambiguous assets require `--force-clean`.

**Rationale:** Matches the implementation exactly. Prevents accidental deletion of user-installed assets.

## Risks / Trade-offs

- **[Risk]** The spec revision may still drift from future implementation changes. → **Mitigation:** Add a CI check that runs `openspec verify` against the current change.
- **[Risk]** Original spec readers may be confused by the revision. → **Mitigation:** Archive the original change and reference this revision as the canonical source.
- **[Risk]** Test coverage claims in the spec may not match reality. → **Mitigation:** Cross-reference each spec scenario with `packages/wrapper/tests/sync.test.ts`.

## Migration Plan

1. Complete this spec revision (proposal, design, specs, tasks).
2. Archive the original `prevent-external-skill-command-duplication` change.
3. Update `openspec/config.yaml` or CI pipeline to point to this revision.
4. Verify all spec scenarios have corresponding test cases in `sync.test.ts`.

## Open Questions

- Should the original `prevent-external-skill-command-duplication` change be fully archived, or kept as a historical reference?
- Are there any implemented behaviors (e.g., specific error messages) that are intentionally left undocumented?
