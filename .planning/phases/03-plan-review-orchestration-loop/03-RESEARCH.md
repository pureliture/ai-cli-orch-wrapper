---
phase: 03-plan-review-orchestration-loop
researched: 2026-03-24
status: ready
---

# Phase 3: Plan→Review Orchestration Loop - Research

## Research Question

What does the project need to implement so Phase 3 can be planned and executed reliably without inventing a wrapper-owned orchestration DSL?

## Executive Summary

The safest Phase 3 design is a wrapper-owned loop engine that uses CAO as the terminal/provider runtime boundary, persists all handoff artifacts under `.wrapper/workflows/`, and determines approval from a dedicated machine-readable status file instead of parsing reviewer prose.

The wrapper should own workflow config resolution, run/iteration directories, prompt generation, loop control, and result validation. CAO should continue owning provider startup, session/terminal mechanics, and shell interaction details.

## Recommended Architecture

### Pattern 1: Wrapper owns loop state, CAO owns provider execution

Use the wrapper to resolve workflow configuration, create artifacts, and drive the iteration loop. Use CAO to launch the actual planner and reviewer CLI sessions.

Recommended ownership split:

- Wrapper owns:
  - named workflow lookup from `.wrapper.json`
  - ad-hoc override parsing
  - role → provider resolution using existing `roles`
  - run directory creation under `.wrapper/workflows/`
  - planner/reviewer prompt generation
  - iteration loop and max-iteration termination
  - approval detection from structured files
  - exit codes and human-readable summary
- CAO owns:
  - provider-specific CLI launch
  - terminal/session lifecycle
  - shell readiness details
  - terminal I/O transport

Why:

- Preserves the Phase 2 boundary that wrapper is a convenience layer over CAO, not a replacement orchestration system.
- Avoids duplicating tmux/shell readiness behavior inside the wrapper.
- Keeps the wrapper portable and testable with zero runtime dependencies.

### Pattern 2: Fresh planner/reviewer sessions per iteration

Each iteration should create a fresh planner session and a fresh reviewer session instead of attempting to keep long-lived terminals open across multiple turns.

Recommended iteration flow:

1. Create a planner session via CAO.
2. Send a planner prompt that writes the plan artifact for the current iteration.
3. Wait until CAO reports the planner terminal is complete.
4. Verify the iteration's `plan.md` exists.
5. Create a reviewer session via CAO.
6. Send a reviewer prompt that reads the iteration's `plan.md` and writes both `review.md` and `review.status.json`.
7. Wait until CAO reports the reviewer terminal is complete.
8. Read and validate `review.status.json`.
9. Stop when status is `approved`; otherwise continue until `maxIterations`.

Why:

- Prevents chat-state bleed between iterations.
- Reduces dependence on undocumented handoff/assign semantics.
- Makes artifacts authoritative and replayable.
- Simplifies tests because each step has explicit inputs and outputs.

### Pattern 3: File-based handoff with dedicated approval metadata

Do not infer approval from review prose. The reviewer must produce:

- a human-readable `review.md`
- a machine-readable `review.status.json`

Recommended status schema:

```json
{
  "schemaVersion": 1,
  "status": "approved",
  "summary": "Plan is actionable and complete."
}
```

or

```json
{
  "schemaVersion": 1,
  "status": "changes_requested",
  "summary": "Need clearer verification and rollback steps."
}
```

Why a separate JSON file instead of markdown frontmatter:

- No frontmatter parser required.
- Lower formatting drift risk from LLM output.
- Easy unit tests with native `JSON.parse`.
- Missing or malformed metadata can be treated as a protocol failure.

## Config Shape Recommendations

### Pattern 4: Extend `.wrapper.json` minimally

The current config already supports:

- `aliases`
- `roles`

Phase 3 should add a `workflows` section without turning config into a mini DSL.

Recommended shape:

```json
{
  "aliases": {
    "claude": { "provider": "claude_code", "agent": "developer" }
  },
  "roles": {
    "orchestrator": "claude_code",
    "reviewer": "gemini_cli"
  },
  "workflows": {
    "plan-review": {
      "plannerRole": "orchestrator",
      "plannerAgent": "developer",
      "reviewerRole": "reviewer",
      "reviewerAgent": "reviewer",
      "maxIterations": 3,
      "plannerLaunchArgs": [],
      "reviewerLaunchArgs": []
    }
  }
}
```

Rules:

- Named workflows reference logical roles, not raw providers.
- Provider resolution still comes from `roles`.
- Launch args remain plain arrays of strings.
- Prompt bodies are not stored in config in Phase 3.

Why:

- Satisfies ORCH-04 while preserving CONFIG-03.
- Keeps the config readable and manually editable.
- Supports runtime overrides without inventing a new language.

## Command Surface Recommendations

### Pattern 5: Thin command layer over one shared runner

Recommended commands:

- `wrapper workflow <name>`
- `wrapper workflow-run --planner-role <role> --reviewer-role <role> [flags...]`

Recommended override flags:

- `--planner-role <role>`
- `--reviewer-role <role>`
- `--planner-agent <agent>`
- `--reviewer-agent <agent>`
- `--max-iterations <n>`
- `--role <name>=<provider>` repeatable
- `--planner-launch-arg <arg>` repeatable
- `--reviewer-launch-arg <arg>` repeatable

Recommended validation responsibilities:

- Wrapper validates:
  - workflow exists
  - required fields are present
  - referenced roles resolve to providers
  - `maxIterations >= 1`
  - repo-local artifact root exists or can be created
  - `review.status.json` exists and has a valid schema
- CAO validates:
  - provider launch behavior
  - session creation
  - terminal completion and terminal errors

Recommended exit codes:

- `0` — approved
- `2` — max iterations reached without approval
- `1` — config, protocol, or runtime failure

## Artifact Layout Recommendations

### Pattern 6: Repo-local run directories

Recommended layout:

```text
.wrapper/
  workflows/
    plan-review/
      runs/
        20260324T095530Z-a1b2/
          run.json
          state.json
          iterations/
            01/
              planner.prompt.md
              plan.md
              reviewer.prompt.md
              review.md
              review.status.json
              iteration.json
```

Recommended file roles:

- `run.json` — immutable snapshot of workflow name, providers, agents, overrides, cwd, start time
- `state.json` — mutable run status (`running`, `approved`, `max_iterations`, `failed`), current iteration, final reason
- `planner.prompt.md` — exact prompt sent to planner for auditability
- `plan.md` — planner output consumed by reviewer
- `reviewer.prompt.md` — exact prompt sent to reviewer
- `review.md` — human-readable feedback
- `review.status.json` — machine-readable approval contract
- `iteration.json` — timestamps, terminal IDs, and iteration summary

Why:

- Satisfies ORCH-03 with explicit file-based handoff.
- Keeps all state repo-local for portability.
- Makes non-approved runs debuggable and resumable by inspection.

## Implementation Structure

### Pattern 7: Keep orchestration code in dedicated modules

Recommended source layout:

```text
src/
  cli.ts
  commands/
    workflow.ts
    workflow-run.ts
  orchestration/
    cao-client.ts
    workflow-config.ts
    artifacts.ts
    prompts.ts
    status-file.ts
    workflow-runner.ts
```

Recommended module responsibilities:

- `src/commands/workflow.ts` — named workflow command entrypoint
- `src/commands/workflow-run.ts` — ad-hoc workflow entrypoint
- `src/orchestration/workflow-config.ts` — workflow normalization/override merge helpers
- `src/orchestration/artifacts.ts` — run/iteration directory creation and path helpers
- `src/orchestration/prompts.ts` — planner/reviewer prompt generation
- `src/orchestration/status-file.ts` — status JSON parsing and validation
- `src/orchestration/workflow-runner.ts` — shared execution loop

Why:

- Keeps `cli.ts` thin.
- Reuses one engine for named and ad-hoc execution.
- Isolates config parsing, artifact persistence, and protocol validation.

## Integration With Current Codebase

### Existing reusable assets

- `src/config/wrapper-config.ts` already reads `.wrapper.json` from `process.cwd()`.
- `src/commands/alias.ts` already shows the established thin wrapper pattern around CAO invocation.
- `src/cli.ts` is the current dispatch surface where workflow commands should be added.
- `.wrapper.json` already contains `roles.orchestrator` and `roles.reviewer`, which Phase 3 should consume directly.

### Required upgrades

- `WrapperConfig` needs a typed optional `workflows` field.
- Raw JSON parsing is too permissive for nested workflow structures; add explicit normalization/validation helpers.
- Help output in `src/cli.ts` should advertise `workflow` and `workflow-run`.
- Default project config should include at least one named workflow example to support portability.

## Test Strategy

### Pattern 8: Reuse the Phase 2 test model

The project already uses:

- Node built-in test runner
- compiled `dist/` imports in tests
- `spawnSync` for CLI behavior checks
- zero runtime dependencies

Recommended test split:

1. Config tests
   - valid `workflows` parsing
   - invalid or incomplete workflow definitions
   - role-resolution failures
   - override merge behavior

2. CLI tests
   - `wrapper workflow <missing>` exits 1
   - `wrapper workflow-run` missing required flags exits 1
   - help output lists workflow commands
   - built-ins still win over aliases/workflows

3. Runner tests with a fake CAO API seam
   - create a fake local HTTP server with Node's `node:http`
   - simulate session creation, polling, completion, and output
   - verify planner/reviewer loop behavior, artifact creation, and exit codes

4. Manual smoke test
   - real CAO-backed end-to-end approval path
   - max-iterations non-approved path
   - artifact inspection under `.wrapper/workflows/`

## Validation Architecture

Validation should prove the loop protocol, not just individual helper functions.

Recommended validation layers:

1. Unit validation
   - workflow config normalization
   - status file parsing
   - artifact path generation
   - override merge logic

2. Loop protocol validation
   - reviewer approval ends the loop immediately
   - `changes_requested` continues to the next iteration
   - reaching `maxIterations` produces exit code `2`
   - malformed or missing `review.status.json` produces exit code `1`

3. Artifact validation
   - `plan.md` exists before reviewer starts
   - each iteration contains both prompt files and output files
   - `state.json` reflects final run outcome

4. CLI validation
   - workflow commands parse expected flags
   - config-driven role mapping works with no code changes
   - help text reflects the new command surface

## Pitfalls

### Pitfall 1: CAO server dependency is real

Observed on this machine:

- `cao-server` can start successfully and serves on `http://localhost:9889`
- it was not already running persistently for the workflow

Implication:

- add a CAO health preflight before starting a workflow
- fail early with an actionable message such as `CAO server is not running. Start it with 'cao-server'.`

### Pitfall 2: Approval must never be inferred from prose

If the wrapper falls back to parsing `review.md`, ORCH-02 becomes provider-dependent and brittle.

Required behavior:

- only trust `review.status.json.status`
- treat missing or malformed JSON as a protocol failure

### Pitfall 3: Long-lived interactive sessions increase fragility

Reusing one planner or reviewer terminal across iterations makes the wrapper depend more heavily on shell readiness, prompt state, and prior tool output.

Safer default:

- use fresh sessions per step
- trust artifacts as the iteration handoff source of truth

### Pitfall 4: Current config loading is too permissive for orchestration

`readWrapperConfig()` currently casts parsed JSON directly and returns an empty default on failure. That is acceptable for Phase 2 aliases but insufficient for workflow orchestration.

Phase 3 should add:

- normalization helpers
- clear validation errors for malformed workflow entries
- explicit defaults for optional workflow fields

### Pitfall 5: `process.cwd()` remains the config anchor

Current behavior reads `.wrapper.json` from the current working directory. Phase 3 should either keep that rule explicit or add repo-root discovery later.

Recommendation for this phase:

- require execution from the repo root or a directory containing `.wrapper.json`
- fail clearly if config is missing

## Planning Implications

Recommended plan decomposition:

- Wave 1: Add failing tests and typed workflow config surface
- Wave 2: Implement artifact helpers, status-file parsing, and CAO client seam
- Wave 3: Implement shared workflow runner with loop termination rules
- Wave 4: Wire CLI commands, help output, default config example, and smoke tests

Best single architectural decision to lock before planning:

> Use fresh CAO-backed planner/reviewer sessions per iteration, repo-local artifacts under `.wrapper/workflows/`, and `review.status.json` as the sole approval contract.

---

_Research completed: 2026-03-24_
