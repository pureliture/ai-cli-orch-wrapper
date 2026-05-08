# Goal 2 Review Ledger

## Review model

Goal 2 used a multi-perspective review before finalization:

- Architecture/system design: checked consent-gated delegation layering, `aco ask` vs `aco run`, artifact boundaries, and documentation truthfulness.
- TypeScript/testing quality: checked CLI behavior, output-mode boundaries, raw input tests, and hidden regressions.
- Security/consent/token-saving: checked provider invocation gates, `doctor` side effects, secret-handling claims, and summary overclaim risk.

No real Codex/Gemini provider smoke was attempted. The review intentionally stayed mock/local-only to avoid token/credential use.

## Blocking findings and resolution

### P1: brief summaries were described as safer than implemented

- Finding: Some artifact wording implied `brief.md` was safe to paste into Claude Code by default.
- Risk: `brief` is bounded but not redacted. Provider output can echo sensitive user input or secrets.
- Resolution: Updated artifact docs to say `brief.md` is smaller than full output but still must be inspected before sharing. Security docs keep the no-secret-scanning/no-redaction caveat.
- Evidence: `docs/reference/session-artifacts.md`, `docs/security.md`, `packages/wrapper/tests/ask-cli.test.ts`.

### P1: `aco doctor` could not have hidden provider execution or cache writes

- Finding: The first doctor implementation reused provider auth checks, which could execute provider CLIs or write auth cache files.
- Risk: This contradicted the `doctor` v1 contract: local-only, non-network, no real provider invocation, no secret printing.
- Resolution: Replaced auth probes with local readiness heuristics for `mock`, `codex`, and `gemini`. `doctor` now checks PATH presence and local credential file/API-key hints without invoking provider binaries or writing `~/.aco/provider-auth-cache.json`.
- Evidence: `packages/wrapper/src/commands/doctor.ts`, `packages/wrapper/tests/doctor-cli.test.ts`.

### P1: `aco ask` and `aco run` provider execution paths could drift

- Finding: `aco ask` and `aco run` originally each owned their provider invocation loop.
- Risk: Provider invocation, session output capture, and PID recording could diverge while docs describe `ask` as a high-level layer over the same provider execution contract.
- Resolution: Added a shared `invokeProviderForSession()` helper. `aco ask` still owns consent/run-ledger/output-mode policy, and `aco run` still owns low-level runtime dashboard/auth behavior, but both now share provider invocation, output writing, and PID capture.
- Evidence: `packages/wrapper/src/runtime/provider-session-runner.ts`, `packages/wrapper/src/commands/ask.ts`, `packages/wrapper/src/cli.ts`, `docs/architecture.md`.

### P1: brief summary truncation cut valid provider content at `Findings:` headings

- Finding: The first bounded summary implementation split mock output at the first `Findings:` marker, which could drop valid content if user input or real provider output contained that heading.
- Risk: `brief` could be misleading even within the configured bound.
- Resolution: The mock-specific `Findings:` stripping now applies only to the last mock provider marker. Real provider output is bounded from the beginning without heading-based stripping.
- Evidence: `packages/wrapper/src/commands/ask.ts`, `packages/wrapper/tests/ask-cli.test.ts`.

## Non-blocking follow-ups

- P2: `docs/case-study.md` and `docs/README.md` needed clearer current-vs-historical plan routing. Updated to point current Goal 2 evidence at `docs/plans/consent-gated-delegation-hardening/` and keep `pr-implementation-plan.md` historical.
- P3: `aco doctor` v1 intentionally checks the known provider set `mock`, `codex`, and `gemini`. A future provider registry status API can make this fully dynamic.
- P3: Structured `findings.json`, `.acoignore` enforcement, secret scanning/redaction, and multi-provider aggregation remain future work.

## Final review status

- P0: none found.
- P1: resolved in this branch.
- P2/P3: documented as non-blocking follow-ups where outside Goal 2 scope.
