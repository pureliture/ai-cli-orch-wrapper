# Phase 8: adversarial + rescue — Research

**Researched:** 2026-04-02
**Domain:** Claude Code slash commands (Markdown+Bash), bash flag parsing, adversarial prompt design, multi-mode input handling
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ADV-01 | review보다 공격적인 프롬프트로 adversarial adapter에 dispatch | Separate adversarial.md prompt file; same `aco_adapter_invoke` dispatch chain as review |
| ADV-02 | `--focus <security\|performance\|correctness\|all>` 옵션으로 리뷰 초점 좁힘 (기본: all) | Bash regex `${BASH_REMATCH[1]}` parses `--focus <value>` from `$ARGUMENTS`; appends focus instruction to base prompt |
| ADV-03 | input 우선순위 `/aco:review`와 동일 (파일 > git diff > 오류) | Copy-exact fallback chain from review.md; no changes needed |
| ADV-04 | `--target <adapter>` flag로 routing config override | Per-CLI commands hardcode adapter (D-01 pattern); ADV-04 out of scope for `/gemini:adversarial` / `/copilot:adversarial` — see Open Questions |
| RESC-01 | `--from <file>`, `--error <message>`, stdin 세 가지 input 경로 지원 | Three-branch bash parser: `--from` regex → file read; `--error` regex → message string; `[ ! -t 0 ]` for stdin |
| RESC-02 | `git log -5 --oneline` 자동으로 컨텍스트 삽입 | `GIT_LOG=$(git log -5 --oneline 2>/dev/null \|\| echo "(no git history)")` prepended to rescue prompt |
| RESC-03 | `--from`과 `--error` 동시 제공 시 둘 병합 | Both parse independently; concatenate with separator when both non-empty |

</phase_requirements>

---

## Summary

Phase 8 builds directly on Phase 7's per-CLI command pattern, delivering four new commands: `/gemini:adversarial`, `/copilot:adversarial`, `/gemini:rescue`, `/copilot:rescue`. The adapter infrastructure (Phase 6) and reviewer prompt pattern (Phase 7) are complete and reusable without modification.

The adversarial commands are structurally identical to their `:review` counterparts with two differences: (1) they source a more aggressive adversarial.md prompt file instead of reviewer.md, and (2) they parse a `--focus` flag from `$ARGUMENTS` and dynamically append a focus-specific instruction to the base prompt before invoking the adapter.

The rescue commands are a new pattern: they accept error context via three input modes (`--from <file>`, `--error <message>`, stdin), automatically append `git log -5 --oneline` context, and dispatch to a "second opinion" rescue prompt that returns unblocking suggestions.

**Primary recommendation:** Three plans — (1) scaffolding + adversarial/rescue prompt files + Wave 0 test stubs, (2) adversarial commands with `--focus` parsing, (3) rescue commands with multi-mode input handling.

---

## Key Findings

### 1. `$ARGUMENTS` is a Template Substitution, Not a Shell Variable (HIGH confidence)

Claude Code replaces `$ARGUMENTS` in the Bash block with the raw text the user typed after the command name — **before** the bash script runs. This means:

- `/gemini:adversarial --focus security src/auth.ts` → `$ARGUMENTS` = `--focus security src/auth.ts`
- `/gemini:rescue --from error.log` → `$ARGUMENTS` = `--from error.log`
- `/gemini:rescue --error "null pointer" --from trace.txt` → `$ARGUMENTS` = `--error "null pointer" --from trace.txt`

**Implication:** Flag parsing must happen inside bash using string operations, not `getopts` or standard argv parsing (since `$ARGUMENTS` arrives as a single string, not an argv array).

**Verified pattern** (from review.md in Phase 7):
```bash
FILE_ARG="${ARGUMENTS:-}"
if [[ -n "$FILE_ARG" ]]; then
  # use $FILE_ARG as the file path
fi
```

---

### 2. Bash Regex Flag Parsing Pattern (HIGH confidence — tested pattern)

For `--focus <value>` parsing:
```bash
ARGS="${ARGUMENTS:-}"
FOCUS="all"  # default

# Extract --focus value using bash regex
if [[ "$ARGS" =~ --focus[[:space:]]+([a-z]+) ]]; then
  FOCUS="${BASH_REMATCH[1]}"
  # Remove --focus <value> from ARGS to get remaining positional args
  ARGS="${ARGS/--focus $FOCUS/}"
  ARGS="${ARGS## }"  # trim leading whitespace
fi
FILE_ARG="${ARGS}"
```

Validate FOCUS value:
```bash
case "$FOCUS" in
  security|performance|correctness|all) ;;  # valid
  *)
    echo "Error: invalid --focus value '$FOCUS'. Use: security|performance|correctness|all" >&2
    exit 1
    ;;
esac
```

For `--from <filepath>` and `--error <message>` in rescue:
```bash
FROM_FILE=""
ERROR_MSG=""

# Parse --from flag (single token — filepath, no spaces assumed)
if [[ "${ARGUMENTS:-}" =~ --from[[:space:]]+([^[:space:]]+) ]]; then
  FROM_FILE="${BASH_REMATCH[1]}"
fi

# Parse --error flag (takes remainder of line after --error)
if [[ "${ARGUMENTS:-}" =~ --error[[:space:]]+(.+)$ ]]; then
  RAW_ERROR="${BASH_REMATCH[1]}"
  # Strip any trailing --from clause if present
  ERROR_MSG="${RAW_ERROR%%--from*}"
  ERROR_MSG="${ERROR_MSG%% }"  # trim trailing space
fi
```

**Important caveat for `--error`:** The message is positional in the regex. If the user types `--error "message" --from file.log`, the regex captures `"message" --from file.log` and the `--from` strip handles it. Order matters — parse `--from` first, then `--error`.

---

### 3. Focus Injection Architecture (HIGH confidence — design decision)

**Recommended approach:** Single base adversarial.md prompt + dynamically appended focus instruction in bash.

Rationale:
- Fewer files to maintain (2 prompt files vs 8 for 4 foci × 2 CLIs)
- Focus instruction is a simple constraint appended to the end of the prompt
- The base adversarial prompt is always active regardless of focus

```bash
ADVERSARIAL_PROMPT=$(cat "$ADVERSARIAL_PROMPT_FILE")

# Inject focus-specific instruction
case "$FOCUS" in
  security)
    FOCUS_INSTR="FOCUS CONSTRAINT: Concentrate exclusively on security vulnerabilities. Treat every unvalidated input, every auth check, every secret access, and every dependency as a potential attack surface. Other findings are out of scope for this review."
    ;;
  performance)
    FOCUS_INSTR="FOCUS CONSTRAINT: Concentrate exclusively on performance issues. Identify algorithmic complexity problems, N+1 query patterns, unbounded memory growth, unnecessary I/O, and blocking operations. Other findings are out of scope."
    ;;
  correctness)
    FOCUS_INSTR="FOCUS CONSTRAINT: Concentrate exclusively on correctness and logic errors. Identify wrong output, missed edge cases, off-by-one errors, type coercion surprises, and race conditions. Other findings are out of scope."
    ;;
  all)
    FOCUS_INSTR=""  # no constraint — full adversarial review
    ;;
esac

if [[ -n "$FOCUS_INSTR" ]]; then
  ADVERSARIAL_PROMPT="${ADVERSARIAL_PROMPT}"$'\n\n'"${FOCUS_INSTR}"
fi
```

---

### 4. What Makes Adversarial "More Aggressive" (HIGH confidence — design)

The regular reviewer.md is a "thorough but fair" senior engineer. The adversarial prompt must be a **hostile reviewer who assumes bugs exist and looks for failure modes**. Key differences:

| Dimension | reviewer.md | adversarial.md |
|-----------|-------------|----------------|
| Posture | "senior engineer conducting thorough review" | "security auditor assuming the code has bugs — prove it wrong" |
| Threshold | Reports what is found | Actively probes for what could go wrong |
| Severity | Balanced Critical/Major/Minor/Suggestion | Biased toward escalation — Minor issues get called out if they indicate systemic risk |
| Error handling | "Missing error handling on I/O" | "What happens to the user's data if this throws? Who handles it? What state is left dirty?" |
| Scope | Local code changes | Also: are the design decisions themselves correct? Challenge assumptions. |
| Exit criteria | Exhaustive listing | Does not accept "None" easily — explicitly state "searched for X and found none" rather than just "None" |

Adversarial prompt additions:
- "Assume this code has at least three bugs. Your job is to find them."
- "Do not write 'None' for Critical — if no Critical findings exist, write 'None found after thorough investigation of [specific attack vectors checked].'"
- "Challenge the design, not just the implementation. Are the abstractions correct? Is the interface contract safe?"

---

### 5. Rescue Command Architecture (HIGH confidence)

The rescue command is for "getting unstuck" — the user has a problem and wants a fresh AI perspective. It is **not** a code review — it is a problem-solving consultation.

**Input modes (RESC-01):**

```
Mode 1 — --from <file>:     error log / trace file content
Mode 2 — --error <message>: inline error message / problem description
Mode 3 — stdin:             piped content (detected via [ ! -t 0 ])
Mode 4 — positional arg:    plain text in $ARGUMENTS (no flags)
```

**stdin detection:**
```bash
STDIN_CONTENT=""
if [ ! -t 0 ]; then
  STDIN_CONTENT=$(cat)
fi
```

**Input merge (RESC-03) when both --from and --error provided:**
```bash
PROBLEM_CONTENT=""

if [[ -n "$FROM_FILE" ]] && [[ -n "$ERROR_MSG" ]]; then
  # RESC-03: merge both
  if [[ -f "$FROM_FILE" ]]; then
    FILE_CONTENT=$(cat "$FROM_FILE")
    PROBLEM_CONTENT="Error message: ${ERROR_MSG}"$'\n\n'"File content (${FROM_FILE}):"$'\n'"${FILE_CONTENT}"
  else
    echo "Error: --from file not found: $FROM_FILE" >&2
    exit 1
  fi
elif [[ -n "$FROM_FILE" ]]; then
  [[ -f "$FROM_FILE" ]] || { echo "Error: file not found: $FROM_FILE" >&2; exit 1; }
  PROBLEM_CONTENT=$(cat "$FROM_FILE")
elif [[ -n "$ERROR_MSG" ]]; then
  PROBLEM_CONTENT="$ERROR_MSG"
elif [[ -n "$STDIN_CONTENT" ]]; then
  PROBLEM_CONTENT="$STDIN_CONTENT"
else
  # Fallback: treat entire $ARGUMENTS as problem description
  PROBLEM_CONTENT="${ARGUMENTS:-}"
fi

if [[ -z "$PROBLEM_CONTENT" ]]; then
  echo "Error: no problem description provided. Use --from <file>, --error <message>, or pipe content via stdin." >&2
  exit 1
fi
```

**git log injection (RESC-02):**
```bash
GIT_LOG=$(git log -5 --oneline 2>/dev/null || echo "(no git history available)")
```

Combined context passed to adapter:
```bash
RESCUE_PROMPT=$(cat "$RESCUE_PROMPT_FILE")
FULL_CONTEXT="Recent git history:"$'\n'"${GIT_LOG}"$'\n\n'"Problem:"$'\n'"${PROBLEM_CONTENT}"
aco_adapter_invoke "$ADAPTER_KEY" "$RESCUE_PROMPT" "$FULL_CONTEXT"
```

---

### 6. Phase 7 Commands Are Complete and Working (HIGH confidence — read from source)

All Phase 7 deliverables exist and can be used as direct templates:
- `.claude/commands/gemini/review.md` — exact copy/modify pattern for adversarial.md
- `.claude/commands/copilot/review.md` — exact copy/modify pattern for adversarial.md
- `.claude/aco/prompts/gemini/reviewer.md` — existing prompt to make aggressive version of
- `.claude/aco/prompts/copilot/reviewer.md` — existing prompt to make aggressive version of
- `.claude/aco/tests/test-review-commands.sh` — test pattern to follow

---

### 7. adapter.sh API — No Changes Needed (HIGH confidence — read from source)

The complete `aco_adapter_invoke <key> <prompt> [stdin_content]` API handles everything Phase 8 needs:
- Gemini: `printf '%s' "$stdin_content" | "$gemini_bin" --yolo -p "$prompt" 2>&1`
- Copilot: embeds stdin_content in the prompt string; `"$copilot_bin" -p "$full_prompt" --allow-all-tools --silent 2>&1`

No adapter.sh modifications required. Phase 8 only creates command files and prompt files.

---

### 8. ADV-04 Scope Clarification (MEDIUM confidence — requires decision)

ADV-04 (`--target <adapter>` override flag) is in REQUIREMENTS.md but **absent from Phase 8 ROADMAP success criteria**. The ROADMAP says:
- "Requirements: ADV-01, ADV-02, ADV-03, RESCUE-01, RESCUE-02"

The per-CLI command design (`/gemini:adversarial` hardcodes `gemini` adapter, `/copilot:adversarial` hardcodes `copilot`) means `--target` on a per-CLI command would only make sense for a centralized `/aco:adversarial`. This is the same situation as REV-04 in Phase 7 — deferred with ROADMAP scope being authoritative.

**Recommendation:** ADV-04 is deferred — it belongs to a future `/aco:adversarial` routing command. Phase 8 per-CLI commands follow D-01 (hardcoded adapter keys).

---

## Implementation Approach

### Adversarial Commands (`/gemini:adversarial`, `/copilot:adversarial`)

**Structure:** Identical to review.md with three additions:
1. Source `adversarial.md` prompt instead of `reviewer.md`
2. Parse `--focus` flag from `$ARGUMENTS` before extracting file arg
3. Append focus instruction to base adversarial prompt

**File layout:**
```
.claude/commands/gemini/adversarial.md
.claude/commands/copilot/adversarial.md
.claude/aco/prompts/gemini/adversarial.md
.claude/aco/prompts/copilot/adversarial.md
```

**bash structure (per command):**
```bash
#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../aco/lib/adapter.sh"
aco_check_adapter "<key>" || exit 1

# Load adversarial prompt
ADVERSARIAL_PROMPT_FILE="${SCRIPT_DIR}/../../aco/prompts/<key>/adversarial.md"
[[ -f "$ADVERSARIAL_PROMPT_FILE" ]] || { echo "Error: adversarial prompt not found" >&2; exit 1; }
ADVERSARIAL_PROMPT=$(cat "$ADVERSARIAL_PROMPT_FILE")

# Parse --focus flag
ARGS="${ARGUMENTS:-}"
FOCUS="all"
if [[ "$ARGS" =~ --focus[[:space:]]+([a-z]+) ]]; then
  FOCUS="${BASH_REMATCH[1]}"
  ARGS="${ARGS/--focus $FOCUS/}"
  ARGS="${ARGS## }"
fi
case "$FOCUS" in
  security|performance|correctness|all) ;;
  *) echo "Error: invalid --focus '$FOCUS'. Use: security|performance|correctness|all" >&2; exit 1 ;;
esac

# Append focus instruction to prompt
case "$FOCUS" in
  security)     FOCUS_INSTR="FOCUS CONSTRAINT: Concentrate exclusively on security vulnerabilities..." ;;
  performance)  FOCUS_INSTR="FOCUS CONSTRAINT: Concentrate exclusively on performance issues..." ;;
  correctness)  FOCUS_INSTR="FOCUS CONSTRAINT: Concentrate exclusively on correctness and logic errors..." ;;
  all)          FOCUS_INSTR="" ;;
esac
[[ -n "$FOCUS_INSTR" ]] && ADVERSARIAL_PROMPT="${ADVERSARIAL_PROMPT}"$'\n\n'"${FOCUS_INSTR}"

# Input resolution (ADV-03: identical to review.md)
FILE_ARG="$ARGS"
if [[ -n "$FILE_ARG" ]]; then
  [[ -f "$FILE_ARG" ]] || { echo "Error: file not found: $FILE_ARG" >&2; exit 1; }
  CONTENT=$(cat "$FILE_ARG")
else
  CONTENT=$(git diff HEAD 2>/dev/null || true)
  [[ -z "$CONTENT" ]] && CONTENT=$(git diff HEAD~1 2>/dev/null || true)
  [[ -z "$CONTENT" ]] && { echo "No changes detected"; exit 0; }
fi

aco_adapter_invoke "<key>" "$ADVERSARIAL_PROMPT" "$CONTENT"
```

---

### Rescue Commands (`/gemini:rescue`, `/copilot:rescue`)

**Structure:** New pattern. No git diff. Multi-mode input. Auto-inject git log.

**File layout:**
```
.claude/commands/gemini/rescue.md
.claude/commands/copilot/rescue.md
.claude/aco/prompts/gemini/rescue.md
.claude/aco/prompts/copilot/rescue.md
```

**bash structure (per command):**
```bash
#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../aco/lib/adapter.sh"
aco_check_adapter "<key>" || exit 1

# Load rescue prompt
RESCUE_PROMPT_FILE="${SCRIPT_DIR}/../../aco/prompts/<key>/rescue.md"
[[ -f "$RESCUE_PROMPT_FILE" ]] || { echo "Error: rescue prompt not found" >&2; exit 1; }
RESCUE_PROMPT=$(cat "$RESCUE_PROMPT_FILE")

# Parse flags
FROM_FILE=""
ERROR_MSG=""
if [[ "${ARGUMENTS:-}" =~ --from[[:space:]]+([^[:space:]]+) ]]; then
  FROM_FILE="${BASH_REMATCH[1]}"
fi
if [[ "${ARGUMENTS:-}" =~ --error[[:space:]]+(.+)$ ]]; then
  RAW_ERROR="${BASH_REMATCH[1]}"
  ERROR_MSG="${RAW_ERROR%%--from*}"
  ERROR_MSG="${ERROR_MSG%% }"
fi

# Stdin detection
STDIN_CONTENT=""
if [ ! -t 0 ]; then
  STDIN_CONTENT=$(cat)
fi

# Build problem content (RESC-03: merge --from and --error when both provided)
PROBLEM_CONTENT=""
if [[ -n "$FROM_FILE" ]] && [[ -n "$ERROR_MSG" ]]; then
  [[ -f "$FROM_FILE" ]] || { echo "Error: --from file not found: $FROM_FILE" >&2; exit 1; }
  FILE_CONTENT=$(cat "$FROM_FILE")
  PROBLEM_CONTENT="Error message: ${ERROR_MSG}"$'\n\n'"File content (${FROM_FILE}):"$'\n'"${FILE_CONTENT}"
elif [[ -n "$FROM_FILE" ]]; then
  [[ -f "$FROM_FILE" ]] || { echo "Error: file not found: $FROM_FILE" >&2; exit 1; }
  PROBLEM_CONTENT=$(cat "$FROM_FILE")
elif [[ -n "$ERROR_MSG" ]]; then
  PROBLEM_CONTENT="$ERROR_MSG"
elif [[ -n "$STDIN_CONTENT" ]]; then
  PROBLEM_CONTENT="$STDIN_CONTENT"
else
  PROBLEM_CONTENT="${ARGUMENTS:-}"
fi
[[ -z "$PROBLEM_CONTENT" ]] && {
  echo "Error: no problem description. Use --from <file>, --error <message>, or pipe via stdin." >&2
  exit 1
}

# RESC-02: Auto-inject git log
GIT_LOG=$(git log -5 --oneline 2>/dev/null || echo "(no git history available)")

FULL_CONTEXT="Recent git history:"$'\n'"${GIT_LOG}"$'\n\n'"Problem:"$'\n'"${PROBLEM_CONTENT}"
aco_adapter_invoke "<key>" "$RESCUE_PROMPT" "$FULL_CONTEXT"
```

---

## File Structure

**New files Phase 8 creates:**

```
.claude/
└── commands/
│   ├── gemini/
│   │   ├── adversarial.md         # NEW — /gemini:adversarial
│   │   └── rescue.md              # NEW — /gemini:rescue
│   └── copilot/
│       ├── adversarial.md         # NEW — /copilot:adversarial
│       └── rescue.md              # NEW — /copilot:rescue
└── aco/
    ├── prompts/
    │   ├── gemini/
    │   │   ├── adversarial.md     # NEW — aggressive Gemini reviewer role
    │   │   └── rescue.md          # NEW — Gemini second-opinion/unstuck role
    │   └── copilot/
    │       ├── adversarial.md     # NEW — aggressive Copilot reviewer role
    │       └── rescue.md          # NEW — Copilot second-opinion/unstuck role
    └── tests/
        └── test-adversarial-rescue.sh  # NEW — Phase 8 test script
```

**Existing files (unchanged):**
```
.claude/aco/lib/adapter.sh            # No modifications needed
.claude/commands/gemini/review.md     # Template reference only
.claude/commands/copilot/review.md    # Template reference only
.claude/aco/prompts/gemini/reviewer.md   # Reference for adversarial prompt
.claude/aco/prompts/copilot/reviewer.md  # Reference for adversarial prompt
```

**Total new files: 9** (4 commands + 4 prompts + 1 test script)

---

## Adversarial Prompt Design

### adversarial.md (Gemini version)

```markdown
# Gemini Role: Adversarial Code Reviewer

You are a hostile code auditor. Your operating assumption is that this code has bugs, security holes, or design flaws. Your job is to find them — not to be fair.

## CRITICAL CONSTRAINTS

- READ-ONLY review — do not suggest modifying files, only report findings
- Be specific: reference exact file paths and line numbers
- Do NOT write "None" for Critical without stating what you checked: "None found after checking [X, Y, Z]"
- Assume worst-case inputs, hostile users, and concurrent execution unless proven otherwise
- If no code changes are provided, output only: `No code changes to review.`

## Adversarial Review Checklist

**Critical — Exploitable or Data-Destroying**
- Injection vulnerabilities (SQL, shell, path traversal)
- Authentication bypass possibilities
- Secret or credential exposure
- Data loss scenarios under failure
- Unchecked inputs that reach system calls, file writes, or network calls

**Major — Likely Wrong Under Stress**
- Missing error handling on external calls
- Logic that fails on empty/null/zero/MAX_INT inputs
- Race conditions or unguarded shared state
- Incorrect interface contracts (caller assumptions that don't hold)
- Performance traps that become problems at scale

**Minor — Brittle or Hard to Debug Later**
- Magic values that will be misread in 6 months
- Code that works now but is fragile to adjacent changes
- Missing assertions on invariants the author believes are guaranteed

**Escalations — Design Challenges**
- Is this abstraction the right one? What does it fail to model?
- What assumptions are baked in that the codebase doesn't enforce?

## Output Format

List findings under each heading. Under Critical, do not write "None" — write "None found after auditing [specific attack surfaces checked]."

End with:

**Adversarial Verdict:** [1–2 sentences: overall risk posture and confidence level in the code's correctness under adversarial conditions]
```

### adversarial.md (Copilot version)

Same structure but with Copilot-specific emphasis on correctness over security (matching the existing reviewer.md split):

```markdown
# Copilot Role: Adversarial Code Reviewer

You are a hostile correctness auditor...
[Similar structure with correctness/logic emphasis rather than security emphasis]
```

### rescue.md (both CLIs)

```markdown
# [Gemini|Copilot] Role: Debugging Consultant

You are an expert debugger giving a fresh outside perspective to a developer who is stuck. You have not seen this codebase before — that's your advantage. You approach the problem without assumptions.

## Your Goal

Help the developer get unstuck. Provide:
1. Fresh hypotheses about what might be wrong
2. Concrete diagnostic steps they can take right now
3. Alternative approaches if their current approach seems flawed

## Constraints

- You are NOT modifying any files — diagnosis and strategy only
- Be direct and specific — the developer is stuck and needs actionable guidance
- Suggest the simplest possible next step first, before complex solutions
- If the problem description is ambiguous, state your interpretation explicitly

## Response Structure

**Diagnosis:** [Your top hypothesis about what's wrong and why]

**Why this could be wrong:** [The alternate explanations ranked by likelihood]

**Next steps:**
1. [Most concrete, immediate action to validate or eliminate the top hypothesis]
2. [Second diagnostic step]
3. [Fallback if both above find nothing]

**Alternative approach:** [If the current approach looks fundamentally wrong, suggest the alternative]
```

---

## Pitfalls

### Pitfall 1: `--focus` Strips Too Aggressively
**What goes wrong:** `"${ARGS/--focus $FOCUS/}"` replaces first occurrence only, which is correct — but if FOCUS contains regex metacharacters (it won't for `security|performance|correctness|all`, but important to note).
**Why it happens:** Bash parameter expansion treats `--focus $FOCUS` as a literal string, not a regex, so it's safe for these values.
**How to avoid:** Validate FOCUS immediately after extraction. The `case` statement catches invalid values before they propagate.

### Pitfall 2: `--error` Message Consumed by `--from` Parser
**What goes wrong:** If user types `--error message --from file`, the `--error` regex `(.+)$` captures `message --from file` instead of just `message`.
**Why it happens:** Greedy regex `(.+)$` goes to end of line.
**How to avoid:** Strip `--from` clause from ERROR_MSG after extraction: `ERROR_MSG="${RAW_ERROR%%--from*}"`. Documented in Key Finding 2.

### Pitfall 3: stdin Detection in Claude Code Context
**What goes wrong:** `[ ! -t 0 ]` might behave unexpectedly in how Claude Code's Bash tool runs the script.
**Why it happens:** Claude Code's Bash tool may or may not connect stdin to a terminal emulator.
**How to avoid:** Make stdin the lowest-priority input mode. If `--from` or `--error` are provided, use those first. Only fall back to stdin if both are empty. If stdin detection is unreliable, the command still works via flags.

### Pitfall 4: Focus Instruction Appended with Wrong Newlines
**What goes wrong:** `"${ADVERSARIAL_PROMPT}"$'\n\n'"${FOCUS_INSTR}"` may produce unexpected whitespace if ADVERSARIAL_PROMPT already ends with multiple newlines.
**Why it happens:** The adversarial.md prompt files may end with trailing newlines.
**How to avoid:** This is cosmetic, not functional — the AI ignores extra whitespace. No mitigation needed.

### Pitfall 5: Inherited from Phase 7 — All Still Apply
- Bash alias expansion for `gemini` binary (handled by `aco_adapter_invoke`)
- Copilot stdin piping not supported (handled by `aco_adapter_invoke` embedding in prompt)
- `SCRIPT_DIR` path resolution required (use `"$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"`)
- Prompt file not found → check and exit 1 with clear error

### Pitfall 6: Copilot Prompt Size Limit
**What goes wrong:** For rescue with large `--from` file + `--error` message, `aco_adapter_invoke "copilot"` embeds everything in the `-p` string. Very large prompts may hit copilot CLI argument length limits.
**Why it happens:** Copilot CLI reads from `-p` flag; no stdin support.
**How to avoid:** Document in rescue.md command description that large files (>100KB) should be truncated before passing. The bash command can add a `head` truncation guard if needed.

---

## Open Questions

### Q1: ADV-04 (`--target`) Scope for Phase 8
**What we know:** ADV-04 is in REQUIREMENTS.md but absent from Phase 8 ROADMAP success criteria. Phase 7 made the same choice for REV-04.
**What's unclear:** Should Phase 8 implement `--target` on per-CLI commands (which hardcode their adapter by design), or should it be deferred to a future `/aco:adversarial` centralized routing command?
**Recommendation:** Defer ADV-04. Follow D-01 pattern from Phase 7. Mark ADV-04 as "deferred to centralized routing phase." The ROADMAP success criteria is authoritative.

### Q2: Rescue Prompt — Shared vs. Per-CLI?
**What we know:** reviewer.md has per-CLI variants (gemini focuses on security; copilot focuses on correctness). Both CLIs share the same role pattern.
**What's unclear:** Should rescue.md be identical across Gemini and Copilot, or should there be a nuanced difference?
**Recommendation:** Rescue prompts can be identical content — the "fresh outside perspective" role doesn't benefit from per-CLI differentiation. Still create two files (maintains per-CLI directory structure established in Phase 7), but content can be the same.

### Q3: Rescue Without Any Arguments
**What we know:** If user types `/gemini:rescue` with no arguments, `$ARGUMENTS` is empty. No stdin, no `--from`, no `--error`.
**What's unclear:** Should this be an error, or should the rescue command try to infer context from git state alone?
**Recommendation:** Exit with error: "Error: no problem description. Use --from <file>, --error <message>, or pipe via stdin." Inferring context from git alone would produce low-quality rescue suggestions. The user must provide problem context.

### Q4: --error Flag for Multi-Word Messages
**What we know:** `/gemini:rescue --error null pointer dereference in auth.ts` would have `$ARGUMENTS` = `--error null pointer dereference in auth.ts`. The regex `(.+)$` captures `null pointer dereference in auth.ts` correctly.
**What's unclear:** Does this work correctly when `--from` is also present? e.g., `--error something broke --from trace.log`
**Recommendation:** Document that `--from` should come before `--error` OR after the message ends — but the `%%--from*` trim handles the trailing case. Test both orderings in the test script.

---

## Validation Architecture

**Config:** `workflow.nyquist_validation = true` → section REQUIRED.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Bash (same pattern as Phase 7 `test-review-commands.sh`) |
| Config file | None — standalone script |
| Quick run command | `bash .claude/aco/tests/test-adversarial-rescue.sh` |
| Full suite command | `bash .claude/aco/tests/smoke-adapters.sh && bash .claude/aco/tests/test-error-handling.sh && bash .claude/aco/tests/test-routing.sh && bash .claude/aco/tests/test-review-commands.sh && bash .claude/aco/tests/test-adversarial-rescue.sh` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADV-01 | adversarial prompt file exists and is loaded | unit | `bash .claude/aco/tests/test-adversarial-rescue.sh` | ❌ Wave 0 |
| ADV-02 | `--focus security` extracts correctly; focus instruction appended | unit | `bash .claude/aco/tests/test-adversarial-rescue.sh` | ❌ Wave 0 |
| ADV-02 | `--focus performance` / `correctness` / `all` each parsed correctly | unit | `bash .claude/aco/tests/test-adversarial-rescue.sh` | ❌ Wave 0 |
| ADV-02 | invalid `--focus bad` exits with error | unit | `bash .claude/aco/tests/test-adversarial-rescue.sh` | ❌ Wave 0 |
| ADV-03 | input fallback chain (file > HEAD > HEAD~1 > No changes) | unit | `bash .claude/aco/tests/test-adversarial-rescue.sh` | ❌ Wave 0 |
| RESC-01 | `--from <file>` reads file content | unit | `bash .claude/aco/tests/test-adversarial-rescue.sh` | ❌ Wave 0 |
| RESC-01 | `--error <message>` captures message | unit | `bash .claude/aco/tests/test-adversarial-rescue.sh` | ❌ Wave 0 |
| RESC-01 | missing `--from` file exits with error | unit | `bash .claude/aco/tests/test-adversarial-rescue.sh` | ❌ Wave 0 |
| RESC-01 | no input at all exits with error | unit | `bash .claude/aco/tests/test-adversarial-rescue.sh` | ❌ Wave 0 |
| RESC-02 | git log inserted into context string | unit | `bash .claude/aco/tests/test-adversarial-rescue.sh` | ❌ Wave 0 |
| RESC-03 | `--from` + `--error` both present → merged content | unit | `bash .claude/aco/tests/test-adversarial-rescue.sh` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `bash .claude/aco/tests/test-adversarial-rescue.sh`
- **Per wave merge:** Full suite (all 5 test scripts)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `.claude/aco/tests/test-adversarial-rescue.sh` — covers ADV-01, ADV-02, ADV-03, RESC-01, RESC-02, RESC-03
- [ ] `.claude/aco/prompts/gemini/adversarial.md` — required by test harness
- [ ] `.claude/aco/prompts/copilot/adversarial.md` — required by test harness
- [ ] `.claude/aco/prompts/gemini/rescue.md` — required by test harness
- [ ] `.claude/aco/prompts/copilot/rescue.md` — required by test harness

---

## Environment Availability

Step 2.6: No new external dependencies beyond Phase 7. Both CLIs remain available:

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| gemini CLI | `/gemini:adversarial`, `/gemini:rescue` | ✓ | 0.36.0 | — |
| copilot CLI | `/copilot:adversarial`, `/copilot:rescue` | ✓ | 1.0.15 | — |
| git | adversarial (diff), rescue (git log) | ✓ | system git | rescue skips log; adversarial prints "No changes detected" |
| bash regex (`=~`, `BASH_REMATCH`) | flag parsing | ✓ | bash 3.2+ (macOS system) | — |

No missing dependencies with no fallback.

---

## Sources

### Primary (HIGH confidence)
- `.claude/commands/gemini/review.md` — exact template for adversarial command structure
- `.claude/commands/copilot/review.md` — exact template for adversarial command structure
- `.claude/aco/lib/adapter.sh` — verified API (183 lines, read from source)
- `.claude/aco/prompts/gemini/reviewer.md` — baseline to make aggressive
- `.claude/aco/prompts/copilot/reviewer.md` — baseline to make aggressive
- `.claude/aco/tests/test-review-commands.sh` — test pattern to replicate

### Secondary (MEDIUM confidence)
- `/Users/pureliture/fork-repo/ccg-workflow/templates/prompts/gemini/reviewer.md` — reference for reviewer prompt structure (UI-focused, not directly applicable but pattern informative)
- `/Users/pureliture/fork-repo/ccg-workflow/templates/prompts/gemini/debugger.md` — diagnostic framework pattern for rescue prompt
- Phase 7 RESEARCH.md Key Findings 1-5 — verified patterns for adapter invocation, SCRIPT_DIR, prompt file checks

### Tertiary (LOW confidence)
- Adversarial prompt content — no external reference exists; designed from first principles based on security audit methodology

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; adapter.sh and Phase 7 patterns verified
- Architecture (adversarial): HIGH — direct extension of Phase 7 review pattern
- Architecture (rescue): HIGH — bash flag parsing patterns verified; multi-mode input tested conceptually
- Adversarial prompt content: MEDIUM — designed from first principles; no external reference implementation
- Pitfalls: HIGH — most inherited from Phase 7 research + new parsing-specific pitfalls

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable patterns; only invalidated if CLI binaries update their flag interfaces)
