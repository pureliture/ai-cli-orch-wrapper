# Phase 05: Wrapper Runtime Contract - Research

**Research Date:** 2026-03-31
**Status:** Complete

## Research Goal
Determine how to implement the "Wrapper Runtime Contract" phase, ensuring the consolidated `aco` command works seamlessly with existing `.wrapper.json` and `.wrapper/` artifacts while rebranding internal code symbols and enforcing subcommand priority.

## Key Findings

### 1. Internal Symbol Refactoring (D-03, D-04)
- **Files to Modify:**
  - `src/config/wrapper-config.ts` → Rename to `src/config/aco-config.ts`.
  - Rename `WrapperConfig` interface to `AcoConfig`.
  - Rename `readWrapperConfig` function to `readAcoConfig`.
- **Affected Consumers:**
  - `src/cli.ts`
  - `src/cli-surface.ts`
  - `src/commands/workflow.ts`
  - `src/commands/workflow-run.ts`
  - `src/orchestration/workflow-config.ts`
  - `src/orchestration/workflow-runner.ts`
- **Constraint:** The internal `AcoConfig` must still point to `.wrapper.json` on disk (D-01).

### 2. Built-in Subcommand Priority (CMD-03, D-06)
- **Conflict Validation:** The CLI entry point (`src/cli.ts`) must validate the `aliases` map from `aco-config.ts` on startup.
- **Built-in List:** `setup`, `help`, `version`, `workflow`, `workflow-run` (plus flags like `--help`, `--version`).
- **Implementation:** 
  ```typescript
  const BUILTIN_COMMANDS = ['setup', 'help', 'version', 'workflow', 'workflow-run'];
  for (const alias of Object.keys(config.aliases)) {
    if (BUILTIN_COMMANDS.includes(alias)) {
      console.error(`Error: alias '${alias}' in .wrapper.json conflicts with a built-in command.`);
      process.exit(1);
    }
  }
  ```
- **Timing:** This check should happen before command dispatch to ensure environmental integrity.

### 3. Branding & Log Consolidation (D-02, WRAP-01, WRAP-02)
- **Setup Branding:** `src/commands/setup.ts` needs a final pass to ensure all `console.log` and file header templates use `aco`.
  - Example header: `# Managed by aco setup — do not edit manually.`
  - Log stability: `✓ .wrapper.json: already exists` (Preserve the `.wrapper` filename in logs for clarity).
- **Artifact Paths:** `src/orchestration/artifacts.ts` defines `WORKFLOW_ARTIFACT_ROOT = '.wrapper/workflows'`. This remains UNCHANGED to satisfy WRAP-02 and D-01.

### 4. Legacy "Lockfile" Removal (D-05)
- **References found in:**
  - `.planning/PROJECT.md`: References to `wrapper.lock` in architecture and future plans.
  - `.planning/ROADMAP.md`: Success criteria or milestone descriptions mentioning lockfiles.
  - `.planning/REQUIREMENTS.md`: Any traceability to lockfile features.
- **Action:** Scrub these files to remove references to the unused `wrapper.lock` to eliminate ambiguity.

## Plan Recommendations

### What do I need to know to PLAN this phase well?
1. **Atomic Refactoring:** Perform the internal symbol rename (`WrapperConfig` -> `AcoConfig`) as a single atomic step across the codebase to avoid compilation errors.
2. **Conflict Check Placement:** Ensure the alias conflict check in `src/cli.ts` is performed *every* time the CLI runs, not just when an alias is invoked, to catch invalid configurations early.
3. **Idempotency Verification:** Verify that `aco setup` correctly detects an existing `.wrapper.json` and does not attempt to overwrite or rename it.
4. **No Renaming of Disk Artifacts:** Strictly adhere to D-01/D-02. Do NOT rename `.wrapper.json` or `.wrapper/` directories.

## Success Criteria (Verification Plan)
1. **[ ]** `aco setup` runs without errors and produces/detects `.wrapper.json`.
2. **[ ]** Internal code uses `AcoConfig` and `readAcoConfig` symbols exclusively.
3. **[ ]** Adding `"setup": { ... }` to `aliases` in `.wrapper.json` causes the CLI to exit with a conflict error.
4. **[ ]** `aco workflow` results continue to land in `.wrapper/workflows/`.
5. **[ ]** No mentions of `wrapper.lock` remain in `.planning/*.md`.

---
*Research by Gemini CLI - 2026-03-31*
