## Context

The repository currently has two workspace packages with two user-facing binaries:

- `packages/wrapper`: runtime package, currently named `@pureliture/aco-wrapper`, exposing `aco`
- `packages/installer`: installer/setup package, currently named `@pureliture/aco-install`, exposing `aco-install`

Issue #31 changes the target product model to one publishable npm package and one public CLI:

```text
npm package: @pureliture/ai-cli-orch-wrapper
CLI: aco
commands:
  aco pack install
  aco pack setup
  aco provider setup gemini
  aco run ...
```

This change is cross-cutting because package metadata, CLI routing, imports, CI smoke tarball lookup, release config, and user documentation must converge on the same public surface.

## Goals / Non-Goals

**Goals:**
- Publish one npm package: `@pureliture/ai-cli-orch-wrapper`.
- Expose one public binary: `aco`.
- Move the install/setup command surface under `aco pack ...` and `aco provider setup ...`.
- Keep existing `aco run ...` behavior available.
- Remove public references to `aco-install`, `@pureliture/aco-wrapper`, and `@pureliture/aco-install`.
- Make CI smoke locate the tarball for the actual scoped package instead of hardcoding stale unscoped patterns.
- Keep release automation compatible with changesets.

**Non-Goals:**
- Redesign provider execution semantics.
- Add new providers.
- Change the OpenSpec/GitHub PM workflow command model.
- Preserve backwards-compatible public `aco-install` usage. If any compatibility shim is kept temporarily, it must be documented as internal/transitional rather than the public API.

## Decisions

### D1: One public npm package owns all CLI surface

**Decision**: `@pureliture/ai-cli-orch-wrapper` is the only publishable public npm package for this product. It exposes `bin.aco`.

**Rationale**: The package is already marketed as the installable command pack/wrapper. A single package avoids asking users to distinguish runtime and installer packages, and it removes release coupling between two packages that are versioned together.

**Alternatives considered**:
- Keep `@pureliture/aco-wrapper` + `@pureliture/aco-install`: preserves separation, but keeps user confusion and CI/release complexity.
- Publish `@pureliture/aco` instead: shorter name, but does not match the repository/product name the user selected in issue #31.

### D2: `aco` routes both runtime and setup commands

**Decision**: Extend the existing `aco` CLI entrypoint to route:

```text
aco run ...
aco pack install
aco pack setup
aco provider setup gemini
```

Installer command handlers may be moved from `packages/installer/src/commands/pack-install.ts` into the package that owns `aco`, or re-exported internally if the workspace layout is temporarily retained. The public binary remains `aco`.

**Rationale**: This keeps user interaction centered on one command while allowing implementation reuse from the current installer module.

**Alternatives considered**:
- Keep `aco-install` as a second binary in the same package: reduces migration work but violates the one-CLI decision and keeps the concept visible.
- Use `npx @pureliture/ai-cli-orch-wrapper install`: possible, but `aco pack setup` is more consistent with the existing pack command grouping.

### D3: Workspace layout can be refactored incrementally, publish surface cannot

**Decision**: The internal workspace layout may remain temporarily multi-package if needed for incremental implementation, but only `@pureliture/ai-cli-orch-wrapper` is public/publishable and documented. Non-public internal workspaces must be marked `private` or otherwise excluded from changesets publish.

**Rationale**: It avoids forcing a large physical code move before semantics are clear, while still preventing accidental publication of wrapper/installer split packages.

**Alternatives considered**:
- Immediately merge all source files into one package directory. This is clean, but larger and riskier in one step.
- Continue publishing two workspaces. This is explicitly rejected by issue #31.

### D4: CI smoke derives tarball names from npm output or package metadata

**Decision**: Smoke CI must not use stale `aco-wrapper-*.tgz` globs. It should derive the tarball path from `npm pack` output, or compute the scoped tarball name for `@pureliture/ai-cli-orch-wrapper`.

**Rationale**: Scoped package tarball names transform scope separators, e.g. `@pureliture/ai-cli-orch-wrapper` becomes a `pureliture-ai-cli-orch-wrapper-<version>.tgz` tarball. Deriving avoids another hardcoded glob break on future renames.

**Alternatives considered**:
- Replace the glob with `pureliture-ai-cli-orch-wrapper-*.tgz`: acceptable short term, but less robust than deriving.

## Risks / Trade-offs

- **[Risk] Command migration regresses existing installer behavior** → Reuse current `packInstall`, `packSetup`, and `providerSetup` handlers behind the `aco` router; add smoke coverage for the new command names.
- **[Risk] Internal workspaces still get published accidentally** → Mark non-public packages as `private` or update changesets config to ignore them; verify with `changeset status`/dry-run style checks where possible.
- **[Risk] Docs temporarily mention old package names** → Search for `@aco/wrapper`, `aco-install`, `@pureliture/aco-wrapper`, and `@pureliture/aco-install` as part of the tasks.
- **[Risk] CI smoke installs the wrong tarball** → Capture the exact wrapper/product package tarball path from `npm pack` output and install that path explicitly.
- **[Risk] Existing users of `aco-install` break** → This is an accepted breaking change for the current pre-1.0 package surface; document the replacement commands.

## Migration Plan

1. Update package metadata so the publishable package is `@pureliture/ai-cli-orch-wrapper` with `bin.aco`.
2. Move or internally expose pack/provider setup command handlers through `aco`.
3. Exclude old wrapper/installer packages from public publish, either by merging them or marking them private/internal.
4. Update lockfile, imports, and docs.
5. Update CI smoke tarball lookup and install step.
6. Run `npm ci`, builds, typechecks, and smoke checks.
7. Push the change through PR CI; validate release workflow on main.

Rollback is to restore the two-package publish model, but that should only be used if single-package routing cannot be made to build because it reintroduces the issue #31 release and UX problems.

## Open Questions

- Should the repository physically merge `packages/installer` into `packages/wrapper`, or keep internal workspaces with only the product package publishable for this change?
- Should a temporary hidden `aco-install` shim remain for one release, or should it be removed immediately as a breaking change?
