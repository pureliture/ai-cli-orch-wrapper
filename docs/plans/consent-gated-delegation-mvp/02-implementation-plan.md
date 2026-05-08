# Consent-Gated Delegation MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the MVP `aco ask` high-level orchestration layer with consent gating, bounded output, deterministic `mock` provider, artifacts, and one generic Claude Code slash command.

**Architecture:** Keep `aco run` as the existing low-level provider primitive. Add `aco ask` as a small command module imported by `packages/wrapper/src/cli.ts`; reuse `ProviderRegistry` and `SessionStore`, but avoid `createOutputTee` so full provider output is saved without being streamed to Claude Code by default.

**Tech Stack:** Node.js >= 18, TypeScript CommonJS build, Node `node:test`, existing npm workspace scripts.

---

## Files

- Modify: `packages/wrapper/src/cli.ts`
- Create: `packages/wrapper/src/commands/ask.ts`
- Create: `packages/wrapper/src/providers/mock.ts`
- Modify: `packages/wrapper/src/providers/registry.ts`
- Modify: `packages/wrapper/src/providers/auth-cache.ts`
- Modify: `packages/wrapper/src/index.ts`
- Modify: `packages/wrapper/tests/providers.test.ts`
- Create: `packages/wrapper/tests/ask-cli.test.ts`
- Modify: `packages/wrapper/tests/smoke.ts`
- Modify: `packages/wrapper/package.json`
- Create: `.claude/skills/aco-delegation/SKILL.md`
- Create: `.claude/commands/aco.md`
- Create: `templates/commands/aco.md`
- Create: `.claude/aco/tasks/default.md`
- Create: `.claude/aco/tasks/review.md`
- Create: `.claude/aco/tasks/spec-critique.md`
- Create: `.claude/aco/tasks/plan-critique.md`
- Create: `.claude/aco/tasks/code-simplify.md`
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/guides/runbook.md`
- Review/update: `docs/images/*.svg`
- Maintain: `docs/plans/consent-gated-delegation-mvp/00-goal-ledger.md`
- Maintain: `docs/plans/consent-gated-delegation-mvp/04-validation.md`

## Task 0: Baseline Auth Cache Test Unblocker

**Files:**

- Modify: `packages/wrapper/src/providers/auth-cache.ts`
- Existing test: `packages/wrapper/tests/providers.test.ts`

- [ ] **Step 1: Verify RED**

Run:

```bash
npm test --workspace=packages/wrapper -- tests/providers.test.ts
```

Expected before fix: `Auth cache > reuses provider auth result within TTL` fails with `2 !== 1`.

- [ ] **Step 2: Write minimal implementation**

Move cache path resolution from module import time to call time so tests that set `HOME` before calling `getCachedProviderAuth()` use the isolated temp home:

```ts
function cachePath(): string {
  return resolve(homedir(), '.aco', 'provider-auth-cache.json');
}
```

Then pass `cachePath()` into read/write helpers.

- [ ] **Step 3: Verify GREEN**

Run:

```bash
npm test --workspace=packages/wrapper -- tests/providers.test.ts
```

Expected: provider tests pass, including auth cache.

**Compatibility notes:** This changes only when the cache path is evaluated; runtime behavior remains `~/.aco/provider-auth-cache.json` for normal processes.

## Task 1: Mock Provider Registration And Deterministic Output

**Files:**

- Create: `packages/wrapper/src/providers/mock.ts`
- Modify: `packages/wrapper/src/providers/registry.ts`
- Modify: `packages/wrapper/src/index.ts`
- Test: `packages/wrapper/tests/providers.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests that assert:

```ts
const registry = new ProviderRegistry();
assert.equal(registry.get('mock')?.key, 'mock');
assert.ok(registry.keys().includes('mock'));
```

Add a direct provider test that consumes `MockProvider.invoke('ask', 'Task prompt', 'demo')` and asserts output contains `Provider: mock`, `Mode: deterministic demo`, and the input text.

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test --workspace=packages/wrapper -- tests/providers.test.ts
```

Expected: tests fail because `MockProvider` and registry registration do not exist.

- [ ] **Step 3: Implement minimal provider**

Implement `MockProvider` with `isAvailable() === true`, `checkAuth()` returning ok, deterministic `buildArgs()`, and async generator `invoke()`.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm test --workspace=packages/wrapper -- tests/providers.test.ts
```

Expected: tests pass.

## Task 2: `aco ask --dry-run`

**Files:**

- Create: `packages/wrapper/src/commands/ask.ts`
- Modify: `packages/wrapper/src/cli.ts`
- Create: `packages/wrapper/tests/ask-cli.test.ts`
- Modify: `packages/wrapper/package.json`

- [ ] **Step 1: Write failing CLI test**

Test command:

```bash
node --require tsx/cjs src/cli.ts ask --providers mock --task "review this demo input" --input "demo" --dry-run
```

Assertions:

- exit code `0`
- stdout includes `Dry run`
- stdout includes `Providers: mock`
- no `~/.aco/sessions` directory is created in the test temp home.

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test --workspace=packages/wrapper -- tests/ask-cli.test.ts
```

Expected: fails because `aco ask` is unknown.

- [ ] **Step 3: Implement minimal dry-run path**

Add `case 'ask'` to `cli.ts` and implement option parsing/validation in `commands/ask.ts`.

- [ ] **Step 4: Verify GREEN**

Run the same targeted test command. Expected: pass.

## Task 3: Consent Gate

**Files:**

- Modify: `packages/wrapper/src/commands/ask.ts`
- Test: `packages/wrapper/tests/ask-cli.test.ts`

- [ ] **Step 1: Write failing test**

Run `aco ask --providers mock --task "review this demo input" --input "demo"` without `--yes` and without `--dry-run`.

Assertions:

- non-zero exit
- output includes `Consent required`
- no session directory is created.

- [ ] **Step 2: Verify RED**

Expected: fails until consent gate exists.

- [ ] **Step 3: Implement consent gate**

If neither `--yes` nor `--dry-run` is present, print consent guidance and exit non-zero before provider auth/session/invoke.

- [ ] **Step 4: Verify GREEN**

Run targeted ask CLI tests.

## Task 4: `aco ask --yes` With Brief Output And Artifacts

**Files:**

- Modify: `packages/wrapper/src/commands/ask.ts`
- Test: `packages/wrapper/tests/ask-cli.test.ts`

- [ ] **Step 1: Write failing test**

Run:

```bash
node --require tsx/cjs src/cli.ts ask --providers mock --task "review this demo input" --input "demo" --yes --output-mode brief
```

Assertions:

- exit code `0`
- stdout includes `Run:`
- stdout includes `Session:`
- stdout includes `Full output saved`
- stdout does not include raw `Findings:`
- latest session `task.json` has `provider: "mock"`, `command: "ask"`, `permissionProfile: "restricted"`, `status: "done"`
- session `output.log`, `input.md`, `prompt.md`, `brief.md` exist
- run `ledger.json` and run `brief.md` exist.

- [ ] **Step 2: Verify RED**

Expected: fails until execution/artifact path exists.

- [ ] **Step 3: Implement execution and artifact writing**

Invoke providers sequentially, collect output, write full output to `output.log`, write session artifacts, write run ledger/brief, and print bounded brief only.

- [ ] **Step 4: Verify GREEN**

Run targeted ask CLI tests.

## Task 5: Output Modes

**Files:**

- Modify: `packages/wrapper/src/commands/ask.ts`
- Test: `packages/wrapper/tests/ask-cli.test.ts`

- [ ] **Step 1: Write failing tests**

Add:

- `--output-mode save-only` prints save location but no `Brief` and no raw `Findings:`.
- `--output-mode full` prints raw `Findings:` because full was explicit.

- [ ] **Step 2: Verify RED**

Expected: fails until output mode handling is complete.

- [ ] **Step 3: Implement output mode branching**

Use `brief` default, `save-only` metadata-only, and `full` explicit raw output.

- [ ] **Step 4: Verify GREEN**

Run targeted ask CLI tests.

## Task 6: Presets, Input File, And Safe Defaults

**Files:**

- Modify: `packages/wrapper/src/commands/ask.ts`
- Create: `.claude/aco/tasks/*.md`
- Test: `packages/wrapper/tests/ask-cli.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests for:

- `--preset review` loads `.claude/aco/tasks/review.md`.
- `--input-file demo.md` includes file content in session `input.md`.
- invalid `--permission-profile` exits non-zero.
- invalid `--output-mode` exits non-zero.

- [ ] **Step 2: Verify RED**

Expected: fails until preset/input-file handling exists.

- [ ] **Step 3: Implement minimal preset/input-file support**

Read cwd preset first, then home preset. Combine explicit `--input` and `--input-file` content in a stable order. Do not implicitly wait on stdin in the MVP path.

- [ ] **Step 4: Verify GREEN**

Run targeted ask CLI tests.

## Task 7: Claude Command, Skill, README, `/docs`, Runbook

**Files:**

- Create: `.claude/skills/aco-delegation/SKILL.md`
- Create: `.claude/commands/aco.md`
- Create: `templates/commands/aco.md`
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/guides/runbook.md`
- Review/update: `docs/images/*.svg`

- [ ] **Step 1: Write docs/surface changes**

Add one generic `/aco` command. Add no `/aco:*` variants.

- [ ] **Step 2: Validate command count**

Run:

```bash
find .claude/commands -maxdepth 1 -type f -name 'aco*.md' -print
```

Expected: only `.claude/commands/aco.md`.

- [ ] **Step 3: Update README surfaces**

Update both:

- root `README.md`
- `/docs/README.md`

Both README surfaces must mention the canonical thesis, `aco ask`, consent gate, default `restricted` permission profile, default bounded `brief` output, full-output artifacts, `aco result`, and no-auth `mock` demo.

- [ ] **Step 4: Update runbook**

Update `docs/guides/runbook.md` with copy-pastable MVP demo commands:

```bash
node packages/wrapper/dist/cli.js ask --providers mock --task "review this demo input" --input "demo" --dry-run
node packages/wrapper/dist/cli.js ask --providers mock --task "review this demo input" --input "demo" --yes --output-mode brief
node packages/wrapper/dist/cli.js result
```

- [ ] **Step 5: Review and update visual materials**

Inspect every existing visual under `docs/images/*.svg`:

- `docs/images/architecture-overview.svg`
- `docs/images/ci-pipeline.svg`
- `docs/images/context-sync.svg`
- `docs/images/repository-structure.svg`
- `docs/images/session-lifecycle.svg`

Update any diagram whose current model would become stale after `aco ask`. At minimum, the affected visual set should be checked for:

- `aco ask` as the high-level consent-gated delegation layer
- `aco run` remaining the low-level provider primitive
- external providers being advisory
- default `mock` no-auth demo path
- run/session artifact split under `~/.aco/runs/<run-id>/` and `~/.aco/sessions/<session-id>/`
- no `/aco:*` slash command explosion

If a visual is not impacted, record that explicit no-change decision in `04-validation.md` so the diagram review is auditable.

- [ ] **Step 6: Validate docs formatting and stale-reference checks**

Run:

```bash
npx prettier --check README.md docs/README.md docs/guides/runbook.md .claude/commands/aco.md templates/commands/aco.md .claude/skills/aco-delegation/SKILL.md
rg "aco ask|consent|mock|artifact" README.md docs/README.md docs/guides/runbook.md docs/images
rg "/aco:" README.md docs .claude/commands templates/commands
```

Expected:

- README/runbook docs mention the MVP flow.
- Visual materials are either updated or explicitly recorded as not impacted.
- No new task-specific `/aco:*` slash command surface is introduced.

## Task 8: Smoke And Final Validation

**Files:**

- Modify: `packages/wrapper/tests/smoke.ts`
- Maintain: `docs/plans/consent-gated-delegation-mvp/04-validation.md`

- [ ] **Step 1: Add smoke coverage**

Smoke must check `mock` is registered. It should not require Codex/Gemini credentials.

- [ ] **Step 2: Run validation**

Run:

```bash
npm run build
npm test
npm run typecheck
npm run test:smoke
git diff --check
```

Final demo:

```bash
node packages/wrapper/dist/cli.js ask --providers mock --task "review this demo input" --input "demo" --dry-run
node packages/wrapper/dist/cli.js ask --providers mock --task "review this demo input" --input "demo" --yes --output-mode brief
node packages/wrapper/dist/cli.js result
```

- [ ] **Step 3: Record results**

Write exact pass/fail status and known limitations into `04-validation.md`.

## Compatibility Notes

- `aco run` keeps its existing default permission profile and streaming behavior.
- `aco ask` intentionally avoids streaming full output by default.
- `aco result` remains output-log based and works for both `run` and `ask` sessions.
- `mock` provider registration changes `ProviderRegistry.keys()` length; tests must assert membership, not exact length.
