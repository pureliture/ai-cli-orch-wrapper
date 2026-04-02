# Phase 08 Plan Check — adversarial + rescue

**Verdict: FLAG** — Plans will achieve the phase goal. Two minor issues noted; no blockers.

**Checked**: 08-01-PLAN.md, 08-02-PLAN.md, 08-03-PLAN.md  
**Method**: Goal-backward analysis + bash correctness verification

---

## 1. Requirement Coverage

| Requirement | Covered By | Status |
|---|---|---|
| ADV-01: adversarial dispatch / aggressive prompt | 08-01 Task 1 (prompts), 08-02 Tasks 1-2 (commands) | ✅ COVERED |
| ADV-02: `--focus` parsing (security/performance/correctness/all) | 08-02 Tasks 1-2 | ✅ COVERED |
| ADV-03: input priority = file > git diff HEAD > git diff HEAD~1 | 08-02 Tasks 1-2 | ✅ COVERED |
| RESC-01: `--from`, `--error`, stdin, positional arg modes | 08-03 Tasks 1-2 | ✅ COVERED |
| RESC-02: auto-inject `git log -5 --oneline` | 08-03 Tasks 1-2 | ✅ COVERED |
| RESC-03: merge `--from` + `--error` with labeled sections | 08-03 Tasks 1-2 | ✅ COVERED |

> Note: The ROADMAP lists Phase 8 requirements as ADV-01, ADV-02, ADV-03, RESCUE-01, RESCUE-02. RESC-03 is in the prompt spec but absent from the ROADMAP's Requirements line. The plans cover it anyway — bonus coverage, not a gap.

## 2. Success Criteria Coverage

| Success Criterion | Plans | Status |
|---|---|---|
| SC1: adversarial prompts more aggressive than `:review` counterparts | 08-01 + 08-02 | ✅ |
| SC2: `--focus` values each scope prompt accordingly | 08-02 (FOCUS_INSTR append logic) | ✅ |
| SC3: `:rescue` accepts problem description, returns fresh perspective | 08-03 | ✅ |
| SC4: adversarial input resolution matches review priority chain | 08-02 (verbatim copy) | ✅ |
| SC5: `:rescue` accepts `--from`, `--error`, stdin, positional | 08-03 | ✅ |
| SC6: `:rescue` auto-injects `git log -5 --oneline` | 08-03 | ✅ |

## 3. Wave Discipline

```
Wave 1:  08-01 — creates 4 prompt files + extends test suite (no deps)
Wave 2:  08-02 — creates gemini:adversarial, copilot:adversarial (depends on 08-01 prompts)
Wave 2:  08-03 — creates gemini:rescue, copilot:rescue (depends on 08-01 prompts)
```

08-01 creates all artifacts that 08-02 and 08-03 pre-condition on. Wave discipline is sound. 08-02 and 08-03 are independent and can run in parallel. ✅

## 4. Bash Correctness

### ✅ `--focus` extraction and stripping
Confirmed in bash:
- `"--focus security src/auth.ts"` → FOCUS=`security`, ARGS=`src/auth.ts` ✅
- `"--focus security"` (no file) → ARGS=`""` → falls through to git diff ✅
- `"src/auth.ts"` (no flag) → FOCUS=`all`, ARGS=`src/auth.ts` ✅

### ⚠️ FLAG-1: `${ARGS## }` strips only one leading space
After `${ARGS/--focus $FOCUS/}`, if input had double-space (`--focus security  src/auth.ts`), the one-space strip leaves `" src/auth.ts"` as FILE_ARG → "file not found" error. Tests only validate single-space case. Edge case in practice.

**Fix**: Replace `ARGS="${ARGS## }"` with a full leading-space trim:
```bash
ARGS="${ARGS#"${ARGS%%[! ]*}"}"
```

### ✅ `--error` parsing and trailing trim
- `"--error msg --from file.txt"` → ERROR_MSG=`msg`, FROM_FILE=`file.txt` ✅
- `"--from file.txt --error msg"` → ERROR_MSG=`msg`, FROM_FILE=`file.txt` ✅

### ✅ Positional fallback is clean
The `else` branch (`PROBLEM_CONTENT="${ARGUMENTS:-}"`) is only reached when FROM_FILE, ERROR_MSG, and STDIN_CONTENT are all empty — meaning ARGUMENTS contains only the positional text, no flags. ✅

### ✅ git log injection
`GIT_LOG=$(git log -5 --oneline 2>/dev/null || echo "(no git history available)")` — falls back gracefully outside git repos. FULL_CONTEXT structure matches test assertions. ✅

### ✅ `--focus all` → no prompt modification
FOCUS_INSTR="" for "all", `[[ -n "$FOCUS_INSTR" ]]` guard prevents empty append. ✅

## 5. Phase 7 Consistency

| Pattern | Phase 7 | Phase 8 adversarial | Phase 8 rescue |
|---|---|---|---|
| `SCRIPT_DIR` resolution | ✅ | ✅ | ✅ |
| `source .../aco/lib/adapter.sh` | ✅ | ✅ | ✅ |
| `aco_check_adapter "key" \|\| exit 1` | ✅ | ✅ | ✅ |
| YAML frontmatter (name/description/argument-hint/allowed-tools) | ✅ | ✅ | ✅ |
| `aco_adapter_invoke "key" "$PROMPT" "$CONTENT"` | ✅ | ✅ | ✅ |
| Prompt file existence guard | ✅ | ✅ | ✅ |

## 6. Test Correctness

### ✅ Behavioral unit tests (ADV-02, RESC-01, RESC-02, RESC-03)
All 9 behavioral tests in the 08-01 insertion block use pure bash simulation with no external dependencies. They test the exact same regex/substitution logic used in the command files and return 0 on success. ✅

### ⚠️ FLAG-2: `set -euo pipefail` causes Wave 0 RED stubs to exit the script, not record "FAIL"

The test file has `set -euo pipefail`. Wave 0 command-file existence checks are top-level `[[ -f ... ]]` statements:

```bash
[[ -f "${PHASE8_COMMANDS_DIR}/gemini/adversarial.md" ]]
run_test "Wave 0 (08-02): ..." "$?"
```

With `set -e`, when the file doesn't exist (`[[ -f ... ]]` → returns 1), bash **exits immediately** before `run_test` is called. The plan documents the expected state after 08-01 as "4 FAIL (RED) + 15 PASS" — but actual behavior is abrupt exit with no summary line. Executor may misread this as 08-01 failure.

**Impact on final goal**: None. All files present after all 3 plans → all `[[ -f ]]` checks pass → test suite exits 0. ✅

**Impact on intermediate verification**: Misleading. The plan should document: "running the test suite after 08-01 will exit with code 1 when it reaches the first Wave 0 RED check — this is expected and not a failure of 08-01."

**Fix (preferred)**: Change existence checks to capture result without triggering `set -e` exit:
```bash
[[ -f "${PHASE8_COMMANDS_DIR}/gemini/adversarial.md" ]] && _r=0 || _r=1
run_test "Wave 0 (08-02): .claude/commands/gemini/adversarial.md exists" "$_r"
```

## 7. Key Links / Wiring

```
08-01: prompts/gemini/adversarial.md   ─┐
08-01: prompts/copilot/adversarial.md  ─┤─► 08-02 loads + dispatches via aco_adapter_invoke
08-01: prompts/gemini/rescue.md        ─┤
08-01: prompts/copilot/rescue.md       ─┘─► 08-03 loads + dispatches via aco_adapter_invoke
08-02: commands/gemini/adversarial.md  → Wave 0 test turns GREEN
08-02: commands/copilot/adversarial.md → Wave 0 test turns GREEN
08-03: commands/gemini/rescue.md       → Wave 0 test turns GREEN
08-03: commands/copilot/rescue.md      → Wave 0 test turns GREEN
```

No orphaned artifacts. All wiring planned explicitly. ✅

---

## Issues

### ⚠️ FLAG-1 — Bash correctness — 08-02 Tasks 1-2, 08-03 Tasks 1-2

`${ARGS## }` strips only one leading space. Double-space input (`--focus security  src/auth.ts`) produces `FILE_ARG=" src/auth.ts"` → "file not found" error.

**Fix**: `ARGS="${ARGS#"${ARGS%%[! ]*}"}"` (one-liner full leading-space trim)

### ⚠️ FLAG-2 — Test correctness — 08-01 Task 3

Wave 0 RED existence checks (`[[ -f ... ]]`) under `set -euo pipefail` cause the test script to exit abruptly rather than recording FAIL counts. The plan's intermediate verification description ("4 FAIL expected") is inaccurate.

**Fix**: Capture result with `_r` variable pattern (see above) or explicitly document the exit behavior.

---

## Final Verdict

**FLAG** — Plans are architecturally sound and complete. All 6 requirements and all 6 success criteria are fully covered. Bash logic is correct for all documented use cases. Wave discipline is correct. Phase 7 patterns are consistently followed.

The two flagged issues are edge-case bugs that do not block the phase goal. The final state after all three plans achieves every success criterion. Recommend fixing FLAG-2 before execution to avoid executor confusion during the 08-01 verification step.
