# Consent-Gated Delegation MVP Validation

작성일: 2026-05-08

## Baseline

| Command       | Result | Notes                                                                                            |
| ------------- | ------ | ------------------------------------------------------------------------------------------------ |
| `npm install` | PASS   | Added workspace dependencies in the dedicated worktree.                                          |
| `npm test`    | FAIL   | Pre-MVP baseline failed in `Auth cache > reuses provider auth result within TTL` with `2 !== 1`. |

## Targeted TDD Runs

| Command                                                                                            | Result | Notes                                                                                     |
| -------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| `npm test --workspace=packages/wrapper -- tests/providers.test.ts`                                 | PASS   | `mock` provider registration/deterministic output plus auth-cache baseline fix validated. |
| `npm test --workspace=packages/wrapper -- tests/ask-cli.test.ts`                                   | PASS   | Node test filter in this workspace still runs the configured package test file list.      |
| `node --require tsx/cjs --test packages/wrapper/tests/ask-cli.test.ts`                             | PASS   | Targeted source CLI behavior: dry-run, consent gate, artifacts, output modes, validation. |
| `cmp .claude/commands/aco.md templates/commands/aco.md`                                            | PASS   | Generic `/aco` command and packaged template are byte-for-byte aligned.                   |
| `npx prettier --check packages/wrapper/src/commands/ask.ts packages/wrapper/tests/ask-cli.test.ts` | PASS   | Formatting check for the new TypeScript implementation and tests.                         |

## Final Required Checks

| Command              | Result | Notes                                                                                             |
| -------------------- | ------ | ------------------------------------------------------------------------------------------------- |
| `npm run build`      | PASS   | `tsc` completed for `packages/wrapper`.                                                           |
| `npm test`           | PASS   | `test:scripts` passed; wrapper suite reported 170 tests, 29 suites, 170 pass, 0 fail.             |
| `npm run typecheck`  | PASS   | `tsc --noEmit` completed for `packages/wrapper`.                                                  |
| `npm run test:smoke` | PASS   | Initial sandbox run hit `tsx` IPC `listen EPERM`; rerun with approval passed: 6 passed, 0 failed. |
| `git diff --check`   | PASS   | No whitespace errors.                                                                             |

## Formatting / Parity Checks

| Command                                                 | Result | Notes                                                                                      |
| ------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| `npm run format:check`                                  | PASS   | Existing repo script checks `packages/*/src/**/*.ts`.                                      |
| `cmp .claude/commands/aco.md templates/commands/aco.md` | PASS   | Generic `/aco` command and packaged template are aligned.                                  |
| `npx prettier --check ...`                              | PASS   | Checked README, runbook, plan docs, new command/skill/presets, ask command, and ask tests. |

## `/docs` Documentation And Visual Review

| Artifact                                | Result  | Notes                                                                                                        |
| --------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------ |
| `docs/README.md`                        | UPDATED | Added canonical thesis, `aco ask`, consent gate, token-saving default, artifacts, mock demo.                 |
| `docs/architecture.md`                  | UPDATED | Describes `aco ask` as the high-level delegation layer and `aco run` as low-level primitive.                 |
| `docs/images/architecture-overview.svg` | UPDATED | Shows `/aco`, `aco ask`, default `mock`, explicit Codex/Gemini providers, and run/session artifacts.         |
| `docs/images/session-lifecycle.svg`     | UPDATED | Retitled to `aco ask` MVP lifecycle and shows dry-run, `--yes`, advisory provider invoke, and bounded brief. |
| `docs/images/context-sync.svg`          | UPDATED | Shows `.claude/commands/aco.md` and `.claude/aco/tasks/` as source-side surfaces.                            |
| `docs/images/repository-structure.svg`  | UPDATED | Shows `ask/run/sync/pack`, `commands/aco.md`, `aco-delegation`, and task presets.                            |
| `docs/images/ci-pipeline.svg`           | UPDATED | Smoke gate now reflects ask mock dry-run/brief/result coverage.                                              |

Validation after `/docs` update:

| Command                                                            | Result | Notes                                                   |
| ------------------------------------------------------------------ | ------ | ------------------------------------------------------- |
| `npx prettier --check docs/README.md docs/architecture.md ...`     | PASS   | Markdown docs and validation ledger use Prettier style. |
| `xmllint --noout docs/images/*.svg`                                | PASS   | All visual materials are well-formed XML/SVG.           |
| `find .claude/commands -maxdepth 1 -type f -name 'aco*.md' -print` | PASS   | Only `.claude/commands/aco.md` exists.                  |
| `git diff --check`                                                 | PASS   | No whitespace errors after documentation updates.       |

## Final Demo

```bash
node packages/wrapper/dist/cli.js ask --providers mock --task "review this demo input" --input "demo" --dry-run
node packages/wrapper/dist/cli.js ask --providers mock --task "review this demo input" --input "demo" --yes --output-mode brief
node packages/wrapper/dist/cli.js result
```

Result: PASS with isolated `HOME=/private/tmp/aco-demo-home-vx9Iqp`.

Dry-run output confirmed:

- provider execution is skipped
- provider list is `mock`
- permission profile is `restricted`
- output mode is `brief`
- input size is reported without creating sessions

Brief execution output confirmed:

- run id is printed
- provider session reached `done`
- full output path is saved under `~/.aco/sessions/<session-id>/output.log`
- stdout contains bounded brief metadata, not the full `Findings:` section

`aco result` output confirmed:

- full deterministic mock provider output is retrievable from the latest session
- output includes task prompt, input, and mock advisory findings

## Known Limitations

- MVP does not implement production `aco doctor`, full hardening, advanced aggregation, `findings.json`, `.acoignore`, or npm release work.
- `restricted` uses provider flags/prompt constraints available today; it is not a complete OS-level read-only sandbox for every provider.
- Explicit multi-provider `aco ask` creates one session per provider and records all sessions in the run ledger. Existing `aco result` remains session-oriented and reads the latest session unless `--session` is supplied.
- `--input-file` is explicit user-selected input. MVP does not scan for secrets or sensitive paths.
- `--output-mode full` is available only when explicitly requested and can still print large output into Claude Code.
- `aco ask` does not implicitly read stdin; callers must use `--input` or `--input-file`.
