---
phase: 08-adversarial-rescue
verified: 2026-04-02T12:00:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 8: adversarial + rescue — Verification Report

**Phase Goal:** Users can run aggressive focus-targeted reviews and get unstuck via a second-opinion AI using either CLI  
**Verified:** 2026-04-02  
**Status:** ✅ passed  
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                            | Status     | Evidence                                                                                      |
|----|------------------------------------------------------------------------------------------------------------------|------------|-----------------------------------------------------------------------------------------------|
| 1  | `/gemini:adversarial` and `/copilot:adversarial` each use a more aggressive review prompt than `:review`        | ✓ VERIFIED | Both commands load `adversarial.md` (not `reviewer.md`); prompt contains "Assume bugs exist", adversarial role language. File is 53 lines vs reviewer.md's 44 lines. |
| 2  | `--focus security`, `--focus performance`, `--focus correctness`, `--focus all` each scope the adversarial prompt | ✓ VERIFIED | Bash regex `BASH_REMATCH` parses `--focus <value>`; `case` statement appends `FOCUS_INSTR` for each value; `all` yields empty string (no constraint). Spot-check confirmed parsing works. |
| 3  | `/gemini:rescue` and `/copilot:rescue` each accept a problem description and return a fresh perspective          | ✓ VERIFIED | Both commands implement 4 input paths (`--from`, `--error`, stdin `! -t 0`, positional `$ARGUMENTS`); RESC-03 merge logic confirmed; RESC-02 git log injection confirmed. |
| 4  | Input resolution for `:adversarial` follows the same priority as `:review` (file > git diff HEAD > git diff HEAD~1 > "No changes detected") | ✓ VERIFIED | `FILE_ARG > git diff HEAD > git diff HEAD~1 > echo "No changes detected"` chain present verbatim in both adversarial commands. |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact                                          | Provides                                 | Status     | Details                                           |
|---------------------------------------------------|------------------------------------------|------------|---------------------------------------------------|
| `.claude/aco/prompts/gemini/adversarial.md`       | Aggressive prompt for Gemini adversarial | ✓ VERIFIED | 2448 bytes, aggressive language confirmed         |
| `.claude/aco/prompts/copilot/adversarial.md`      | Aggressive prompt for Copilot adversarial| ✓ VERIFIED | 2528 bytes, same quality                          |
| `.claude/aco/prompts/gemini/rescue.md`            | Second-opinion prompt for Gemini rescue  | ✓ VERIFIED | 1793 bytes, unblocking/fresh-perspective language  |
| `.claude/aco/prompts/copilot/rescue.md`           | Second-opinion prompt for Copilot rescue | ✓ VERIFIED | 1853 bytes, same quality                          |
| `.claude/commands/gemini/adversarial.md`          | `/gemini:adversarial` slash command      | ✓ VERIFIED | 3287 bytes, YAML frontmatter + bash block         |
| `.claude/commands/copilot/adversarial.md`         | `/copilot:adversarial` slash command     | ✓ VERIFIED | 3307 bytes, YAML frontmatter + bash block         |
| `.claude/commands/gemini/rescue.md`               | `/gemini:rescue` slash command           | ✓ VERIFIED | 3227 bytes, YAML frontmatter + bash block         |
| `.claude/commands/copilot/rescue.md`              | `/copilot:rescue` slash command          | ✓ VERIFIED | 3247 bytes, YAML frontmatter + bash block         |

---

### Key Link Verification

| From                                        | To                                               | Via                                | Status     | Details                                     |
|---------------------------------------------|--------------------------------------------------|------------------------------------|------------|---------------------------------------------|
| `gemini/adversarial.md` (command)           | `.claude/aco/lib/adapter.sh`                     | `source "${SCRIPT_DIR}/../../aco/lib/adapter.sh"` | ✓ WIRED | Line confirmed in file                      |
| `copilot/adversarial.md` (command)          | `.claude/aco/lib/adapter.sh`                     | `source "${SCRIPT_DIR}/../../aco/lib/adapter.sh"` | ✓ WIRED | Line confirmed in file                      |
| `gemini/rescue.md` (command)                | `.claude/aco/lib/adapter.sh`                     | `source "${SCRIPT_DIR}/../../aco/lib/adapter.sh"` | ✓ WIRED | Line confirmed in file                      |
| `copilot/rescue.md` (command)               | `.claude/aco/lib/adapter.sh`                     | `source "${SCRIPT_DIR}/../../aco/lib/adapter.sh"` | ✓ WIRED | Line confirmed in file                      |
| `gemini/adversarial.md` (command)           | `.claude/aco/prompts/gemini/adversarial.md`      | `ADVERSARIAL_PROMPT_FILE=...`      | ✓ WIRED   | Correct relative path, `cat` to variable    |
| `copilot/adversarial.md` (command)          | `.claude/aco/prompts/copilot/adversarial.md`     | `ADVERSARIAL_PROMPT_FILE=...`      | ✓ WIRED   | Correct relative path, `cat` to variable    |
| `gemini/rescue.md` (command)                | `.claude/aco/prompts/gemini/rescue.md`           | `RESCUE_PROMPT_FILE=...`           | ✓ WIRED   | Correct relative path, `cat` to variable    |
| `copilot/rescue.md` (command)               | `.claude/aco/prompts/copilot/rescue.md`          | `RESCUE_PROMPT_FILE=...`           | ✓ WIRED   | Correct relative path, `cat` to variable    |
| Adversarial/rescue commands                 | `aco_check_adapter` + `aco_adapter_invoke`       | sourced from adapter.sh            | ✓ WIRED   | Both functions called in all 4 commands     |

---

### Behavioral Spot-Checks

| Behavior                                        | Test                                                                 | Result                                    | Status  |
|-------------------------------------------------|----------------------------------------------------------------------|-------------------------------------------|---------|
| `--focus security` parsed, file arg left in ARGS | Bash inline: `ARGS="--focus security path/to/file.ts"` + regex      | `FOCUS=security, remaining ARGS=path/to/file.ts` | ✓ PASS |
| Invalid `--focus xss` rejected correctly         | Bash inline: `case` statement with `xss`                             | "INVALID FOCUS detected correctly"         | ✓ PASS  |
| `--from` + `--error` merge captures both fields  | Bash inline: `ARGUMENTS="--error 'segfault' --from /dev/null"`       | `FROM_FILE=/dev/null, ERROR_MSG='segfault'`| ✓ PASS  |
| Full test suite (28 tests)                       | `bash .claude/aco/tests/test-review-commands.sh`                     | **28 passed, 0 failed**                   | ✓ PASS  |

---

### Requirements Coverage

| Requirement | Source Plan | Description                                                                         | Status      | Evidence                                                                              |
|-------------|-------------|--------------------------------------------------------------------------------------|-------------|--------------------------------------------------------------------------------------|
| ADV-01      | 08-02       | review보다 공격적인 프롬프트로 adversarial adapter에 dispatch                         | ✓ SATISFIED | `adversarial.md` prompt loaded (not `reviewer.md`); "Assume bugs exist" language     |
| ADV-02      | 08-02       | `--focus security\|performance\|correctness\|all` 옵션 (기본: all)                  | ✓ SATISFIED | BASH_REMATCH parsing + FOCUS_INSTR case statement in both adversarial commands        |
| ADV-03      | 08-02       | input 우선순위 = 파일 > git diff > 오류                                              | ✓ SATISFIED | FILE_ARG > git diff HEAD > git diff HEAD~1 > "No changes detected" chain present      |
| ADV-04      | 08-02 (N/A) | `--target <adapter>` flag (deferred)                                                 | ⚠️ DEFERRED | Explicitly out of scope per plan D-01 decision; no `--target` in either command file  |
| RESC-01     | 08-03       | `--from <file>`, `--error <message>`, stdin, positional args の4 input paths        | ✓ SATISFIED | All 4 branches implemented; stdin via `[ ! -t 0 ]`; positional via `${ARGUMENTS:-}`  |
| RESC-02     | 08-03       | `git log -5 --oneline` auto-injected                                                 | ✓ SATISFIED | `GIT_LOG=$(git log -5 --oneline ...)` + prepended to `FULL_CONTEXT` in both commands |
| RESC-03     | 08-03       | `--from` + `--error` 동시 제공 시 merge                                              | ✓ SATISFIED | "Error message: ${ERROR_MSG}\n\nFile content (${FROM_FILE}):" merge present           |

**Note:** ADV-04 (`--target` override flag) was explicitly deferred by plan design decision — not a gap. Phase 8's required set (ADV-01/02/03, RESC-01/02/03) is fully satisfied.

---

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| (none) | — | — | No TODOs, FIXMEs, placeholder returns, or hardcoded empty values found in any of the 8 new files |

---

### Human Verification Required

#### 1. Live Adapter Dispatch

**Test:** With Gemini CLI installed and authenticated, run `/gemini:adversarial --focus security` against a file with a known vulnerability  
**Expected:** Adversarial prompt is sent; response focuses on security issues; output is verbatim CLI response  
**Why human:** Cannot invoke actual external CLI (gemini/copilot) in automated checks without installing them

#### 2. Rescue Stdin Input Path

**Test:** `echo "I'm getting a SIGSEGV in my allocator" | claude /gemini:rescue`  
**Expected:** Problem description captured from stdin; git log prepended; response from Gemini with unblocking suggestions  
**Why human:** Stdin pipe behavior inside Claude Code's slash-command runtime cannot be unit-tested without the live environment

#### 3. Focus Instruction Prompt Impact

**Test:** Run `/gemini:adversarial --focus performance` and `/gemini:adversarial --focus all` on the same file  
**Expected:** `--focus performance` response concentrates on algorithmic/IO issues; `--focus all` gives broad adversarial review  
**Why human:** Requires live AI response to assess whether the FOCUS_INSTR actually scopes the output

---

## Summary

Phase 8 goal is **fully achieved**. All four observable truths from the ROADMAP Success Criteria are verified:

1. ✅ Both adversarial commands use a distinctly more aggressive prompt ("Assume bugs exist" adversarial reviewer role) vs the standard reviewer.md
2. ✅ All four `--focus` modes (`security`, `performance`, `correctness`, `all`) parse correctly, append scoped instructions, and the `all` case correctly adds no constraint
3. ✅ Both rescue commands implement all four input paths (`--from`, `--error`, stdin, positional), merge `--from`+`--error` per RESC-03, and auto-inject `git log -5 --oneline` per RESC-02
4. ✅ Adversarial input resolution is identical to `:review` (file arg > git diff HEAD > git diff HEAD~1 > "No changes detected")

All 8 new files are substantive (no stubs), fully wired to `adapter.sh` and their respective prompt files, and the complete 28-test suite passes with 0 failures.

ADV-04 (`--target` flag) was explicitly deferred in the plan — this is a design decision, not a gap.

---

_Verified: 2026-04-02_  
_Verifier: the agent (gsd-verifier)_
