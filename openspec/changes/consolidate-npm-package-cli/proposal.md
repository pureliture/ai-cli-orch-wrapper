## Why

The current publish model split across wrapper and installer package names has created release risk and user-facing ambiguity: users must understand both `aco` and `aco-install`, and CI/release automation must reason about multiple npm package tarballs. Issue #31 establishes a simpler target now: one publishable npm package, `@pureliture/ai-cli-orch-wrapper`, exposing one public CLI, `aco`.

## What Changes

- **BREAKING**: Consolidate the public npm package surface to `@pureliture/ai-cli-orch-wrapper`.
- **BREAKING**: Remove `aco-install` as a public CLI/package surface; installer/setup flows move under `aco` subcommands.
- Expose one user-facing CLI binary: `aco`.
- Support the command surface:
  - `aco pack install`
  - `aco pack setup`
  - `aco provider setup gemini`
  - `aco run ...`
- Update package manifests, workspace dependencies, lockfile, source imports, docs, and release configuration to match the single-package model.
- Update CI smoke packaging so it handles scoped npm tarball names for `@pureliture/ai-cli-orch-wrapper` rather than stale `aco-wrapper-*.tgz` globs.

## Capabilities

### New Capabilities
- `npm-package-cli`: Defines the public npm package name, public CLI binary, command surface, and CI/release expectations for the package.

### Modified Capabilities
- None.

## Impact

- Affected code:
  - Root and workspace `package.json` files
  - `package-lock.json`
  - `packages/wrapper` CLI/runtime package metadata and CLI routing
  - `packages/installer` install/setup command code, likely merged into or re-exported by the `aco` CLI
  - Source imports currently referring to wrapper/installer package names
- Affected automation:
  - `.github/workflows/ci.yml` smoke tarball lookup
  - `.github/workflows/release.yml`
  - `.changeset/config.json`
- Affected documentation:
  - README, runbooks, architecture docs, contributor docs, and package README files that mention `@aco/wrapper`, `aco-install`, `@pureliture/aco-wrapper`, or `@pureliture/aco-install`
- Affected user surface:
  - Users install/use `@pureliture/ai-cli-orch-wrapper` and invoke `aco`; `aco-install` is no longer the public entry point.
