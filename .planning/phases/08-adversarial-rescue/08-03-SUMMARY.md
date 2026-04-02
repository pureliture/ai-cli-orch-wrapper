---
phase: 08-adversarial-rescue
plan: "03"
subsystem: commands
tags: [bash, rescue, gemini, copilot, second-opinion, debugging]

requires:
  - phase: 08-adversarial-rescue
    plan: "01"
    provides: rescue.md prompt files for gemini and copilot

provides:
  - /gemini:rescue command (RESC-01, RESC-02, RESC-03)
  - /copilot:rescue command (RESC-01, RESC-02, RESC-03)

affects: [verification]

tech-stack:
  added: []
  patterns:
    - --from flag parses path token via [^[:space:]]+ (no spaces in path)
    - --error flag captures to end-of-string then strips trailing --from segment
    - stdin detection via [ ! -t 0 ]
    - RESC-03 merge format with labeled sections
    - RESC-02 git log always prepended regardless of input mode

key-files:
  created:
    - .claude/commands/gemini/rescue.md
    - .claude/commands/copilot/rescue.md

key-decisions:
  - "No input at all → exit 1 with error (rescues require a problem description)"
  - "Copilot version structurally identical to gemini, only adapter key and description differ"

patterns-established:
  - "Pattern: multi-source input with RESC-03 merge — labeled sections when both --from and --error provided"

requirements-completed: [RESC-01, RESC-02, RESC-03]

duration: 3min
completed: 2026-04-02
---

# Plan 08-03: Rescue Commands — Summary

**Created `/gemini:rescue` and `/copilot:rescue` with 4-source input resolution, git context injection, and RESC-03 merge behavior. All 28 tests now PASS.**

## Performance

- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments

1. **`/gemini:rescue`** — Implements RESC-01 (4 input paths: `--from`, `--error`, stdin, positional), RESC-02 (auto-inject `git log -5 --oneline`), RESC-03 (merge both `--from` and `--error` with labeled sections when both provided). No input → exit 1.
2. **`/copilot:rescue`** — Identical structure, uses `copilot` adapter key and `copilot/rescue.md` prompt.

## Test State

- All 28 tests PASS — Wave 0 (08-03) rescue command stubs turned GREEN
- Full suite: 28/28 PASS, 0 FAIL

## Issues

None.
