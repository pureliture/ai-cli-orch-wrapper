---
phase: 08-adversarial-rescue
plan: "01"
subsystem: testing
tags: [bash, prompts, adversarial, rescue, tdd]

requires:
  - phase: 07-review-commands
    provides: reviewer.md prompt files, adapter.sh, test harness

provides:
  - adversarial prompt files for gemini and copilot (aggressive review posture)
  - rescue prompt files for gemini and copilot (second-opinion/debugging posture)
  - 19 new tests in test-review-commands.sh (15 PASS, 4 intentionally RED)

affects: [08-02-PLAN, 08-03-PLAN]

tech-stack:
  added: []
  patterns:
    - Wave 0 RED test stubs for command-file existence (turn GREEN after 08-02/08-03)
    - Behavioral unit tests in bash for flag parsing logic before commands exist

key-files:
  created:
    - .claude/aco/prompts/gemini/adversarial.md
    - .claude/aco/prompts/copilot/adversarial.md
    - .claude/aco/prompts/gemini/rescue.md
    - .claude/aco/prompts/copilot/rescue.md
  modified:
    - .claude/aco/tests/test-review-commands.sh

key-decisions:
  - "Gemini adversarial prompt frames reviewer as security auditor; Copilot frames as logic/correctness auditor"
  - "Rescue prompts explicitly not code reviews — second-opinion debugging consultant framing"
  - "Wave 0 stubs for command-file existence left RED intentionally until 08-02/08-03"

patterns-established:
  - "Pattern: behavioral unit tests for bash flag-parsing logic written before command files exist"

requirements-completed: [ADV-01, RESC-01, RESC-02, RESC-03]

duration: 5min
completed: 2026-04-02
---

# Plan 08-01: Scaffolding — Adversarial/Rescue Prompts + Wave 0 Test Stubs — Summary

**Created 4 role-prompt files (adversarial + rescue for gemini/copilot) and extended test harness with 19 tests (15 PASS, 4 intentionally RED stubs for command files).**

## Performance

- **Tasks:** 3 completed
- **Files modified:** 5

## Accomplishments

1. **Adversarial prompt files** — `gemini/adversarial.md` frames Gemini as a security auditor assuming bugs exist; `copilot/adversarial.md` frames Copilot as a logic/correctness auditor. Both use Critical/Major/Minor/Suggestions structure with Verdict output.
2. **Rescue prompt files** — `gemini/rescue.md` and `copilot/rescue.md` define a second-opinion debugging consultant role (not a code reviewer). Both provide Root Cause Hypothesis / Next Steps / Alternative Approaches / Quick Wins output structure.
3. **Test harness extended** — 19 new tests added to `test-review-commands.sh`: 9 behavioral unit tests for `--focus` parsing (ADV-02) and rescue input parsing (RESC-01/02/03), 4 prompt-file existence tests (PASS), 4 command-file existence stubs (intentionally RED until 08-02/08-03).

## Test State

- Phase 7 tests: 11 PASS (unchanged)
- Phase 8 behavioral tests: 9 PASS
- Wave 0 prompt file existence: 4 PASS
- Wave 0 command file existence: 4 FAIL (intentionally RED)
- **Total: 24 PASS, 4 FAIL**

## Issues

None.
