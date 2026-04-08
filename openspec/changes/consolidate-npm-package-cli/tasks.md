## 1. Package Metadata

- [x] 1.1 Decide whether to physically merge `packages/installer` into the `aco` package now or keep it as an internal/private workspace for this change.
- [x] 1.2 Update the publishable package manifest to use `name: "@pureliture/ai-cli-orch-wrapper"` and expose only the public `aco` binary.
- [x] 1.3 Mark any retained wrapper/installer implementation workspaces as private/internal or exclude them from changesets publish.
- [x] 1.4 Update workspace dependencies so internal code no longer depends on public package names `@pureliture/aco-wrapper` or `@pureliture/aco-install`.
- [x] 1.5 Regenerate `package-lock.json` and verify it references the consolidated package model.

## 2. CLI Routing

- [x] 2.1 Move or re-export `packInstall`, `packSetup`, `packStatus`, `packUninstall`, and `providerSetup` handlers so the `aco` CLI can call them.
- [x] 2.2 Add `aco pack install`, `aco pack setup`, `aco pack status`, and `aco pack uninstall` routing to the `aco` CLI.
- [x] 2.3 Add `aco provider setup <name>` routing to the `aco` CLI.
- [x] 2.4 Preserve existing `aco run ...`, `aco --version`, and existing runtime command behavior.
- [x] 2.5 Remove or de-publicize the `aco-install` binary entrypoint.
- [x] 2.6 Update CLI usage/help text to show the `aco` command surface and not `aco-install` as the public entrypoint.

## 3. CI And Release

- [x] 3.1 Update `.github/workflows/ci.yml` smoke packaging to locate the tarball for `@pureliture/ai-cli-orch-wrapper` without using `aco-wrapper-*.tgz`.
- [x] 3.2 Update the smoke install step to install the consolidated package tarball and verify `aco --version`.
- [x] 3.3 Update `.changeset/config.json` so only the consolidated publish target is released.
- [x] 3.4 Review `.github/workflows/release.yml` for assumptions about multiple publishable workspaces and update if needed.

## 4. Documentation

- [x] 4.1 Update `README.md` to document `@pureliture/ai-cli-orch-wrapper` and `aco`.
- [x] 4.2 Update `docs/RUNBOOK.md`, `docs/CONTRIBUTING.md`, and `docs/architecture.md` for the single-package/single-CLI model.
- [x] 4.3 Update package-level README files or remove stale package-specific docs that present wrapper/installer as public packages.
- [x] 4.4 Search docs and source for `@aco/wrapper`, `aco-install`, `@pureliture/aco-wrapper`, and `@pureliture/aco-install`; remove or rewrite public-facing references.

## 5. Verification

- [x] 5.1 Run `npm ci` from the repository root.
- [x] 5.2 Run `npm run build`.
- [x] 5.3 Run workspace typechecks or root `npm run typecheck`.
- [x] 5.4 Run wrapper tests or root `npm test` where applicable.
- [x] 5.5 Run a local pack/install smoke check that installs the generated `@pureliture/ai-cli-orch-wrapper` tarball into a temporary prefix and executes `aco --version`.
- [x] 5.6 Verify changesets/npm publish metadata targets `@pureliture/ai-cli-orch-wrapper` and does not include the old split packages.
