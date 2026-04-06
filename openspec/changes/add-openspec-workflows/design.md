## Context

The repository already contains OpenSpec-generated assets in `.github/`, `.claude/`, and `openspec/`, but the initialized state stopped before any change artifacts were created. That makes the workflow hard to resume because contributors can see generated surfaces without a clear statement of what the repository expects them to do next.

This change is documentation-heavy rather than runtime-heavy. No package code, dependency graph, or public API needs to change. The main task is to make the repository's OpenSpec surfaces explicit and show the minimal command path needed to continue work.

## Goals / Non-Goals

**Goals:**
- Define the repository capability for storing OpenSpec workflow assets.
- Make the current OpenSpec integration legible to contributors.
- Document the minimal command sequence for continuing and validating a change.

**Non-Goals:**
- Change the runtime behavior of `aco` or `aco-install`.
- Introduce custom OpenSpec schemas or plugins.
- Replace the generated OpenSpec prompts and skills with a custom workflow.

## Decisions

### Decision: Treat the current state as an OpenSpec integration change
Rather than deleting the generated assets or leaving them undocumented, the repository will define a dedicated OpenSpec change that explains their role. This matches the current working tree and avoids losing the user's in-progress setup.

Alternative considered: remove all generated OpenSpec files and defer the integration.
Why not chosen: the repository is already initialized, and the user explicitly asked to continue the OpenSpec work rather than discard it.

### Decision: Scope implementation to documentation and validation first
The generated assets already exist and are structurally complete enough to be tracked. The missing piece is contributor guidance. The implementation therefore focuses on `README.md`, `docs/RUNBOOK.md`, and OpenSpec artifact completion instead of inventing new automation.

Alternative considered: add scripts or wrapper commands around `openspec`.
Why not chosen: that would expand scope, create maintenance overhead, and is not required to make the current work resumable.

### Decision: Keep `.github/` and `.claude/` surfaces visible in the documented layout
The generated assets exist in both locations and serve different tool surfaces. Documentation will describe them directly instead of hiding them behind generic wording.

Alternative considered: document only `openspec/` and ignore prompt/skill surfaces.
Why not chosen: contributors would still encounter `.github/` and `.claude/` files without knowing why they exist.

## Risks / Trade-offs

- [Documentation may drift from generated assets] → Keep the documented command set small and based on stable `openspec` commands already present in the repo.
- [Generated prompts reference tools unavailable in every agent environment] → Document them as repository assets and continuation surfaces, not as guarantees about every runtime.
- [The integration may remain shallow if no future changes are created] → Completing a real OpenSpec change now gives the repo one valid example to continue from.

## Migration Plan

1. Complete the OpenSpec artifacts for `add-openspec-workflows`.
2. Update repository docs to describe the generated workflow assets and continuation commands.
3. Validate the change with `openspec validate` and verify repository tests still pass.

Rollback is clean: remove the new change directory and revert the documentation updates.

## Open Questions

- Whether the repository should later add a custom `openspec` schema tailored to AI workflow repositories.
- Whether generated `.claude/` assets should remain tracked long-term or be re-generated per install flow.
