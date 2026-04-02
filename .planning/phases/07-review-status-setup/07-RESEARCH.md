# Phase 7: review + status + setup - Research

**Researched:** 2026-04-02
**Domain:** Claude Code slash commands (Markdown+Bash), adapter.sh API, Gemini CLI, Copilot CLI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01** — Per-CLI namespace wins. Commands live in `.claude/commands/gemini/` and `.claude/commands/copilot/` directories, one file per command (`review.md`, `status.md`, `setup.md`). No routing config involvement — each command hardcodes its adapter key (`gemini` or `copilot`).
- **D-02** — Port the ccg-workflow `reviewer.md` role file pattern. Create `.claude/aco/prompts/gemini/reviewer.md` and `.claude/aco/prompts/copilot/reviewer.md`. The reviewer prompt instructs the CLI to output findings structured as Critical / Major / Minor / Suggestion.
- **D-03** — Follow ccg-workflow/codex-plugin-cc output pattern. The `reviewer.md` role file controls output structure. The slash command passes output through verbatim — no extra wrapping by the bash layer.
- **D-04** — Follow codex-plugin-cc/ccg-workflow reference for setup commands. Include install command + required auth steps.
- **D-05** — All commands source `.claude/aco/lib/adapter.sh`. Use `aco_check_adapter <key>` for missing CLI error, `aco_adapter_invoke <key> <prompt>` for dispatch, `aco_adapter_version <key>` for status.

### Claude's Discretion

- Exact reviewer.md prompt wording (structure of Critical/Major/Minor/Suggestion sections, tone)
- Internal bash variable naming in each slash command
- Whether to add a brief summary line before verbatim CLI output (e.g., "## Gemini Review") — minimal is preferred, but acceptable if it aids readability

### Deferred Ideas (OUT OF SCOPE)

- `/aco:review --target <adapter>` centralized routing command — Phase 8 or later
- Multi-model parallel review (ccg-workflow style cross-validation) — out of scope for Phase 7
- `--focus` flag for scoped review — Phase 8 (`/gemini:adversarial --focus security`)
- Background task execution (`--background` flag) — Phase 9
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REV-01 | `git diff HEAD`를 해당 CLI에 dispatch하고 응답을 verbatim 반환 | `aco_adapter_invoke "gemini"` and `"copilot"` confirmed working; git diff collection pattern confirmed |
| REV-02 | 파일 경로 인자를 받으면 해당 파일 내용을 review 대상으로 사용 | Bash `cat "$ARG"` → pass as stdin_content to `aco_adapter_invoke` |
| REV-03 | `git diff HEAD` 없으면 `git diff HEAD~1` 시도, 그래도 없으면 "No changes detected" | Standard bash fallback pattern, documented below |
| STAT-01 | 각 CLI의 가용성(`✓`/`✗`)과 버전을 출력 | `aco_adapter_available` + `aco_adapter_version` confirmed API |
| STAT-02 | 현재 routing 설정 출력 (per-CLI scope) | See Open Questions — STAT-02 scope ambiguity flagged |
| SETUP-01 | 각 CLI의 설치 명령어 + 필수 인증 단계를 출력 | Install hints from adapter.sh; auth steps from CLI docs |
</phase_requirements>

---

## Summary

Phase 7 builds on the complete Phase 6 adapter infrastructure to deliver 6 per-CLI slash commands across two adapter namespaces (gemini and copilot). The Phase 6 `adapter.sh` library is fully functional and covers all required dispatch operations. Both target CLIs are installed on the development machine (gemini 0.36.0, copilot 1.0.15).

The implementation is entirely Markdown+Bash — no TypeScript. The 6 slash command files live in new directories (`.claude/commands/gemini/`, `.claude/commands/copilot/`), and 2 reviewer prompt files live in `.claude/aco/prompts/`. A test script follows the Phase 6 bash test pattern in `.claude/aco/tests/`.

One notable discrepancy: `.wrapper.json` has `schemaVersion: "2.0"` but the `routing` block (expected to be added in Phase 6 Plan 03) is absent from the file. Phase 7 commands hardcode their adapter keys (D-01), so this does not block Phase 7 execution. However STAT-02's "routing table output" feature needs this block — see Open Questions.

**Primary recommendation:** Three plans — (1) scaffolding + reviewer prompts, (2) review commands + tests, (3) status + setup commands.

---

## Key Finding 1: adapter.sh Exact API (HIGH confidence — read from source)

**File:** `.claude/aco/lib/adapter.sh` (183 lines, fully implemented)

```bash
# Source this file at the top of any slash command:
#   source ".claude/aco/lib/adapter.sh"

# aco_adapter_available <key>
# Returns 0 if the adapter binary is in PATH; 1 otherwise.
# Example: aco_adapter_available "gemini"
aco_adapter_available() { ... }

# aco_adapter_version <key>
# Prints version string (or "unavailable" if not installed).
# Example: aco_adapter_version "copilot"
aco_adapter_version() { ... }

# aco_check_adapter <key>
# Returns 0 if available. On failure: prints named error + install hint to stderr; returns 1.
# Error format: "Error: adapter '<key>' is not installed. Install it first:"
# Example: aco_check_adapter "gemini" || exit 1
aco_check_adapter() { ... }

# aco_adapter_invoke <key> <prompt> [stdin_content]
# Spawns the adapter CLI, optionally piping stdin_content, captures stdout.
# Returns the adapter's exit code.
# Example: aco_adapter_invoke "gemini" "$reviewer_prompt" "$diff_content"
aco_adapter_invoke() { ... }

# _read_routing_adapter <cmd> <default>
# Reads routing adapter key from .wrapper.json; falls back to <default> on any error.
# jq preferred; python3 fallback for portability.
# Example: ADAPTER=$(_read_routing_adapter "review" "gemini")
_read_routing_adapter() { ... }
```

### Internal invocation details (critical for correctness)

**Gemini:**
```bash
# From adapter.sh source — verified
printf '%s' "$stdin_content" | "$gemini_bin" --yolo -p "$prompt" 2>&1
# Requires --yolo for auto-approving tool calls in headless mode
# stdin_content (diff/file) passed via stdin; prompt via -p flag
# bash scripts do NOT expand shell aliases — must use $(command -v gemini)
```

**Copilot:**
```bash
# From adapter.sh source — verified
# Copilot embeds stdin_content in the prompt (no stdin piping support)
full_prompt="${stdin_content}"$'\n\n'"${prompt}"
"$copilot_bin" -p "$full_prompt" --allow-all-tools --silent 2>&1
# --allow-all-tools: required for non-interactive mode
# --silent: suppresses stats output
```

---

## Key Finding 2: Slash Command File Format (HIGH confidence — read from source)

Based on `.claude/commands/gsd/do.md` pattern and CONTEXT.md guidance:

```markdown
---
name: gemini:review
description: Delegate code review to Gemini CLI (git diff or file)
argument-hint: "[path/to/file.ts]"
allowed-tools:
  - Bash
  - Read
---

Short description of what the command does.

```bash
#!/usr/bin/env bash
# Source shared adapter library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../aco/lib/adapter.sh"

# ... bash implementation
```
```

**Key pattern:** The bash block is a complete self-contained shell script. Claude Code executes it via the Bash tool. The adapter.sh is sourced using a relative path from the command file's own location.

**Directory paths from commands:**
- `/gemini:review` is at `.claude/commands/gemini/review.md`
- Shell path to adapter.sh: `${SCRIPT_DIR}/../../aco/lib/adapter.sh` → `.claude/aco/lib/adapter.sh` ✓
- Shell path to reviewer.md: `${SCRIPT_DIR}/../../aco/prompts/gemini/reviewer.md` ✓

---

## Key Finding 3: reviewer.md Prompt Pattern (MEDIUM confidence — adapted from ccg-workflow)

Reference: `/Users/pureliture/fork-repo/ccg-workflow/templates/prompts/gemini/reviewer.md` and `codex/reviewer.md`

The ccg-workflow patterns are UI-focused (Gemini) and backend-focused (Codex). For this project, both reviewers should be **general code reviewers** with different emphasis, adapted to the single-model pattern.

### Gemini reviewer.md (adapt from ccg-workflow codex/reviewer.md)
Focus: code quality, security, error handling. Output structure: Critical / Major / Minor / Suggestion.

### Copilot reviewer.md (adapt from ccg-workflow codex/reviewer.md)
Focus: correctness, logic, edge cases, maintainability. Output structure: same.

### Common reviewer template structure:
```markdown
# [Gemini|Copilot] Role: Code Reviewer

You are a senior code reviewer. Review the provided code changes.

## CRITICAL CONSTRAINTS
- READ-ONLY — do not modify any files
- OUTPUT FORMAT: structured review with severity levels

## Review Checklist
### Critical (must fix before merge)
- Security vulnerabilities, data loss risks, broken auth
### Major (should fix)  
- Logic errors, missing error handling, performance bugs
### Minor (recommended)
- Code quality, naming, missing tests
### Suggestions (optional)
- Refactoring opportunities, style improvements

## Output Format
Output findings grouped by severity:
**Critical:** [list or "None"]
**Major:** [list or "None"]
**Minor:** [list or "None"]
**Suggestions:** [list or "None"]
**Summary:** [1-2 sentence overall assessment]
```

---

## Key Finding 4: review Command Logic Pattern (HIGH confidence)

### Input resolution (REV-01, REV-02, REV-03):

```bash
#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../aco/lib/adapter.sh"

# 1. Check adapter availability
aco_check_adapter "gemini" || exit 1

# 2. Resolve input (REV-02 > REV-01 fallback chain > REV-03 error)
if [[ -n "$1" ]]; then
  # REV-02: file path argument provided
  if [[ ! -f "$1" ]]; then
    echo "Error: file not found: $1" >&2
    exit 1
  fi
  CONTENT=$(cat "$1")
  TARGET="$1"
else
  # REV-01 + REV-03: git diff fallback chain
  CONTENT=$(git diff HEAD 2>/dev/null)
  if [[ -z "$CONTENT" ]]; then
    CONTENT=$(git diff HEAD~1 2>/dev/null)
  fi
  if [[ -z "$CONTENT" ]]; then
    echo "No changes detected"
    exit 0
  fi
  TARGET="git diff"
fi

# 3. Load reviewer prompt role
REVIEWER_PROMPT=$(cat "${SCRIPT_DIR}/../../aco/prompts/gemini/reviewer.md")

# 4. Invoke adapter and pass output verbatim (D-03)
aco_adapter_invoke "gemini" "$REVIEWER_PROMPT" "$CONTENT"
```

---

## Key Finding 5: status Command Pattern (HIGH confidence)

```bash
#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../aco/lib/adapter.sh"

KEY="gemini"

if aco_adapter_available "$KEY"; then
  VERSION=$(aco_adapter_version "$KEY")
  echo "✓ gemini  $VERSION"
else
  echo "✗ gemini  (not installed)"
  echo "  Install: npm install -g @google/gemini-cli"
fi
```

---

## Key Finding 6: setup Command Content (HIGH confidence from adapter.sh install hints + CLI docs)

### Gemini setup:
```
Install:
  npm install -g @google/gemini-cli

Authenticate:
  gemini auth login
  (or run `gemini` interactively and follow OAuth prompts)

Verify:
  gemini --version
```

### Copilot setup:
```
Install:
  npm install -g @github/copilot

Prerequisites:
  gh auth login  (GitHub CLI must be installed and authenticated)

Verify:
  copilot --version
```

---

## Key Finding 7: Test Pattern (HIGH confidence — read from source)

From `.claude/aco/tests/smoke-adapters.sh` and `test-error-handling.sh`:

```bash
#!/usr/bin/env bash
# test-review-commands.sh — Tests for REV-01, REV-02, REV-03, STAT-01
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ADAPTER_LIB="${SCRIPT_DIR}/../lib/adapter.sh"
source "$ADAPTER_LIB"

PASS=0
FAIL=0

run_test() {
  local name="$1"
  local result="$2"
  if [[ "$result" -eq 0 ]]; then
    echo "PASS: $name"; PASS=$((PASS + 1))
  else
    echo "FAIL: $name" >&2; FAIL=$((FAIL + 1))
  fi
}

# REV-03: "No changes detected" when no diff
# (Simulate with empty content logic test)

# STAT-01: aco_adapter_available returns result
aco_adapter_available "gemini" && STAT=0 || STAT=$?
run_test "gemini availability check returns 0 or 1 (not crash)" "[[ $STAT -eq 0 || $STAT -eq 1 ]]" ... 

echo "Results: ${PASS} passed, ${FAIL} failed"
[[ "$FAIL" -eq 0 ]]
```

**Key pattern differences from Phase 6 tests:**
- Tests for review logic must test the fallback chain (git diff HEAD → HEAD~1 → "No changes detected")
- Status tests check that `aco_adapter_available` + `aco_adapter_version` behave correctly for both available and missing adapters
- Test file location: `.claude/aco/tests/test-review-commands.sh`

---

## Key Finding 8: Environment Availability

| Dependency | Required By | Available | Version | Notes |
|------------|------------|-----------|---------|-------|
| gemini CLI | `/gemini:*` commands | ✓ | 0.36.0 (upgraded from 0.35.3 in Phase 6 research) | At `/opt/homebrew/bin/gemini` |
| copilot CLI | `/copilot:*` commands | ✓ | 1.0.15 (upgraded from 1.0.11 in Phase 6 research) | At `/opt/homebrew/bin/copilot` |
| git | review commands (diff) | ✓ | system git | Required for `git diff HEAD` |
| jq or python3 | `_read_routing_adapter` | ✓ | both available | jq preferred, python3 fallback |

---

## Key Finding 9: .wrapper.json Discrepancy

**Expected state (per Phase 6-03 SUMMARY):** `.wrapper.json` should have `routing.review = "gemini"` and `routing.adversarial = "copilot"`.

**Actual state (read from file 2026-04-02):**
```json
{
  "_comment": "...",
  "schemaVersion": "2.0",
  "aliases": { ... },
  "roles": { "orchestrator": "claude_code", "reviewer": "gemini_cli" }
}
```

**No `routing` block present.** The Phase 6-03 plan said it was added (commit `36b6981`) but the file doesn't reflect this. Two possibilities:
1. The git commit was made on a branch that wasn't merged, OR
2. The file was rolled back

**Impact on Phase 7:** NONE — Phase 7 commands hardcode adapter keys (D-01). The `_read_routing_adapter` function is available but not used by per-CLI commands.

**Impact on STAT-02:** If the `/gemini:status` command is supposed to show routing table, the routing block needs to exist. Since Phase 7 success criteria (ROADMAP) only mentions availability + version (not routing table), the routing block add can be deferred.

**Recommendation for planner:** Add the routing block to `.wrapper.json` in Phase 7 Plan 1 (scaffolding) as a fix to the Phase 6 discrepancy. Cost is minimal (2-line JSON addition).

---

## Architecture Patterns

### Recommended Project Structure (Phase 7 additions)

```
.claude/
├── commands/
│   ├── gemini/                    # NEW — create this directory
│   │   ├── review.md              # /gemini:review
│   │   ├── status.md              # /gemini:status
│   │   └── setup.md               # /gemini:setup
│   └── copilot/                   # NEW — create this directory
│       ├── review.md              # /copilot:review
│       ├── status.md              # /copilot:status
│       └── setup.md               # /copilot:setup
└── aco/
    ├── lib/
    │   └── adapter.sh             # EXISTING (Phase 6, complete)
    ├── prompts/                   # NEW — create this directory
    │   ├── gemini/
    │   │   └── reviewer.md        # Gemini reviewer role file
    │   └── copilot/
    │       └── reviewer.md        # Copilot reviewer role file
    └── tests/
        ├── smoke-adapters.sh      # EXISTING (Phase 6)
        ├── test-error-handling.sh # EXISTING (Phase 6)
        ├── test-routing.sh        # EXISTING (Phase 6)
        └── test-review-commands.sh # NEW — Phase 7 tests
.wrapper.json                      # ADD routing block (fix Phase 6 discrepancy)
```

### Anti-Patterns to Avoid

- **Don't duplicate adapter logic in each command file**: All adapter calls go through `adapter.sh` functions (D-05). No inline binary calls.
- **Don't add extra output wrapping beyond minimal header**: Per D-03, reviewer output passes through verbatim. No extra markdown wrappers.
- **Don't use absolute paths for adapter.sh**: Use `SCRIPT_DIR`-relative paths so commands work regardless of project location.
- **Don't silently swallow `aco_adapter_invoke` failures**: Propagate exit codes; let Claude surface errors to the user.
- **Don't call gemini/copilot binary directly in command scripts**: Always go through `aco_adapter_invoke`; it handles the --yolo / --allow-all-tools quirks correctly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CLI availability check | custom `which`/`type` command | `aco_adapter_available <key>` | Already in adapter.sh; handles edge cases |
| Missing CLI error + install hint | custom error messages | `aco_check_adapter <key>` | Already formats "not installed" + hint correctly |
| Gemini/Copilot invocation with flags | raw binary calls | `aco_adapter_invoke <key> <prompt> [stdin]` | Handles --yolo, --allow-all-tools, --silent, alias expansion |
| Config-driven routing reads | manual JSON parsing | `_read_routing_adapter <cmd> <default>` | jq+python3 fallback, never exits non-zero |

---

## Common Pitfalls

### Pitfall 1: Bash Alias Expansion
**What goes wrong:** Calling `gemini` directly in bash scripts doesn't work because the user's `~/.zshrc` aliases `gemini --yolo` — the bash script doesn't expand shell aliases.
**Why it happens:** `set -euo pipefail` scripts run in non-interactive bash; aliases not loaded.
**How to avoid:** Always use `aco_adapter_invoke` which calls `$(command -v gemini)` explicitly.

### Pitfall 2: Copilot stdin Piping
**What goes wrong:** Piping diff content to copilot's stdin doesn't work like Gemini.
**Why it happens:** Copilot CLI reads prompts from `-p` flag, not stdin.
**How to avoid:** Use `aco_adapter_invoke "copilot"` which embeds stdin_content in the prompt string.

### Pitfall 3: git diff HEAD Empty on First Commit
**What goes wrong:** `git diff HEAD` is empty on repos with no previous commit.
**Why it happens:** HEAD~1 also fails if there's only one commit.
**How to avoid:** REV-03 fallback handles this — empty string check on both `git diff HEAD` and `git diff HEAD~1` before printing "No changes detected".

### Pitfall 4: SCRIPT_DIR Path Resolution in Slash Commands
**What goes wrong:** Relative paths break when slash commands are invoked from different working directories.
**Why it happens:** `$0` or relative paths depend on CWD.
**How to avoid:** Always use `SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"` pattern to get an absolute path to the command file's directory.

### Pitfall 5: reviewer.md File Not Found
**What goes wrong:** If `.claude/aco/prompts/gemini/reviewer.md` doesn't exist, `cat` silently returns empty string — Gemini gets an empty prompt.
**How to avoid:** Check that reviewer.md exists before calling `aco_adapter_invoke`; print error if missing.

---

## Validation Architecture

**Config setting:** `workflow.nyquist_validation = true` → Section is REQUIRED.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Bash (same as Phase 6 test files) |
| Config file | None — standalone scripts |
| Quick run command | `bash .claude/aco/tests/test-review-commands.sh` |
| Full suite command | `bash .claude/aco/tests/smoke-adapters.sh && bash .claude/aco/tests/test-error-handling.sh && bash .claude/aco/tests/test-routing.sh && bash .claude/aco/tests/test-review-commands.sh` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REV-01 | git diff HEAD sent to adapter | integration | `bash .claude/aco/tests/test-review-commands.sh` | ❌ Wave 0 |
| REV-02 | file path argument → cat file content | unit | `bash .claude/aco/tests/test-review-commands.sh` | ❌ Wave 0 |
| REV-03 | empty diff → HEAD~1 retry → "No changes detected" | unit | `bash .claude/aco/tests/test-review-commands.sh` | ❌ Wave 0 |
| STAT-01 | availability check ✓/✗ + version output | unit | `bash .claude/aco/tests/test-review-commands.sh` | ❌ Wave 0 |
| STAT-02 | routing config display (scope TBD) | unit | manual inspection | N/A — see Open Questions |
| SETUP-01 | install + auth instructions printed | manual-only | visual verification | N/A — static output |

**Manual-only justification (SETUP-01):** Setup commands print static strings. No logic to test — output correctness verified by inspection.

### Sampling Rate

- **Per task commit:** `bash .claude/aco/tests/test-review-commands.sh`
- **Per wave merge:** Full suite (all 4 test scripts)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `.claude/aco/tests/test-review-commands.sh` — covers REV-01, REV-02, REV-03, STAT-01
- [ ] `.claude/aco/prompts/gemini/reviewer.md` — required by test harness for review command invocation
- [ ] `.claude/aco/prompts/copilot/reviewer.md` — required by test harness for review command invocation

---

## Open Questions

1. **STAT-02 scope in per-CLI context**
   - What we know: STAT-02 in REQUIREMENTS.md says "print routing config as table". Phase 7 ROADMAP success criteria only say "print availability + version". Phase 7 commands hardcode adapters (D-01).
   - What's unclear: Should `/gemini:status` print routing info at all? Or is STAT-02 reserved for a future `/aco:status` centralized command?
   - Recommendation: Implement Phase 7 status commands as availability+version only (matching ROADMAP success criteria 5). Mark STAT-02 as partially satisfied — full routing table satisfier deferred to Phase 8/9 when `/aco:status` is created.

2. **`$ARGUMENTS` vs `$1` in slash command bash blocks**
   - What we know: Claude Code slash commands expose user arguments as `$ARGUMENTS` in Markdown templates. In bash execution context, it's unclear if `$ARGUMENTS` is a shell var or needs different handling.
   - What's unclear: Does Claude pass `$ARGUMENTS` as a real environment variable when executing bash, or does it need to be referenced differently?
   - Recommendation: Use `$ARGUMENTS` in the Markdown template for display, but document that when Claude executes the bash script it should pass arguments as `$1`. Alternatively, use Claude's template substitution: `!$ARGUMENTS` syntax. Planner should verify the exact argument passing mechanism from existing gsd command examples.

3. **routing block add to .wrapper.json**
   - What we know: The block is absent despite Phase 6-03 claiming to add it.
   - What's unclear: Whether this was a git branch issue or an execution issue.
   - Recommendation: Add the routing block in Phase 7 Plan 1 as a 2-line JSON fix. Cost is minimal and it unblocks future phases.

---

## Sources

### Primary (HIGH confidence)
- `.claude/aco/lib/adapter.sh` — Read directly; all 5 function signatures and invocation patterns
- `.claude/aco/tests/smoke-adapters.sh`, `test-error-handling.sh`, `test-routing.sh` — Read directly; test pattern confirmed
- `.wrapper.json` — Read directly; confirmed schema state
- `.claude/commands/gsd/do.md` — Read directly; slash command YAML frontmatter format confirmed
- `.planning/phases/06-adapter-infrastructure/06-RESEARCH.md` — Read directly; CLI quirks and version data

### Secondary (MEDIUM confidence)
- `/Users/pureliture/fork-repo/ccg-workflow/templates/commands/review.md` — Read directly; multi-model review pattern (adapted for single-model use)
- `/Users/pureliture/fork-repo/ccg-workflow/templates/prompts/gemini/reviewer.md` — Read directly; reviewer role file structure
- `/Users/pureliture/fork-repo/ccg-workflow/templates/prompts/codex/reviewer.md` — Read directly; reviewer role file structure
- `/Users/pureliture/everything-claude-code/commands/code-review.md` — Read directly; severity-structured review output pattern

### Environment probed (HIGH confidence)
- `command -v gemini && gemini --version` → 0.36.0 at `/opt/homebrew/bin/gemini`
- `command -v copilot && copilot --version` → GitHub Copilot CLI 1.0.15

---

## Metadata

**Confidence breakdown:**
- adapter.sh API: HIGH — read directly from source
- Command file structure: MEDIUM-HIGH — inferred from gsd/do.md + CONTEXT guidance (no prior aco command example exists)
- reviewer.md prompt content: MEDIUM — adapted from ccg-workflow reference; exact wording is Claude's discretion (D-02)
- Test strategy: HIGH — directly mirrors Phase 6 test pattern
- Environment availability: HIGH — probed with command -v

**Research date:** 2026-04-02
**Valid until:** Stable — no external library APIs involved; bash-only implementation

---

## RESEARCH COMPLETE
