# Consent-Gated Delegation Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development` for behavior changes and `superpowers:requesting-code-review` before finalization. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize PR #92 into an open-source quality consent-gated external AI delegation wrapper for Claude Code.

**Architecture:** `aco ask` remains the high-level consent-gated orchestration command. `aco doctor` is added as a local-only read/check command. Full provider output stays in artifacts; stdout defaults to bounded brief summaries.

**Tech Stack:** TypeScript, Node `node:test`, npm workspaces, existing provider registry/session store, Markdown docs, SVG diagrams.

---

## Files Planned

Code:

- Modify `packages/wrapper/src/commands/ask.ts` for formatting, raw input preservation, bounded summaries, and artifact metadata.
- Create `packages/wrapper/src/commands/doctor.ts` for local health checks.
- Modify `packages/wrapper/src/cli.ts` to wire `aco doctor`.
- Modify `packages/wrapper/src/providers/mock.ts` only if deterministic long output is needed for summary-boundary tests.

Tests:

- Modify `packages/wrapper/tests/ask-cli.test.ts` for raw input and output-mode boundary tests.
- Create `packages/wrapper/tests/doctor-cli.test.ts` for `aco doctor`.
- Modify `packages/wrapper/tests/smoke.ts` for no-auth mock demo smoke coverage.
- Modify `packages/wrapper/package.json` test script to include doctor tests.

Docs and assets:

- Add `docs/reference/session-artifacts.md`.
- Add `docs/security.md`.
- Add `.acoignore.example`.
- Update `README.md`, `docs/README.md`, `docs/architecture.md`, `docs/guides/runbook.md`, `docs/reference/context-sync.md`, `docs/case-study.md`, `package.json`, `packages/wrapper/package.json`.
- Update required `docs/images/*.svg`.
- Maintain `docs/plans/consent-gated-delegation-hardening/*.md`.

## Tasks

- [ ] Baseline: fix `ask.ts` Prettier formatting and re-run `npm run format:check`.
- [ ] RED: add tests for raw input preservation in `ask-cli.test.ts`.
- [ ] GREEN: remove `.trim()` from `collectInput()` and preserve deterministic joins.
- [ ] RED: add tests for bounded brief summary, save-only exclusion, and full inclusion.
- [ ] GREEN: add bounded summary helper and store summaries in session/run briefs and ledger.
- [ ] RED: add `doctor-cli.test.ts` covering local checks with temp `HOME`, temp repo, and mock provider expectations.
- [ ] GREEN: implement `packages/wrapper/src/commands/doctor.ts` and CLI wiring.
- [ ] Add/adjust smoke tests for mock no-auth demo commands.
- [ ] Add artifact and security docs without overclaiming unimplemented enforcement.
- [ ] Refresh README, docs index, architecture, runbook, context-sync, case study, and package metadata.
- [ ] Refresh SVGs and validate XML.
- [ ] Run focused tests after each behavior slice.
- [ ] Run full required validation suite.
- [ ] Perform 3+ perspective review and record findings in `03-review.md`.
- [ ] Finalize validation and release checklist docs.
- [ ] Stage only relevant files and create focused commit.

## Validation Commands

Focused:

```bash
npm run format:check
node --require tsx/cjs --test packages/wrapper/tests/ask-cli.test.ts
node --require tsx/cjs --test packages/wrapper/tests/doctor-cli.test.ts
npm run test:smoke
```

Full:

```bash
npm run build
npm test
npm run typecheck
npm run test:smoke
npm run format:check
git diff --check
xmllint --noout docs/images/*.svg
```

Demo:

```bash
node packages/wrapper/dist/cli.js ask --providers mock --task "review this demo input" --input "demo" --dry-run
node packages/wrapper/dist/cli.js ask --providers mock --task "review this demo input" --input "demo" --yes --output-mode brief
node packages/wrapper/dist/cli.js result
node packages/wrapper/dist/cli.js doctor
```

## Commit Scope

Commit only Goal 2 code, tests, docs, diagrams, metadata, and hardening plan files. Do not include `~/.aco` artifacts, credential files, editor state, or unrelated generated files.
