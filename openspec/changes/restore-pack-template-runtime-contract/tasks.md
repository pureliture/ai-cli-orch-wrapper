## 1. Spec and Review Gates

- [x] 1.1 Review `proposal.md`, `design.md`, and `specs/pack-template-runtime-contract/spec.md` against #104 acceptance criteria and update the artifacts if any command, preset, binary, or documentation contract is underspecified.
- [x] 1.2 Run a multi-perspective spec review covering architecture/system design, testing strategy/TDD, and security/runtime correctness; record findings or resolution notes in the change directory.
- [x] 1.3 Decide and document the canonical TDD preset name (`tdd` vs `test-driven-development`) and any supported alias before implementation.
- [x] 1.4 Review the authoritative command/preset/binary contract table and implementation plan with multi-agent plan review before writing production code.

## 2. Failing Tests First

- [x] 2.1 Add a failing test that `aco pack setup` installs task presets into `.claude/aco/tasks` while preserving existing files without `--force`.
- [x] 2.2 Add a failing test that `aco pack setup --force` overwrites a packaged task preset and keeps the manifest entry.
- [x] 2.3 Add a failing test that documented `aco run gemini review` and `aco run codex review` select concrete prompt templates through a side-effect-free internal prompt resolver module and expose the selected path in runtime context/dashboard output without invoking live providers.
- [x] 2.4 Add a failing test that documented `gemini review` and `codex review` fail fast with recovery guidance when the packaged prompt template is missing.
- [x] 2.5 Add a failing test that unknown `aco run <provider> <unknown-command>` keeps generic fallback behavior outside the documented contract.
- [x] 2.6 Add a failing test that `aco ask --preset review --dry-run` and every documented spec/plan/TDD/code-simplify/default preset name resolves after pack setup.
- [x] 2.7 Add a failing test that a missing preset reports a clear `Preset not found` error.
- [x] 2.8 Add a failing unit or integration test for local checkout/tarball binary placement that proves setup does not require the public npm package fallback, reports manual recovery when binary placement cannot be verified, and does not claim uninstall ownership for global binaries.
- [x] 2.9 Add a failing test that sync preflight stops `aco pack setup` before template writes on fatal sync conflicts.
- [x] 2.10 Add failing tests that no-source workspaces and update-only drift do not block `aco pack setup` before template writes.
- [x] 2.11 Add a failing package smoke or fixture test exposed as `npm run test:pack-runtime-contract --workspace=packages/wrapper` that packs the current `dist`, installs the tarball into isolated `HOME`/`PATH`/npm prefix, runs the tarball-installed `aco --version`, `aco pack setup`, documented preset dry-runs, and `aco run gemini review --input demo` with a fake provider binary, and verifies packaged `dist`, commands, prompts, tasks, version, and template provenance without invoking live providers. The smoke command must not run `npm run build` internally, so stale `dist` remains observable.
- [x] 2.12 Run the newly added targeted tests before implementation, confirm the expected RED failures, and record the failure signatures in `review-notes.md`.

## 3. Runtime Contract Implementation

- [x] 3.1 Add `templates/tasks/**` as the packaged source of truth for `.claude/aco/tasks/**`, seeded from the existing repo-local task presets where appropriate.
- [x] 3.2 Add or rename provider prompt templates so documented `review` commands for Gemini and Codex resolve exact packaged prompt files or explicit tested aliases.
- [x] 3.3 Update `packages/wrapper/src/commands/pack-install.ts` to copy task presets, track them in the manifest, and preserve existing skip/force semantics.
- [x] 3.4 Update pack setup ordering so fatal sync preflight runs before pack template writes, while post-install sync failures include pack manifest recovery guidance.
- [x] 3.5 Move prompt template resolution into a side-effect-free internal resolver module, fail fast for missing documented review templates, and preserve unknown-command fallback behavior outside the documented contract.
- [x] 3.6 Update `aco pack setup` to parse and pass `--binary-name`, then update binary placement so local checkout and tarball setup verify existing binaries, avoid automatic global mutation, and offer current-artifact manual recovery instructions.

## 4. Documentation Alignment

- [x] 4.1 Update `README.md` and `packages/wrapper/README.md` so source checkout, local tarball, and published npm setup paths use the implemented command and preset names.
- [x] 4.2 Update `docs/guides/runbook.md` with copy-pastable pilot validation steps for `aco pack setup`, `aco run gemini review`, `aco run codex review`, and `aco ask --preset <name> --dry-run`.
- [x] 4.3 Update `docs/reference/context-sync.md` to describe task preset installation accurately and keep `aco sync` ownership separate from provider execution.
- [x] 4.4 Ensure docs separate repo/mock/package smoke validation from opt-in live Codex/Gemini provider smoke.

## 5. Review, Simplification, and Verification

- [x] 5.1 Run targeted tests added in section 2 and make them pass with the minimal implementation.
- [x] 5.2 Run broader wrapper validation: `npm run typecheck`, `npm test`, and the package smoke command selected for this contract.
- [x] 5.3 Run `openspec validate restore-pack-template-runtime-contract --type change --strict`.
- [x] 5.4 Perform code review with TypeScript/runtime correctness and security focus, then apply only findings required for correctness, maintainability, or pilot readiness.
- [x] 5.5 Perform a code-simplifier pass on touched code and docs to remove accidental duplication or over-specific abstractions while preserving behavior.
- [x] 5.6 Record final validation results, including whether live provider smoke was run or intentionally left as opt-in, before claiming completion.
