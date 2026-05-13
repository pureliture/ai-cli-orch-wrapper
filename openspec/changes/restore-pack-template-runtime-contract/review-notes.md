# Restore Pack Template Runtime Contract Review Notes

## Spec Self-Review

Date: 2026-05-12

Issue #104 acceptance criteria coverage:

- `aco pack setup` local/dev path: covered by `Local and tarball setup do not depend on published npm fallback`.
- `aco run gemini review` prompt selection: covered by `Documented provider commands resolve concrete prompt templates`.
- `.claude/aco/tasks/*.md` or equivalent preset installation: covered by `Pack setup installs a complete runtime template surface` and `Ask presets resolve from installed task templates`.
- Codex/Gemini review/spec/plan/TDD command/preset naming: covered by `Ask presets resolve from installed task templates` and documentation requirements.
- stale build artifact or packaged tarball mismatch smoke: covered by `Package artifact parity is validated`.
- README/runbook/context-sync alignment: covered by `Documentation matches the tested runtime contract`.

Initial result: #104 acceptance criteria were covered at a high level, but multi-agent review found P1 design gaps that had to be closed before implementation.

## Canonical Naming Decision

- Canonical TDD preset: `tdd`
- Optional alias: not required for #104 unless implementation finds existing docs that already advertise `test-driven-development`.
- Rationale: `tdd` is short, stable, and matches command-style preset naming beside `review`, `spec-critique`, and `plan-critique`.

## Multi-Agent Spec Review

TDD/testing strategy review:

- Reviewer: Kepler (`tdd-guide`)
- Result: P1 findings accepted before implementation.
- Finding 1: tasks lacked an explicit RED execution gate after adding failing tests.
- Resolution: added task 2.9 to run targeted tests before implementation and record expected failure signatures.
- Finding 2: failing-test tasks missed force overwrite, missing preset, unknown-command fallback, and binary manual recovery scenarios.
- Resolution: added tasks 2.2, 2.4, 2.6, and expanded 2.7.
- Finding 3: package smoke command name and separation from live provider smoke were underspecified.
- Resolution: specified `npm run test:pack-runtime-contract --workspace=packages/wrapper` in design, spec, and tasks, and separated it from `npm run test:smoke`.

Architecture/system design review:

- Reviewer: Zeno (`architect`)
- Result: P1 findings accepted before implementation.
- Finding 1: binary installation contract left two possible default behaviors and open questions.
- Resolution: chose the non-mutating default for #104: verify existing binary, never auto-install the public npm package, report current artifact/manual recovery guidance, and keep global binary ownership outside uninstall scope.
- Finding 2: command/preset names lacked an authoritative contract table.
- Resolution: added provider command and preset tables to design/spec and added task 1.4.
- Finding 3: prompt resolution proof required a non-live provider strategy.
- Resolution: fixed internal prompt resolver testing as the non-live proof path and updated design/spec/tasks.

Security/runtime/TypeScript correctness review:

- Reviewer: Leibniz (`typescript-reviewer`)
- Result: P1 findings accepted before implementation.
- Finding 1: pack setup did not define sync failure/rollback semantics even though current implementation installs templates before sync.
- Resolution: added sync preflight before pack writes plus post-install recovery semantics to design/spec/tasks.
- Finding 2: binary placement still allowed implicit machine-wide mutation.
- Resolution: fixed default contract to no automatic install/link/replace/remove of global binaries; any future machine-wide operation is explicit opt-in and out of #104 scope.
- Finding 3: documented `review` command missing-template behavior was not fail-fast.
- Resolution: added fail-fast requirement and test task for documented `gemini review`/`codex review` missing prompt templates.
- Finding 4: package smoke allowed inspect-only false green.
- Resolution: strengthened `test:pack-runtime-contract` to install tarball into isolated prefix and execute tarball-installed `aco --version`, `aco pack setup`, and preset dry-runs.

## Plan Review

Implementation feasibility review:

- Reviewer: Peirce (`planner`)
- Result: P1 findings accepted before implementation.
- Finding 1: early tests assumed `pack setup --binary-name`, but the current CLI only supported `--binary-name` for `pack install`.
- Resolution: added `pack setup --binary-name` to design/spec/plan and implementation tasks.
- Finding 2: sync preflight could accidentally use `runSync({ check: true })` and block no-source or update-only drift cases.
- Resolution: narrowed preflight semantics to true manifest-owned target conflicts and added no-source/update-only continuation requirements.
- Finding 3: stale `dist` check could be hidden by running build before smoke.
- Resolution: package smoke must not build internally; it packs and executes the current `dist` artifact so stale runtime output fails before pilot-ready validation. Final green validation builds explicitly, then reruns the same smoke.

TypeScript/runtime plan review:

- Reviewer: Franklin (`typescript-reviewer`)
- Result: P1 findings accepted before implementation.
- Finding 1: `pack setup --binary-name` was not wired in the current CLI.
- Resolution: added explicit spec/task/plan requirement.
- Finding 2: `runSync({ check: true })` failure semantics were too broad for preflight.
- Resolution: added structured preflight requirement.
- Finding 3: tarball smoke did not verify packaged prompt resolver or `aco run`.
- Resolution: added fake-provider `aco run gemini review --input demo` to the package smoke contract.

Security/tech-debt plan review:

- Reviewer: Hegel (`reviewer`)
- Result: P1 findings accepted before implementation.
- Finding 1: importing a resolver from `cli.ts` would trigger CLI side effects.
- Resolution: changed design/plan/tests to use a side-effect-free `runtime/run-prompt-template.ts` module.
- Finding 2: binary verification was too weak if it only checked `aco --version` shape.
- Resolution: strengthened recovery messaging and isolated tarball provenance checks; full binary provenance remains verified by isolated prefix smoke.
- Finding 3: repo-local `.claude/aco/tasks` and `templates/tasks` could drift.
- Resolution: added package source-of-truth direction and will add parity checks in tests/docs.

## Code Review

- Manual runtime/security review result: no blocking findings after fixing preflight failure output to avoid raw stack traces.
- Code-review subagent `Aristotle` result: Needs work.
- Blocking finding: post-install `runSync()` failures only reported pack manifest recovery for conflict errors, leaving non-conflict filesystem/write failures with generic `Sync skipped` output after pack files may already have been installed.
- Resolution: added a regression test for post-install sync write failure, changed non-no-source post-install sync failures to print the pack manifest path plus `aco pack uninstall`, and exit non-zero.
- Follow-up finding: `aco pack status` only listed commands even though prompts and task presets are part of the runtime contract.
- Resolution: added prompt template and task preset summaries to `aco pack status` and covered them with a regression test.
- Follow-up finding: repo-local `.claude/aco/tasks` was missing the new `tdd` preset while `templates/tasks/tdd.md` existed.
- Resolution: added `.claude/aco/tasks/tdd.md` and a parity test that requires each packaged task preset name to exist in the repo-local task surface.
- Additional binary guidance follow-up: when `--binary-name` cannot be verified, setup no longer prints bare `aco provider setup ...`; provider setup commands are shown only after the requested binary is verified.
- Code-review subagent `Sartre` result: Needs work.
- Blocking finding: post-install sync recovery still hard-coded `aco pack uninstall`, so `--global`, `--binary-name`, and npx/node entrypoints could receive the wrong cleanup instruction.
- Resolution: recovery output now reports the pack manifest, instructs users to run `pack uninstall` through the same entrypoint used for setup, includes `--global` when needed, and prints a verified binary shortcut only when the requested binary was verified.
- Blocking finding: the repo-local task parity test only checked filenames, so content drift between `.claude/aco/tasks` and `templates/tasks` could pass.
- Resolution: parity test now compares the task preset file set in both directions and compares normalized Markdown content.
- Follow-up finding: `pack status` test only checked representative entries.
- Resolution: status test now derives expected command, prompt, and task entries from the packaged `templates/**` tree and verifies every installed entry appears in output.

## Simplification Pass

- Applied: moved prompt template resolution to a small side-effect-free module, kept binary recovery text in one exported helper, reused `resolveTargetBase()`, removed a nested ternary from the new CLI test helper, and kept package smoke cleanup explicit.
- No broad refactor was performed.

## Validation Ledger

RED gate:

- Command: `node --require tsx/cjs --test tests/pack-runtime-contract.test.ts` from `packages/wrapper`
- Date: 2026-05-12
- Result: expected RED, 0 pass / 9 fail.
- Failure signatures:
  - missing packaged `templates/prompts/gemini/review.md` and `templates/prompts/codex/review.md`
  - packaged task presets not installed, so `aco ask --preset review --dry-run` reports `Preset not found: review`
  - `src/runtime/run-prompt-template.js` module missing for side-effect-free prompt resolution
  - `describeBinaryRecovery` missing and existing binary path still attempts `npm install -g @pureliture/ai-cli-orch-wrapper`
  - `aco pack setup --binary-name aco-test-local` does not pass the override through
  - sync preflight does not stop fatal conflicts before template writes
  - no-source setup continues, but task preset install still fails because `templates/tasks` is missing

Stale artifact proof:

- Command: `npm run test:pack-runtime-contract --workspace=packages/wrapper` before build
- Result: expected failure, `missing packed file: dist/cli.js`
- Purpose: confirmed the package smoke does not hide stale or absent `dist` by building internally.

GREEN validation:

- Follow-up RED command: `node --require tsx/cjs --test tests/pack-runtime-contract.test.ts` from `packages/wrapper`
- Follow-up RED result: expected failure, 9 pass / 4 fail.
- Follow-up RED failure signatures:
  - `pack status` missing `Prompt templates:` and `Task presets:`
  - `.claude/aco/tasks/tdd.md` missing while `templates/tasks/tdd.md` exists
  - binary-missing setup path still printed bare `aco provider setup ...`
  - post-install sync failure exited 0 and lacked pack uninstall recovery guidance
- Follow-up GREEN command: `node --require tsx/cjs --test tests/pack-runtime-contract.test.ts` from `packages/wrapper`
- Follow-up GREEN result: pass, 13 tests.
- Second follow-up RED command: `node --require tsx/cjs --test tests/pack-runtime-contract.test.ts` from `packages/wrapper`
- Second follow-up RED result: expected failure, 12 pass / 3 fail.
- Second follow-up RED failure signatures:
  - recovery output did not mention the same setup entrypoint
  - `--global --binary-name aco-test-local` recovery still printed `aco pack uninstall`
  - unverified binary recovery still printed `aco pack uninstall`
- Second follow-up GREEN command: `node --require tsx/cjs --test tests/pack-runtime-contract.test.ts` from `packages/wrapper`
- Second follow-up GREEN result: pass, 15 tests.
- `npm run typecheck` — pass
- `npm test` — pass, 216 tests
- `npm run build --workspace=packages/wrapper` — pass
- `npm run test:pack-runtime-contract --workspace=packages/wrapper` — pass
- `npm run test:smoke` — pass, 10 checks
- `npx openspec validate restore-pack-template-runtime-contract --type change --strict` — pass
- `git diff --check` — pass
- Live Codex/Gemini provider smoke was not run; it remains opt-in per the runbook and spec.
