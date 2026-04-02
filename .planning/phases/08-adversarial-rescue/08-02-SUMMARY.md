---
phase: 08-adversarial-rescue
plan: "02"
subsystem: commands
tags: [bash, adversarial, gemini, copilot, focus-flag]

requires:
  - phase: 08-adversarial-rescue
    plan: "01"
    provides: adversarial.md prompt files for gemini and copilot

provides:
  - /gemini:adversarial command (ADV-01, ADV-02, ADV-03)
  - /copilot:adversarial command (ADV-01, ADV-02, ADV-03)

affects: [verification]

tech-stack:
  added: []
  patterns:
    - --focus flag parsing via bash regex + BASH_REMATCH
    - FOCUS_INSTR appended to prompt only when focus != 'all'
    - Input resolution chain identical to review.md (file arg > git diff HEAD > git diff HEAD~1 > exit)

key-files:
  created:
    - .claude/commands/gemini/adversarial.md
    - .claude/commands/copilot/adversarial.md

key-decisions:
  - "ADV-04 (--target flag) explicitly deferred per plan scope"
  - "Copilot command structurally identical to gemini version, only adapter key differs"

patterns-established:
  - "Pattern: --focus validation via case statement; invalid values exit 1 with error message"

requirements-completed: [ADV-01, ADV-02, ADV-03]

duration: 3min
completed: 2026-04-02
---

# Plan 08-02: Adversarial Commands — Summary

**Created `/gemini:adversarial` and `/copilot:adversarial` commands with `--focus` scoping and adversarial prompt dispatch.**

## Performance

- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments

1. **`/gemini:adversarial`** — Loads `gemini/adversarial.md` prompt, parses `--focus security|performance|correctness|all` from `$ARGUMENTS`, appends focus constraint instruction to prompt when focus != 'all', resolves input via file arg > git diff HEAD > git diff HEAD~1 > exit, dispatches through `aco_adapter_invoke`.
2. **`/copilot:adversarial`** — Identical structure, uses `copilot` adapter key and `copilot/adversarial.md` prompt.

## Test State

- Wave 0 (08-02) command existence tests: now PASS (2 stubs turned GREEN)
- Remaining RED: rescue command stubs (08-03) — 2 tests

## Issues

None.
