# Restore Pack Template Runtime Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `aco pack setup`, packaged templates, `aco run <provider> review`, `aco ask --preset`, local/tarball setup, and docs agree on one tested runtime contract for issue #104.

**Architecture:** Keep `templates/` as the package runtime asset root. Extend pack setup to install task presets beside existing commands/prompts, keep `aco run` low-level fallback compatibility, and prefer current package/local executable evidence over automatic public npm fallback. Validate the contract with targeted unit/integration tests plus a tarball asset smoke that does not invoke live providers.

**Tech Stack:** TypeScript, Node.js test runner, `tsx`, npm workspaces, OpenSpec, Markdown docs.

---

## File Map

- Modify `packages/wrapper/src/commands/pack-install.ts`: structured sync preflight before pack writes; copy `templates/tasks` to `.claude/aco/tasks`; keep manifest/skip/force semantics; avoid automatic public npm install fallback for local/dev setup; support `pack setup --binary-name`.
- Modify `packages/wrapper/src/runtime/run-prompt-template.ts`: side-effect-free prompt-template resolver with documented-command fail-fast and unknown-command fallback.
- Modify `packages/wrapper/src/cli.ts`: use the prompt resolver and parse/pass `--binary-name` for `pack setup`.
- Add `packages/wrapper/tests/pack-runtime-contract.test.ts`: targeted failing-first tests for pack setup assets, preset resolution after setup, prompt template resolution, and binary fallback behavior.
- Add `packages/wrapper/tests/pack-runtime-contract-smoke.ts`: package/tarball parity smoke that installs the tarball into isolated `HOME`/`PATH`/npm prefix and runs the tarball-installed `aco` with fake provider binaries, without live providers.
- Modify `packages/wrapper/package.json`: include new tests in `test` and expose a named package smoke script.
- Add `templates/tasks/*.md`: package source for review, spec critique, plan critique, code simplification, default advisory, and canonical TDD preset.
- Add `templates/prompts/gemini/review.md` and `templates/prompts/codex/review.md`: documented command prompt templates.
- Modify `README.md`, `packages/wrapper/README.md`, `docs/guides/runbook.md`, `docs/reference/context-sync.md`: align setup paths, command names, preset names, and verification language.
- Add `openspec/changes/restore-pack-template-runtime-contract/review-notes.md`: spec/plan/code review notes and final validation ledger.

## Canonical Names

- Provider command: `review`
- Provider prompt files: `.claude/aco/prompts/gemini/review.md`, `.claude/aco/prompts/codex/review.md`
- Presets: `review`, `spec-critique`, `plan-critique`, `tdd`, `code-simplify`, `default`
- TDD canonical preset: `tdd`
- TDD alias: none for #104. Docs must advertise `tdd` only.

## Task 1: Spec Gate and Review Notes

**Files:**
- Create: `openspec/changes/restore-pack-template-runtime-contract/review-notes.md`
- Modify: `openspec/changes/restore-pack-template-runtime-contract/tasks.md`

- [ ] **Step 1: Record self-review against #104**

Create `review-notes.md` with sections for spec coverage, review findings, plan review, code review, simplification, and validation ledger. Record that the OpenSpec proposal/design/spec/tasks cover every #104 acceptance criterion.

- [ ] **Step 2: Record multi-agent spec review results**

Add architecture/system-design, TDD/testing, and security/runtime review outcomes. Any P0/P1 finding must update OpenSpec artifacts before implementation.

- [ ] **Step 3: Mark tasks 1.1, 1.2, and 1.3 complete only after review notes exist**

Run: `openspec validate restore-pack-template-runtime-contract --type change --strict`

Expected: `Change 'restore-pack-template-runtime-contract' is valid`.

## Task 2: Failing Tests for Pack Assets and Runtime Names

**Files:**
- Create: `packages/wrapper/tests/pack-runtime-contract.test.ts`
- Modify: `packages/wrapper/package.json`

- [ ] **Step 1: Add failing pack setup asset test**

Write a test that runs `aco pack setup --binary-name aco-test-local` in a temp workspace and asserts:

```typescript
await stat(join(workspace, '.claude', 'commands', 'aco.md'));
await stat(join(workspace, '.claude', 'aco', 'prompts', 'gemini', 'review.md'));
await stat(join(workspace, '.claude', 'aco', 'prompts', 'codex', 'review.md'));
await stat(join(workspace, '.claude', 'aco', 'tasks', 'review.md'));
await stat(join(workspace, '.claude', 'aco', 'tasks', 'spec-critique.md'));
await stat(join(workspace, '.claude', 'aco', 'tasks', 'plan-critique.md'));
await stat(join(workspace, '.claude', 'aco', 'tasks', 'tdd.md'));
```

- [ ] **Step 2: Add failing preserve-without-force test**

Create `.claude/aco/tasks/review.md` with user content, run pack setup without `--force`, and assert the file remains unchanged while stdout/stderr includes skip output.

- [ ] **Step 3: Add failing force-overwrite test**

Create `.claude/aco/tasks/review.md` with user content, run pack setup with `--force`, and assert the packaged review preset replaces the file and appears in `.claude/aco/aco-manifest.json`.

- [ ] **Step 4: Add failing preset dry-run test**

After pack setup, run `aco ask --preset review --dry-run`, `spec-critique`, `plan-critique`, `tdd`, `code-simplify`, and `default`. Assert each exits 0, prints `Preset: <name>`, and skips provider execution.

- [ ] **Step 5: Add failing missing-preset test**

Run `aco ask --preset missing-preset --dry-run` and assert exit 1 with `Preset not found: missing-preset`.

- [ ] **Step 6: Add failing prompt template test**

After pack setup, test the side-effect-free resolver directly for `gemini`/`codex`; assert the selected path ends with the exact `review.md` file and unknown commands still produce no prompt template path.

- [ ] **Step 7: Add failing documented-command missing-template test**

Test the prompt resolver or CLI path for `gemini review` and `codex review` when no review template exists; assert it fails before provider invocation with setup recovery guidance.

- [ ] **Step 8: Add failing unknown-command fallback test**

Test the prompt resolver for an unknown command and assert it returns the generic fallback prompt with no `promptTemplatePath`.

- [ ] **Step 9: Add failing binary fallback test**

Run setup with an intentionally missing `--binary-name` and PATH that does not contain the binary; assert output does not include automatic `npm install -g @pureliture/ai-cli-orch-wrapper` execution language and instead reports exact attempted binary name, current package path or executable context, and manual recovery guidance.

- [ ] **Step 10: Add failing sync-preflight test**

Make structured sync preflight report a fatal conflict, run `aco pack setup`, and assert `.claude/commands/aco.md`, `.claude/aco/prompts`, and `.claude/aco/tasks` are not written. Add a companion no-source test proving fresh projects still install templates.

- [ ] **Step 11: Wire the test into `packages/wrapper/package.json`**

Add `tests/pack-runtime-contract.test.ts` to the `test` script.

- [ ] **Step 12: Verify RED**

Run: `npm test --workspace=packages/wrapper -- tests/pack-runtime-contract.test.ts`

Expected before implementation: fail because task templates and exact prompt files are not installed yet.

## Task 3: Runtime Contract Implementation

**Files:**
- Modify: `packages/wrapper/src/commands/pack-install.ts`
- Create: `packages/wrapper/src/runtime/run-prompt-template.ts`
- Modify: `packages/wrapper/src/cli.ts`
- Create: `templates/tasks/default.md`
- Create: `templates/tasks/review.md`
- Create: `templates/tasks/spec-critique.md`
- Create: `templates/tasks/plan-critique.md`
- Create: `templates/tasks/tdd.md`
- Create: `templates/tasks/code-simplify.md`
- Create: `templates/prompts/gemini/review.md`
- Create: `templates/prompts/codex/review.md`

- [ ] **Step 1: Install task templates**

In `packInstall()`, define:

```typescript
const tasksSrc = join(TEMPLATES_DIR, 'tasks');
const tasksDest = join(targetBase, 'aco', 'tasks');
```

Then call `copyTree(tasksSrc, tasksDest, options.force ?? false, 'task preset', installedFiles);` after prompts.

- [ ] **Step 2: Create side-effect-free prompt resolver**

Extract the prompt path logic from `cmdRun()` into `packages/wrapper/src/runtime/run-prompt-template.ts`:

```typescript
export async function resolveRunPromptTemplate(input: {
  cwd: string;
  home: string;
  providerKey: string;
  command: string;
}): Promise<{ prompt: string; promptTemplatePath?: string }> {
  // exact cwd path, exact global path, fallback prompt
}
```

Keep unknown-command fallback identical except for routing through the helper. Documented `gemini review` and `codex review` must throw a clear missing-template error when no exact template exists.

- [ ] **Step 3: Add structured sync preflight before pack writes**

Add a preflight helper that distinguishes true conflicts from no-source and update-only drift. Refactor `packSetup()` so fatal sync conflicts are checked before `packInstall()`. If post-install sync fails, include pack manifest recovery guidance.

- [ ] **Step 4: Replace automatic public fallback and pass binary name**

In `cmdPack()`, parse `--binary-name` for `pack setup`. In `placeWrapperBinary()`, if `binaryName --version` is missing or not this CLI, print local/current package recovery guidance and do not call `npm install -g @pureliture/ai-cli-orch-wrapper` automatically.

- [ ] **Step 5: Add packaged task presets**

Copy the current repo-local task preset content from `.claude/aco/tasks/*.md` into `templates/tasks/*.md`, with `templates/tasks/tdd.md` as the canonical TDD preset.

- [ ] **Step 6: Add exact provider review prompts**

Create Gemini and Codex `review.md` prompt templates with read-only advisory review instructions. Gemini may reuse the current reviewer prompt content; Codex should be equivalent but provider-neutral enough for Codex.

- [ ] **Step 7: Verify GREEN**

Run the targeted pack runtime test until it passes.

## Task 4: Package Smoke

**Files:**
- Create: `packages/wrapper/tests/pack-runtime-contract-smoke.ts`
- Modify: `packages/wrapper/package.json`

- [ ] **Step 1: Add tarball asset smoke**

Use `npm pack --json` in `packages/wrapper`, install the tarball into an isolated temp npm prefix, prepend that prefix's `bin` directory plus fake provider binaries to `PATH`, and run the tarball-installed CLI with isolated `HOME`.

Assert `aco --version`, `aco pack setup`, `aco ask --preset review/spec-critique/plan-critique/tdd/code-simplify/default --dry-run`, and `aco run gemini review --input demo` all use the isolated prefix package and fake provider. Also inspect the packed file list for `dist/cli.js`, commands, prompts, and tasks. The smoke command must not run `npm run build` internally; stale `dist` detection comes from executing the currently packed `dist` artifact.

- [ ] **Step 2: Add script**

Add `"test:pack-runtime-contract": "tsx tests/pack-runtime-contract-smoke.ts"` to `packages/wrapper/package.json`.

- [ ] **Step 3: Verify smoke**

Run: `npm run test:pack-runtime-contract --workspace=packages/wrapper`

Expected: pass without live provider invocation.

## Task 5: Documentation Alignment

**Files:**
- Modify: `README.md`
- Modify: `packages/wrapper/README.md`
- Modify: `docs/guides/runbook.md`
- Modify: `docs/reference/context-sync.md`

- [ ] **Step 1: README setup paths**

Document three setup modes: published npm/npx, source checkout with `node packages/wrapper/dist/cli.js`, and local tarball with `npm pack`. Avoid implying unpublished package availability.

- [ ] **Step 2: README commands and presets**

List tested commands and presets:

```bash
aco run gemini review
aco run codex review
aco ask --preset review --dry-run
aco ask --preset spec-critique --dry-run
aco ask --preset plan-critique --dry-run
aco ask --preset tdd --dry-run
```

- [ ] **Step 3: Runbook pilot validation**

Add a copy-pastable pilot sequence with mock/dry-run validation first and opt-in real provider smoke clearly labeled.

- [ ] **Step 4: Context-sync reference**

Clarify that pack setup installs task presets, while `aco sync` may expose shared policy surfaces but does not execute providers.

## Task 6: Review, Simplification, and Verification

**Files:**
- Modify: `openspec/changes/restore-pack-template-runtime-contract/review-notes.md`
- Modify: `openspec/changes/restore-pack-template-runtime-contract/tasks.md`

- [ ] **Step 1: Run targeted validation**

Run:

```bash
npm test --workspace=packages/wrapper -- tests/pack-runtime-contract.test.ts
npm run test:pack-runtime-contract --workspace=packages/wrapper
npm run build --workspace=packages/wrapper
npm run test:pack-runtime-contract --workspace=packages/wrapper
```

- [ ] **Step 2: Run broad validation**

Run:

```bash
npm run typecheck
npm test
npm run test:smoke
openspec validate restore-pack-template-runtime-contract --type change --strict
git diff --check
```

- [ ] **Step 3: Code review**

Run TypeScript/runtime/security review over touched files. Fix P0/P1 findings, record P2/P3 follow-ups if any.

- [ ] **Step 4: Code simplifier pass**

Review touched code/docs for accidental duplication and over-specific abstractions. Preserve behavior and rerun affected tests if changed.

- [ ] **Step 5: Validation ledger**

Record all commands, exit codes, and whether live provider smoke was not run because it is opt-in.
