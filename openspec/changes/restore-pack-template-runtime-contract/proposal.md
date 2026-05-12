## Why

`aco pack setup`, packaged templates, README/runbook examples, and actual runtime command resolution currently do not describe the same install-time contract. This creates a pilot risk where fresh checkout or tarball users follow documented commands such as `aco run gemini review` or `aco ask --preset review`, but the installed prompt/task templates or binary path fall back to generic behavior.

## What Changes

- Define a single runtime contract for pack-installed command, prompt, task preset, and local binary behavior.
- Make `aco pack setup` usable from a local checkout or packaged tarball before npm publish, without relying on a global published fallback.
- Ensure `aco run gemini review` resolves the reviewer prompt template and exposes the selected prompt template in runtime/dashboard artifacts.
- Ensure `aco ask --preset review` and the related review/spec/plan/TDD preset names resolve from installed `.claude/aco/tasks/*.md` or an equivalent packaged task surface.
- Add fixture/smoke coverage that catches stale `dist/`, `npm pack`, and template-package mismatches before pilot use.
- Align README, `docs/guides/runbook.md`, and `docs/reference/context-sync.md` with the implemented install paths and runtime command names.

## Capabilities

### New Capabilities

- `pack-template-runtime-contract`: Defines the install-time and runtime contract for pack setup, provider prompt template resolution, task preset installation, local/dev binary execution, packaged tarball parity, and documentation alignment.

### Modified Capabilities

- (변경 없음)

## Impact

- `packages/wrapper/src/commands/pack-install.ts` and related pack setup paths: local/dev install resolution, template copy, and summary output behavior.
- `packages/wrapper/src/commands/ask.ts`, runtime context/session artifacts, and provider command execution: preset and prompt template selection behavior.
- `templates/`, `.claude/aco/prompts/`, `.claude/aco/tasks/`, and package `files`/`prepack` behavior: packaged template completeness.
- `packages/wrapper/tests/`, fixture tests, and smoke tests: tarball/local checkout parity and stale build artifact detection.
- `README.md`, `packages/wrapper/README.md`, `docs/guides/runbook.md`, and `docs/reference/context-sync.md`: user-visible command and installation guidance.
