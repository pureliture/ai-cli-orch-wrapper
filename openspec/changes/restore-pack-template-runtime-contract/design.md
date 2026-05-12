## Context

#104 is a pilot-readiness bug, not a new feature surface. The current wrapper already exposes `aco pack setup`, `aco run <provider> <command>`, and `aco ask --preset`, but their install-time assets are not guaranteed to line up:

- `packInstall()` copies `templates/commands` to `.claude/commands` and `templates/prompts` to `.claude/aco/prompts`.
- `aco ask --preset <name>` reads `.claude/aco/tasks/<name>.md`, but pack setup does not install task presets from the packaged `templates` tree.
- `aco run <provider> <command>` resolves prompt templates from `.claude/aco/prompts/<provider>/<command>.md`, while the existing Gemini reviewer prompt uses `reviewer.md` and documented commands use `review`.
- `placeWrapperBinary()` falls back to `npm install -g @pureliture/ai-cli-orch-wrapper`, which is unsafe for a local checkout or tarball pilot before publish.
- Package `files` and `prepack` include `dist` and `templates`, so stale build output or an incomplete `templates` copy can produce a tarball that behaves differently from the source checkout.

The design goal is a narrow runtime contract: after setup, documented commands and presets must resolve the same assets in source, built package, and tarball installs.

## Goals / Non-Goals

**Goals:**

- Make pack setup install a complete command/prompt/task runtime surface.
- Make documented `aco run gemini review` and `aco run codex review` select concrete provider prompt templates instead of generic fallback prompts.
- Make documented `aco ask --preset <name>` values resolve from installed task presets.
- Make local checkout and tarball setup prefer the current package artifact over the public npm package fallback.
- Add tests that catch source/package/tarball drift before pilot use.
- Align README, runbook, and context-sync references with the implemented contract.

**Non-Goals:**

- Do not add provider-specific slash command sprawl beyond the existing packaged command model.
- Do not change `aco ask` consent semantics, permission profiles, or output-mode policy.
- Do not change provider auth setup or invoke real Codex/Gemini providers in default CI.
- Do not broaden `aco sync` ownership rules or reintroduce external skill mirroring.
- Do not remove unknown-command fallback behavior for low-level `aco run`; only documented commands must have packaged templates.

## Decisions

### Decision 1: Treat `templates/` as the packaged runtime asset root

Pack setup SHALL install three asset families from the package-local `templates` root:

- `templates/commands/**` to `.claude/commands/**`
- `templates/prompts/**` to `.claude/aco/prompts/**`
- `templates/tasks/**` to `.claude/aco/tasks/**`

The repo-local `.claude/aco/tasks/**` files may seed this tree, but implementation should make `templates/tasks/**` the package source of truth so `npm pack` and source checkout setup use the same path.

Before writing any pack templates, `aco pack setup` SHALL perform a sync preflight against the target repository and abort only for true manifest-owned target conflicts. No-source workspaces and update-only drift are not fatal preflight blockers because setup must still work in fresh target projects and because normal `aco sync` can refresh stale generated outputs after templates are installed. After templates are installed, setup runs the actual sync step. If the second sync fails due to a race or filesystem drift, setup reports that pack files may have been installed and points to the pack manifest plus `aco pack uninstall` for recovery.

Alternative considered: copy `.claude/aco/tasks` directly during development. That would make source checkout setup pass while packaged tarballs still risk missing task presets, so it is rejected as the primary contract.

### Decision 2: Make documented command and preset names exact

The documented low-level command `aco run <provider> review` SHALL resolve a prompt file at `.claude/aco/prompts/<provider>/review.md`, or through an explicit tested alias table that is reported in runtime context as the selected template path.

For `aco ask`, canonical preset names SHALL be listed in one place and backed by installed files. The initial pilot set should cover review/spec/plan/TDD flows, with aliases only when they are documented and tested. This prevents the docs from saying `review` while runtime requires `reviewer` or another implicit name.

Authoritative contract table:

| Surface | Canonical name | Installed source | Installed target | Alias policy | Fallback policy |
| ------- | -------------- | ---------------- | ---------------- | ------------ | --------------- |
| `aco run gemini <command>` | `review` | `templates/prompts/gemini/review.md` | `.claude/aco/prompts/gemini/review.md` | none for #104 | unknown commands keep generic fallback and are outside the documented contract |
| `aco run codex <command>` | `review` | `templates/prompts/codex/review.md` | `.claude/aco/prompts/codex/review.md` | none for #104 | unknown commands keep generic fallback and are outside the documented contract |
| `aco ask --preset <name>` | `review` | `templates/tasks/review.md` | `.claude/aco/tasks/review.md` | none for #104 | missing presets fail with `Preset not found` |
| `aco ask --preset <name>` | `spec-critique` | `templates/tasks/spec-critique.md` | `.claude/aco/tasks/spec-critique.md` | none for #104 | missing presets fail with `Preset not found` |
| `aco ask --preset <name>` | `plan-critique` | `templates/tasks/plan-critique.md` | `.claude/aco/tasks/plan-critique.md` | none for #104 | missing presets fail with `Preset not found` |
| `aco ask --preset <name>` | `tdd` | `templates/tasks/tdd.md` | `.claude/aco/tasks/tdd.md` | no `test-driven-development` alias unless docs already require it | missing presets fail with `Preset not found` |
| `aco ask --preset <name>` | `code-simplify` | `templates/tasks/code-simplify.md` | `.claude/aco/tasks/code-simplify.md` | none for #104 | missing presets fail with `Preset not found` |
| `aco ask --preset <name>` | `default` | `templates/tasks/default.md` | `.claude/aco/tasks/default.md` | none for #104 | missing presets fail with `Preset not found` |

Prompt resolution SHALL be testable without invoking live providers by moving the resolver into a side-effect-free module, for example `packages/wrapper/src/runtime/run-prompt-template.ts`. Unit tests import that module directly, while tarball smoke verifies the packaged `dist` runtime with fake provider binaries. Live `aco run gemini review` and `aco run codex review` remain opt-in provider smoke.

If a documented provider command such as `aco run gemini review` or `aco run codex review` cannot find its packaged prompt template or documented alias, the resolver SHALL return an actionable error and `aco run` SHALL fail before invoking the provider. This is intentionally stricter than unknown-command fallback because missing documented templates indicate a broken install or package artifact.

Alternative considered: keep generic fallback prompts and rely on docs to tell users which names work. That preserves current behavior but fails the pilot acceptance criteria because runtime success would depend on hidden fallback behavior.

### Decision 3: Prefer current package binary installation before public npm fallback

When `aco pack setup` runs from a local checkout, built package, or local tarball, binary placement SHALL first verify whether the requested binary name already resolves to this wrapper by running `<binaryName> --version`. If it resolves to `aco <version>`, setup reports success. If it is missing or resolves to a different executable, setup SHALL NOT automatically install, link, replace, or remove any global binary. Instead, setup SHALL report the current package path or executable context and give manual recovery commands for the current artifact. Any future machine-wide install/link behavior must be explicit opt-in and is outside #104.

For #104, binary install ownership is intentionally not expanded: `aco pack uninstall` owns only files recorded in `.claude/aco/aco-manifest.json` and does not remove a user-installed global binary. Re-running setup repeats the same verification and guidance without changing global machine state.

`aco pack setup` SHALL accept the same `--binary-name <name>` option as `aco pack install` so tests and operators can verify an isolated binary name without relying on whatever `aco` happens to be in `PATH`.

### Decision 4: Test the package artifact, not only source files

The highest-value regression test is a fixture that runs `npm pack`, installs the tarball into an isolated npm prefix with isolated `HOME` and `PATH`, runs the tarball-installed `aco pack setup`, and verifies installed commands, prompts, tasks, runtime dashboard prompt selection with a fake local provider binary, preset loading, and `aco --version`. The smoke command must not build internally; stale `dist` detection depends on executing the currently packaged runtime artifact. Final release validation can build first and rerun the same smoke for a green package check.

Unit tests should cover fast path helpers such as template source discovery, preset resolution, prompt template resolution, binary fallback decisions, and sync preflight ordering. The tarball/package smoke can be kept outside the default tight unit loop if it is too slow, but it must be available as the named non-live validation command `npm run test:pack-runtime-contract --workspace=packages/wrapper` and documented in the PR checklist.

This command is distinct from the existing provider/mock runtime smoke (`npm run test:smoke`). `test:pack-runtime-contract` SHALL validate package assets, tarball-installed binary provenance, dry-run/mock contract behavior, and packaged prompt resolution with fake local provider binaries only; live Codex/Gemini provider smoke remains opt-in documentation and MUST NOT be required by default CI.

### Decision 5: Documentation is part of the runtime contract

README, `packages/wrapper/README.md`, `docs/guides/runbook.md`, and `docs/reference/context-sync.md` SHALL describe the same command/preset names and install paths as the tests. Docs should distinguish:

- source checkout invocation,
- local tarball install,
- published npm package install,
- default CI/mock validation,
- opt-in real provider smoke.

## Risks / Trade-offs

- [Risk] Global binary placement can mutate the developer machine unexpectedly. -> Mitigation: prefer current package path, keep warnings explicit, and test with temporary prefixes where possible.
- [Risk] Adding task presets to packaged templates can overwrite user-authored `.claude/aco/tasks` files. -> Mitigation: reuse existing `force` semantics and manifest tracking; skip existing files unless `--force` is set.
- [Risk] Aliasing `reviewer` and `review` can hide naming drift. -> Mitigation: choose exact canonical filenames for documented commands, and keep aliases explicit only when tests assert the alias behavior.
- [Risk] Tarball smoke tests can be slower and flaky if they call live providers. -> Mitigation: use mock provider/default dry-run paths in CI; keep real Codex/Gemini smoke opt-in.
- [Risk] Docs can drift again after implementation. -> Mitigation: add changed-file checks and smoke assertions that look for the documented command/preset names.
- [Risk] Sync conflicts can leave partial `.claude` pack writes if checked too late. -> Mitigation: run sync preflight before pack writes and document pack manifest recovery if post-install sync fails.

## Migration Plan

1. Add failing tests for task preset installation, prompt template resolution, local/tarball binary behavior, and package artifact parity.
2. Add `templates/tasks/**` and any missing provider prompt filenames needed by documented commands.
3. Update `packInstall()`/`packSetup()` to copy task presets and prefer local package binary placement.
4. Update runtime resolution only as needed to support explicit aliases or clearer diagnostics.
5. Update README/runbook/context-sync docs to match the tested contract.
6. Run targeted tests first, then broader wrapper validation and tarball smoke before PR.

Rollback is straightforward: revert the pack setup/template/runtime changes and remove the new OpenSpec change. No data migration is required.

## Open Questions

- None blocking for #104. Future work may add an explicit `aco pack doctor` or resolver inspection command if the internal resolver test surface proves insufficient for maintainers.
