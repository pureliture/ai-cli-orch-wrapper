# Goal 2 Validation Ledger

## Environment

- Date: 2026-05-08
- Branch: `codex/92-consent-delegation-hardening`
- Base: stacked from PR #92 head `codex/consent-gated-delegation-mvp`
- Real providers: not invoked
- Smoke provider: `mock` only

## Commands run

| Command                                                                                                          | Result                 | Notes                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx prettier --write ...`                                                                                       | PASS                   | Applied/confirmed formatting for changed TS/MD files.                                                                                             |
| `node --require tsx/cjs --test packages/wrapper/tests/ask-cli.test.ts packages/wrapper/tests/doctor-cli.test.ts` | PASS                   | 19 tests, 2 suites.                                                                                                                               |
| `node --require tsx/cjs --test packages/wrapper/tests/session.test.ts packages/wrapper/tests/providers.test.ts`  | PASS                   | 54 tests, 9 suites.                                                                                                                               |
| `npm run build`                                                                                                  | PASS                   | TypeScript build for wrapper package.                                                                                                             |
| `npm test`                                                                                                       | PASS                   | 179 tests, 30 suites, plus project ID script tests.                                                                                               |
| `npm run typecheck`                                                                                              | PASS                   | `tsc --noEmit`.                                                                                                                                   |
| `npm run format:check`                                                                                           | PASS                   | Prettier check for package TS files.                                                                                                              |
| `git diff --check`                                                                                               | PASS                   | No whitespace errors.                                                                                                                             |
| `xmllint --noout docs/images/*.svg`                                                                              | PASS                   | SVG XML validation passed.                                                                                                                        |
| `npm run test:smoke`                                                                                             | PASS with sandbox note | First sandbox run failed with `listen EPERM` for `tsx` IPC pipe. Re-ran the same command once with approval outside sandbox: 10 passed, 0 failed. |
| Built `dist` mock demo boundary script                                                                           | PASS                   | Temp `HOME`; mock only; verified dry-run, consent gate, brief/save-only/full/result/doctor behavior.                                              |

## Behavioral checks

- `aco ask` without `--yes` exits before provider execution with a consent-required message.
- `aco ask --dry-run` prints the plan and creates no provider session in temp `HOME`.
- `aco ask --output-mode brief` prints a bounded `Summary:` and does not dump mock `Findings:`.
- `aco ask --output-mode save-only` prints save locations only, with no summary/body.
- `aco ask --output-mode full` prints full provider output only when explicitly selected.
- `aco result` reads the latest saved mock output.
- `aco doctor` reports local diagnostics without invoking provider binaries or writing provider auth cache.
- Raw `--input` and `--input-file` content preserve leading whitespace, trailing newlines, and deterministic combined ordering.
- `docs/images/*.svg` are XML-valid.

## Known validation boundaries

- No real Codex/Gemini provider smoke was run. This was intentionally avoided to preserve the no-credit/no-token constraint.
- `aco doctor` uses local readiness heuristics only; it does not verify remote auth or provider account state.
- `brief` is bounded but not redacted. Users must inspect artifacts before sharing if input/output may contain secrets.
