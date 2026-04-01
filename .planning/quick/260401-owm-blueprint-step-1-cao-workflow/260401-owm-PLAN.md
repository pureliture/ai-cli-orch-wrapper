---
phase: quick
plan: 260401-owm
type: execute
wave: 1
depends_on: []
files_modified:
  - src/cli.ts
  - src/cli-surface.ts
  - src/config/aco-config.ts
  - src/orchestration/cao-client.ts        # DELETE
  - src/orchestration/workflow-runner.ts   # DELETE
  - src/orchestration/status-file.ts       # DELETE
  - src/orchestration/workflow-config.ts   # DELETE
  - src/orchestration/artifacts.ts         # DELETE
  - src/orchestration/prompts.ts           # DELETE
  - src/commands/workflow.ts               # DELETE
  - src/commands/workflow-run.ts           # DELETE
  - test/cao-client.test.ts                # DELETE
  - test/workflow-cli.test.ts              # DELETE
  - test/workflow-runner.test.ts           # DELETE
  - test/status-file.test.ts               # DELETE
  - test/workflow-config.test.ts           # DELETE
  - test/artifacts.test.ts                 # DELETE
autonomous: true
requirements: [OWM-STEP1]

must_haves:
  truths:
    - "npm run build passes with zero TypeScript errors after deletions and edits"
    - "npm run lint (tsc --noEmit) passes with zero errors"
    - "npm test passes — all remaining tests pass (alias, canonical-command-surface, config, setup tests)"
    - "src/orchestration/ directory contains no files (all 6 files deleted)"
    - "src/commands/ contains no workflow.ts or workflow-run.ts"
    - "src/cli.ts has no import or dispatch for workflow, workflow-run, or aliasCommand"
    - "src/cli-surface.ts BUILTIN_COMMANDS does not include 'workflow', 'workflow-run', or 'alias'"
    - "src/config/aco-config.ts has no import from orchestration/ and no workflows/roles fields"
  artifacts:
    - path: "src/cli.ts"
      provides: "Slimmed CLI dispatcher — only setup, help, version, alias-dispatch"
      contains: "aliasCommand"
    - path: "src/cli-surface.ts"
      provides: "Updated BUILTIN_COMMANDS and help text without workflow entries"
    - path: "src/config/aco-config.ts"
      provides: "AcoConfig with only aliases field; no WorkflowDefinitionInput import"
  key_links:
    - from: "src/cli.ts"
      to: "src/commands/alias.ts"
      via: "aliasCommand import — only orchestration-layer call remaining"
    - from: "src/config/aco-config.ts"
      to: "src/orchestration/workflow-config.ts"
      via: "import type WorkflowDefinitionInput — MUST be removed"
---

<objective>
Strip all cao-dependent workflow infrastructure from the codebase in preparation for the v2.0 multi-AI-CLI bridge architecture.

Purpose: The existing plan→review loop, CaoHttpClient, and workflow-run CLI surface are all tightly coupled to the cao HTTP server. Removing them in one atomic step keeps the build green at each commit and establishes a clean baseline before the new bridge layer is introduced.

Output: A build-clean, lint-clean, test-clean codebase with zero cao/workflow surface remaining. The `aco` CLI retains: setup, help, version, alias dispatch.
</objective>

<execution_context>
@/Users/pureliture/ai-cli-orch-wrapper/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@/Users/pureliture/ai-cli-orch-wrapper/.planning/STATE.md
@/Users/pureliture/ai-cli-orch-wrapper/.planning/PROJECT.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create feat/v2-cao-strip branch and delete all cao/workflow source + test files</name>
  <files>
    src/orchestration/cao-client.ts
    src/orchestration/workflow-runner.ts
    src/orchestration/status-file.ts
    src/orchestration/workflow-config.ts
    src/orchestration/artifacts.ts
    src/orchestration/prompts.ts
    src/commands/workflow.ts
    src/commands/workflow-run.ts
    test/cao-client.test.ts
    test/workflow-cli.test.ts
    test/workflow-runner.test.ts
    test/status-file.test.ts
    test/workflow-config.test.ts
    test/artifacts.test.ts
  </files>
  <action>
    1. Create and switch to the new branch:
       git checkout -b feat/v2-cao-strip

    2. Delete the 6 orchestration source files:
       rm src/orchestration/cao-client.ts
       rm src/orchestration/workflow-runner.ts
       rm src/orchestration/status-file.ts
       rm src/orchestration/workflow-config.ts
       rm src/orchestration/artifacts.ts
       rm src/orchestration/prompts.ts

    3. Delete the 2 workflow command source files:
       rm src/commands/workflow.ts
       rm src/commands/workflow-run.ts

    4. Delete the 6 corresponding test files:
       rm test/cao-client.test.ts
       rm test/workflow-cli.test.ts
       rm test/workflow-runner.test.ts
       rm test/status-file.test.ts
       rm test/workflow-config.test.ts
       rm test/artifacts.test.ts

    Do NOT yet touch src/cli.ts, src/cli-surface.ts, or src/config/aco-config.ts — those have live imports pointing to the now-deleted files and will cause compile errors until Task 2 rewrites them.
  </action>
  <verify>
    ls src/orchestration/ 2>/dev/null | wc -l  # must output 0
    ls src/commands/workflow*.ts 2>/dev/null | wc -l  # must output 0
  </verify>
  <done>src/orchestration/ is empty (or absent), src/commands/ has no workflow.ts or workflow-run.ts, all 6 test files are gone.</done>
</task>

<task type="auto">
  <name>Task 2: Rewrite cli.ts, cli-surface.ts, and aco-config.ts to remove all workflow/cao references</name>
  <files>
    src/cli.ts
    src/cli-surface.ts
    src/config/aco-config.ts
  </files>
  <action>
    Rewrite each of the three files. Use immutable replacement (write full file content, not sed patches).

    --- src/config/aco-config.ts ---
    Remove the `import type { WorkflowDefinitionInput }` import and the `workflows` and `roles` fields from `AcoConfig`. The trimmed interface:

    ```typescript
    /**
     * Aco config
     *
     * Reads and parses .wrapper.json from the current working directory.
     */

    import { readFileSync } from 'node:fs';

    export const ACO_CONFIG_FILE = '.wrapper.json';

    export interface AliasEntry {
      provider: string;
      agent: string;
    }

    export interface AcoConfig {
      aliases: Record<string, AliasEntry>;
    }

    const DEFAULT_CONFIG: AcoConfig = { aliases: {} };

    export function readAcoConfig(path = ACO_CONFIG_FILE): AcoConfig {
      try {
        const raw = readFileSync(path, 'utf8');
        return JSON.parse(raw) as AcoConfig;
      } catch {
        return DEFAULT_CONFIG;
      }
    }
    ```

    --- src/cli-surface.ts ---
    Remove 'workflow', 'workflow-run', and 'alias' from BUILTIN_COMMANDS array.
    Remove the workflow and workflow-run lines from the `formatHelp` return string.
    No other changes needed — the rest of the file (CANONICAL_COMMAND, LEGACY_COMMAND, formatVersionLine, formatUseCanonicalCommand, selectRecoveryNextStep, formatUnknownCommand) stays unchanged.

    Updated BUILTIN_COMMANDS line:
      export const BUILTIN_COMMANDS = ['setup', 'help', 'version'];

    Updated formatHelp Commands section (remove the two workflow lines):
      Commands:
        setup        Bootstrap the AI CLI orchestration environment
        help         Show this help
        version      Show version

    --- src/cli.ts ---
    Remove:
    - import { workflowCommand } from './commands/workflow.js'
    - import { workflowRunCommand } from './commands/workflow-run.js'
    - Remove BUILTIN_COMMANDS from the import of cli-surface (it's now unused in cli.ts)
    - The `else if (command === 'workflow')` branch
    - The `else if (command === 'workflow-run')` branch
    - The `else if (command && config.aliases[command])` branch and its aliasCommand call

    Keep: setup, help/--help/-h, version/--version/-V, the catch-all unknown command path, the legacy-command guard, and the `config` read (still needed if alias dispatch is retained — but since aliasCommand import is from commands/alias.ts which still exists, retain alias dispatch).

    Re-evaluate: src/commands/alias.ts is NOT deleted (per Task 1 scope — only workflow.ts, workflow-run.ts are deleted). The alias dispatch branch in cli.ts (`config.aliases[command]`) must STAY. So the aliasCommand import and the alias dispatch `else if` block remain.

    Resulting cli.ts dispatch order:
      1. Legacy command guard (wrapper name check)
      2. Missing command guard
      3. setup
      4. help / --help / -h
      5. version / --version / -V
      6. alias lookup via config.aliases[command]
      7. Unknown command fallthrough

    Remove only the two workflow imports and the two workflow else-if blocks.
    Remove BUILTIN_COMMANDS from the cli-surface import since cli.ts no longer references it.
  </action>
  <verify>
    npm run lint
  </verify>
  <done>
    `npm run lint` exits 0 with no TypeScript errors. No import in any of the three files references a deleted module.
  </done>
</task>

<task type="auto">
  <name>Task 3: Build, test, and commit on feat/v2-cao-strip</name>
  <files></files>
  <action>
    1. Run full build:
       npm run build

       Expected: exits 0, dist/ updated, no errors.

    2. Run test suite:
       npm test

       Expected: all remaining tests pass. The deleted test files are gone so node --test only picks up:
       test/alias.test.ts, test/canonical-command-surface.test.ts, test/config.test.ts,
       test/install-state-cleanup.test.ts, test/setup.test.ts

       If any test fails because it references workflow/workflow-run in BUILTIN_COMMANDS assertions or
       help-text assertions, update only the assertion strings to match the new trimmed output — do NOT
       restore deleted functionality.

    3. Commit:
       git add src/cli.ts src/cli-surface.ts src/config/aco-config.ts
       git add -u src/orchestration/ src/commands/workflow.ts src/commands/workflow-run.ts
       git add -u test/cao-client.test.ts test/workflow-cli.test.ts test/workflow-runner.test.ts test/status-file.test.ts test/workflow-config.test.ts test/artifacts.test.ts
       git commit -m "feat(v2-cao-strip): remove cao workflow layer and strip cli surface to setup+alias+meta"
  </action>
  <verify>
    <automated>npm run build && npm test</automated>
  </verify>
  <done>
    npm run build exits 0. npm test passes all remaining tests. git log shows the strip commit on feat/v2-cao-strip. src/orchestration/ is gone or empty.
  </done>
</task>

</tasks>

<verification>
After all three tasks:
- `ls src/orchestration/` returns empty (or "No such file")
- `npm run build` exits 0
- `npm run lint` exits 0
- `npm test` passes (all remaining tests)
- `git log --oneline -1` shows the strip commit on feat/v2-cao-strip
- `grep -r "cao-client\|workflow-runner\|workflow-config\|status-file\|WorkflowDefinitionInput" src/` returns no matches
</verification>

<success_criteria>
- Zero TypeScript errors after deletion + edits
- All remaining tests pass (alias, setup, config, canonical-command-surface, install-state-cleanup)
- No file in src/ imports from the deleted orchestration modules
- BUILTIN_COMMANDS = ['setup', 'help', 'version'] in cli-surface.ts
- AcoConfig has only `aliases` field (no workflows, no roles)
- feat/v2-cao-strip branch has one clean commit with all changes
</success_criteria>

<output>
No SUMMARY.md needed for quick tasks. Log completion in .planning/STATE.md Quick Tasks Completed table:
| 260401-owm | Blueprint Step 1: cao 의존성 및 workflow 명령 구조적 제거 | 2026-04-01 | {commit} | [260401-owm-blueprint-step-1-cao-workflow](.planning/quick/260401-owm-blueprint-step-1-cao-workflow/) |
</output>
