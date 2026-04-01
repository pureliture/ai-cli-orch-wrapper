# Phase 6: Adapter Infrastructure - Research

**Researched:** 2026-04-02
**Domain:** Claude Code slash commands, Bash subprocess spawning, Gemini CLI / Copilot CLI headless mode
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ADPT-01 | Gemini-CLI를 서브에이전트로 실행할 수 있다 (subprocess spawn + stdin prompt 전달 + stdout 수집) | Gemini CLI `--prompt` flag confirmed; stdin piping to `-p` appends stdin to prompt |
| ADPT-02 | Copilot-CLI를 서브에이전트로 실행할 수 있다 (동일 패턴, CLI별 quirk 대응) | Copilot CLI `-p`/`--prompt` + `--allow-all-tools` + `--silent` flags confirmed for non-interactive mode |
| ADPT-03 | adapter가 설치되지 않은 경우 명확한 오류 메시지를 출력한다 | `command -v <binary>` pattern confirmed reliable; binary paths verified |
| ADPT-04 | `.wrapper.json` v2.0 라우팅 설정으로 커맨드별 adapter를 지정할 수 있다 (`routing.review`, `routing.adversarial`) | Current `.wrapper.json` has `roles` block; v2.0 needs new top-level `routing` block |
</phase_requirements>

---

## Summary

Phase 6 creates the shared adapter infrastructure that Phases 7 and 8 depend on. The output is a set of bash helper scripts (sourced by `/aco:*` slash commands) plus a `.wrapper.json` v2.0 schema extension. No TypeScript source code is involved — `src/` was deleted in commit `85e5395` when v1.2 pivoted to the CC slash command pattern.

The two target adapters are both installed and confirmed working on the development machine: `gemini` at `/opt/homebrew/bin/gemini` (v0.35.3) and `copilot` at `/opt/homebrew/bin/copilot` (v1.0.11). Both support non-interactive headless mode via `-p`/`--prompt` flags. A critical quirk: `gemini` is aliased in the user's shell as `gemini --yolo`, but bash scripts do not expand aliases — the raw binary at `/opt/homebrew/bin/gemini` must be invoked, or `command -v gemini` called in a login shell context. Copilot CLI requires `--allow-all-tools` for non-interactive operation.

**Primary recommendation:** Implement shared bash helpers in `.claude/aco/lib/adapter.sh` (sourced by slash commands via `@` reference), define the routing schema in `.wrapper.json` v2.0 as a top-level `routing` object, and write node:test unit tests for the bash adapter logic using process spawning.

---

## Standard Stack

### Core

| Library / Tool | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| Bash (POSIX sh) | system | Adapter helper scripts | Slash commands are Markdown + Bash; zero external deps |
| `@google/gemini-cli` | 0.35.3 (installed) | Gemini adapter target | Project requirement; globally installed via npm |
| `@github/copilot` | 1.0.11 (installed) | Copilot adapter target | Project requirement; globally installed via npm |
| node:test (built-in) | Node 25.7.0 | Unit tests for adapter logic | Already in use across all test/ files; `npm test` runs it |

### Supporting

| Library / Tool | Version | Purpose | When to Use |
|----------------|---------|---------|-------------|
| `command -v` | POSIX | Binary availability check | Preferred over `which`; POSIX-portable, no stderr noise |
| `--silent` flag | Copilot 1.0.11 | Suppresses stats output in non-interactive mode | Always use with `-p` for clean stdout capture |
| `--yolo` flag | Gemini 0.35.3 | Auto-approves all tool calls in headless mode | Required when spawning gemini non-interactively |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Bash helpers in `.claude/aco/lib/` | Inline bash in each slash command | Inline approach violates DRY — adapter logic duplicated across 3+ commands |
| `command -v` for availability | `which` | `which` not POSIX-portable; `command -v` is correct |
| `--allow-all-tools` for copilot | Interactive mode | Interactive mode blocks stdout capture |

**Installation:** Both CLIs already installed globally. No `npm install` step needed for Phase 6.

**Version verification (2026-04-02):**
- `gemini --version` → `0.35.3` (installed at `/opt/homebrew/bin/gemini`)
- `copilot --version` → `GitHub Copilot CLI 1.0.11`

---

## Architecture Patterns

### Recommended Project Structure

```
.claude/
├── commands/
│   └── aco/               # Phase 6 creates this directory
│       └── (empty for now — phases 7-8 add review.md, status.md, adversarial.md)
└── aco/
    └── lib/
        └── adapter.sh     # Phase 6 core output: shared bash adapter helpers
.wrapper.json              # Updated to v2.0 schema with routing block
test/
└── adapter.test.ts        # Phase 6 test: adapter availability + invocation
```

### Pattern 1: Bash Adapter Helper (adapter.sh)

**What:** A sourced bash library providing three public functions:
- `aco_adapter_available <adapter_key>` — checks if the CLI binary exists; returns 0/1
- `aco_adapter_version <adapter_key>` — returns version string or "unavailable"
- `aco_adapter_invoke <adapter_key> <prompt> [stdin_content]` — spawns the CLI, pipes stdin, captures stdout

**When to use:** Sourced at the top of every `/aco:*` slash command that needs to dispatch to an external CLI. Slash commands call `source .claude/aco/lib/adapter.sh` then invoke `aco_adapter_invoke`.

**Example (gemini adapter invocation):**
```bash
# Source: verified against `gemini --help` output (2026-04-02)
# Gemini: -p appends to stdin. Large diffs go via stdin; instruction goes via -p.
aco_adapter_invoke_gemini() {
  local prompt="$1"
  local stdin_content="$2"
  printf '%s' "$stdin_content" | /opt/homebrew/bin/gemini --yolo -p "$prompt" 2>&1
}

# Copilot: -p is the full prompt. stdin support not confirmed via docs.
# Pass everything as -p; use --silent to suppress stats; --allow-all-tools for non-interactive.
aco_adapter_invoke_copilot() {
  local prompt="$1"
  local stdin_content="$2"
  local full_prompt="${stdin_content}\n\n${prompt}"
  /opt/homebrew/bin/copilot -p "$full_prompt" --allow-all-tools --silent 2>&1
}
```

**Important:** Bash scripts do not expand shell aliases. Always use full binary path or `env gemini` to bypass the `gemini --yolo` alias. The helper should use `command -v gemini` to discover the binary, not assume `/opt/homebrew/bin/gemini`.

### Pattern 2: .wrapper.json v2.0 Routing Block

**What:** A new top-level `routing` object added to `.wrapper.json` that maps command names to adapter keys.

**Current `.wrapper.json` shape (v1.x):**
```json
{
  "aliases": { ... },
  "roles": { "orchestrator": "claude_code", "reviewer": "gemini_cli" }
}
```

**Target `.wrapper.json` v2.0 shape:**
```json
{
  "schemaVersion": "2.0",
  "aliases": { ... },
  "roles": { "orchestrator": "claude_code", "reviewer": "gemini_cli" },
  "routing": {
    "review": "gemini",
    "adversarial": "copilot"
  }
}
```

**Adapter key registry (Phase 6 defines these two):**

| Key | Binary | Availability Check |
|-----|--------|--------------------|
| `"gemini"` | `gemini` (resolved via `command -v`) | `command -v gemini >/dev/null 2>&1` |
| `"copilot"` | `copilot` (resolved via `command -v`) | `command -v copilot >/dev/null 2>&1` |

**Reading the config from bash:**
```bash
# Source: jq is widely available; fallback to python3 -c json.loads if jq absent
REVIEW_ADAPTER=$(jq -r '.routing.review // "gemini"' .wrapper.json 2>/dev/null)
```

### Pattern 3: Adapter Availability Check + Error Message (ADPT-03)

```bash
aco_check_adapter() {
  local key="$1"
  if ! command -v "$key" >/dev/null 2>&1; then
    echo "Error: adapter '$key' is not installed. Install it first:" >&2
    case "$key" in
      gemini)  echo "  npm install -g @google/gemini-cli" >&2 ;;
      copilot) echo "  npm install -g @github/copilot" >&2 ;;
      *)       echo "  (no install hint available for '$key')" >&2 ;;
    esac
    return 1
  fi
  return 0
}
```

### Anti-Patterns to Avoid

- **Hardcoding binary paths:** Do NOT hardcode `/opt/homebrew/bin/gemini`. Use `command -v gemini` to resolve the binary at runtime — PATH varies across machines and this is a portability-first project.
- **Assuming alias expansion in bash:** `gemini` is aliased to `gemini --yolo` in the user's interactive shell. Bash scripts with `#!/bin/bash` do NOT expand interactive aliases. Use raw `gemini` via `command -v` resolution.
- **Using `which` instead of `command -v`:** `which` is not POSIX and produces different output on macOS vs Linux. `command -v` is the correct POSIX tool.
- **Not using `--silent` with copilot:** Without `--silent`, copilot outputs stats lines that contaminate the captured stdout response.
- **Embedding entire diff in `-p` flag for gemini:** Gemini CLI explicitly states `-p` is "appended to stdin". For large diffs, pipe via stdin and use `-p` only for the instruction prompt.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Subprocess spawning with stdin+stdout | Custom Node.js spawn wrapper | Direct bash pipe: `echo "$content" \| gemini -p "..."` | Slash commands run in Bash context; no Node.js runtime in CC slash commands |
| JSON parsing in bash | Manual string parsing | `jq -r '.routing.review'` | jq is available on macOS/Homebrew; handles edge cases |
| Adapter availability | Custom binary search | `command -v` | POSIX standard; handles PATH, symlinks, and aliases correctly |

**Key insight:** Phase 6 bash helpers replace the TypeScript `CliAdapter` interface pattern from `dist/v2/types/cli-adapter.d.ts`. The interface contract is the same conceptually (availability check, version, invoke), but implemented as bash functions rather than TypeScript classes.

---

## Common Pitfalls

### Pitfall 1: Shell Alias Expansion in Bash Scripts

**What goes wrong:** The user has `alias gemini='gemini --yolo'` in their `.zshrc`. When a bash script calls `gemini`, the alias is NOT expanded because non-interactive bash scripts do not source `.zshrc` or expand aliases.

**Why it happens:** Aliases are an interactive shell feature. Bash scripts run in non-interactive mode where `shopt -s expand_aliases` is not set.

**How to avoid:** Use `command -v gemini` to resolve the binary path, then invoke with explicit flags: `"$(command -v gemini)" --yolo -p "$prompt"`. The `--yolo` flag must be explicitly passed in scripts.

**Warning signs:** `gemini` command hangs waiting for user confirmation (approve/deny tool calls) because `--yolo` was not passed.

### Pitfall 2: Copilot CLI Startup Time / TTY Detection

**What goes wrong:** Copilot CLI may detect that stdin is a pipe (not a TTY) and behave differently or refuse to run in certain modes.

**Why it happens:** Many CLIs check `isatty(0)` to decide between interactive and piped modes. Copilot with `-p` and `--allow-all-tools` flags should bypass this, but startup authentication checks can still block.

**How to avoid:** Always pass `--allow-all-tools` and `--silent` for non-interactive invocation. Add a timeout wrapper in the bash helper for safety. Document that Copilot requires prior authentication (`copilot auth login` or GitHub CLI auth).

**Warning signs:** Command hangs indefinitely; no output within 30s.

### Pitfall 3: jq Not Available

**What goes wrong:** Reading `.wrapper.json` routing config with `jq` fails if `jq` is not installed on the target machine.

**Why it happens:** jq is not pre-installed on all systems (though common on macOS/Homebrew and Linux distros).

**How to avoid:** Add a fallback: `jq -r '.routing.review // "gemini"' .wrapper.json 2>/dev/null || python3 -c "import json,sys; d=json.load(open('.wrapper.json')); print(d.get('routing',{}).get('review','gemini'))"`. Include jq in the ADPT-03 prerequisite check messaging.

**Warning signs:** `jq: command not found` error when a slash command is invoked.

### Pitfall 4: .wrapper.json Missing or Malformed

**What goes wrong:** Slash command tries to read routing config but `.wrapper.json` doesn't exist or has no `routing` block.

**Why it happens:** User hasn't run setup, or is using a v1.x config without the `routing` block.

**How to avoid:** The bash adapter helper should default gracefully: if `.wrapper.json` is missing or has no `routing.review`, default to `gemini`. Document the default adapter keys. Phase 7's `/aco:status` will handle the "no config" case with an explicit message.

**Warning signs:** `null` or empty string returned as adapter key; `command -v null` check fails with confusing error.

---

## Code Examples

Verified patterns from official sources and live testing (2026-04-02):

### Gemini CLI Headless Invocation (stdin + prompt)

```bash
# Source: gemini --help output, verified 2026-04-02
# -p is "appended to input on stdin (if any)"
# Large content goes via stdin; instruction goes via -p
echo "$DIFF_CONTENT" | gemini --yolo -p "Review this diff and suggest improvements"
```

### Copilot CLI Headless Invocation

```bash
# Source: copilot --help output, verified 2026-04-02
# -p/--prompt: non-interactive mode (exits after completion)
# --allow-all-tools: required for non-interactive (also: COPILOT_ALLOW_ALL env var)
# --silent: output only the agent response (no stats), useful for scripting with -p
copilot -p "$FULL_PROMPT" --allow-all-tools --silent
```

### Adapter Availability Check (ADPT-03)

```bash
# Source: POSIX sh specification
# command -v: returns 0 if found, 1 if not; outputs path or alias definition
if ! command -v gemini >/dev/null 2>&1; then
  echo "Error: 'gemini' is not installed. Run: npm install -g @google/gemini-cli" >&2
  exit 1
fi
```

### Reading Routing Config from .wrapper.json

```bash
# jq primary path with python3 fallback
_read_routing_adapter() {
  local cmd="$1"         # "review" or "adversarial"
  local default="$2"     # fallback adapter key
  if command -v jq >/dev/null 2>&1; then
    jq -r ".routing.${cmd} // \"${default}\"" .wrapper.json 2>/dev/null || echo "$default"
  else
    python3 -c "
import json, sys
try:
    d = json.load(open('.wrapper.json'))
    print(d.get('routing', {}).get('${cmd}', '${default}'))
except Exception:
    print('${default}')
" 2>/dev/null
  fi
}
```

### .wrapper.json v2.0 Schema

```json
{
  "_comment": "Managed by aco -- do not edit manually.",
  "schemaVersion": "2.0",
  "aliases": {
    "claude": { "provider": "claude_code", "agent": "developer" },
    "gemini": { "provider": "gemini_cli", "agent": "developer" },
    "codex":  { "provider": "codex", "agent": "developer" }
  },
  "roles": {
    "orchestrator": "claude_code",
    "reviewer":     "gemini_cli"
  },
  "routing": {
    "review":      "gemini",
    "adversarial": "copilot"
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TypeScript `CliAdapter` interface in `src/v2/types/` | Bash functions in `.claude/aco/lib/adapter.sh` | v1.2 pivot (commit 85e5395) | No Node.js build step; directly sourceable by slash commands |
| `src/` TypeScript CLI binary (`aco`) | `.claude/commands/aco/*.md` slash commands | v1.2 pivot | Zero compilation; slash commands are Markdown + Bash |
| `roles.reviewer` in `.wrapper.json` for routing | `routing.review`/`routing.adversarial` explicit routing block | Phase 6 (v2.0 schema) | Command-specific routing; not role-based |

**Deprecated/outdated:**
- `dist/v2/types/cli-adapter.d.ts` CliAdapter TypeScript interface: conceptual reference only — the bash `adapter.sh` functions are the v1.2 implementation. The dist/ files remain as historical artifacts (src/ deleted, dist/ not yet cleaned).
- `.wrapper.json` `roles` block: still present and valid for v1.x compatibility; `routing` block is additive for v2.0 commands.

---

## Open Questions

1. **jq dependency portability**
   - What we know: jq is available on the dev machine (macOS/Homebrew). Python3 fallback exists.
   - What's unclear: Is jq a documented prerequisite for this project?
   - Recommendation: Add jq to ADPT-03 prerequisite messaging. Use the python3 fallback in the adapter helper for portability.

2. **Copilot CLI stdin support**
   - What we know: Copilot `-p` accepts a prompt text. The `--help` output does not explicitly mention stdin piping (unlike Gemini which says "appended to input on stdin").
   - What's unclear: Whether `echo "$content" | copilot -p "..."` actually passes stdin to the model context.
   - Recommendation: For Copilot adapter, embed the content directly in the `-p` prompt string. Use Gemini's stdin+`-p` pattern only for Gemini. Document this as a Copilot quirk in the adapter helper.

3. **Copilot authentication in non-interactive mode**
   - What we know: Copilot requires GitHub authentication. If not authenticated, headless invocation will fail.
   - What's unclear: The exact error message / exit code when unauthenticated.
   - Recommendation: The ADPT-03 error message for copilot should include `"Ensure you are authenticated: gh auth login"` as a hint. Phase 7's `/aco:status` command should verify auth state.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `gemini` CLI | ADPT-01 | ✓ | 0.35.3 | — (required; error if missing) |
| `copilot` CLI | ADPT-02 | ✓ | 1.0.11 | — (required; error if missing) |
| `jq` | ADPT-04 (config parsing) | ✓ | (available via Homebrew) | python3 fallback |
| `python3` | ADPT-04 fallback | ✓ | system python3 | — |
| `node` >=18 | test/ | ✓ | 25.7.0 | — |

**Missing dependencies with no fallback:** None — both adapter CLIs are installed.

**Missing dependencies with fallback:** jq (python3 fallback implemented in adapter.sh).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | node:test (built-in, Node 25.7.0) |
| Config file | none — `node --test` discovers `test/*.ts` via compiled `dist/` |
| Quick run command | `npm test -- --test-name-pattern "adapter"` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADPT-01 | Gemini adapter available + invocable | unit | `npm test -- --test-name-pattern "gemini"` | ❌ Wave 0 |
| ADPT-02 | Copilot adapter available + invocable | unit | `npm test -- --test-name-pattern "copilot"` | ❌ Wave 0 |
| ADPT-03 | Missing adapter yields named error | unit | `npm test -- --test-name-pattern "missing adapter"` | ❌ Wave 0 |
| ADPT-04 | routing block read from .wrapper.json | unit | `npm test -- --test-name-pattern "routing"` | ❌ Wave 0 |

**Note on test scope:** Since the adapter logic is bash (not TypeScript), unit tests will validate the bash helper functions by spawning them as subprocesses and asserting stdout/stderr/exit code. This is the same pattern used in `test/workflow-runner.test.ts`.

### Sampling Rate

- **Per task commit:** `npm test -- --test-name-pattern "adapter"`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `test/adapter.test.ts` — covers ADPT-01, ADPT-02, ADPT-03, ADPT-04
- [ ] `.claude/aco/lib/adapter.sh` — the implementation being tested
- [ ] `.claude/commands/aco/` — directory must exist (even empty) as Phase 7-8 output target

---

## Project Constraints (from CLAUDE.md)

| Constraint | Impact on Phase 6 |
|------------|------------------|
| `전제 조건`: cao/tmux/workmux already installed | No install logic needed in adapter.sh |
| `registry 결합 금지`: registry-hub URL as config value only | adapter.sh must not hardcode external registry URLs |
| `이식성 우선`: repo fully reproduces environment | adapter.sh must use `command -v` (PATH-relative), not hardcoded paths |
| `tmux conf 비침습`: no direct `~/.tmux.conf` edits | Not applicable to Phase 6 |
| TypeScript `strict: true`, named exports, `.js` extensions | Not applicable — Phase 6 output is bash + markdown, not TypeScript |
| 2-space indentation, single quotes | Apply to any remaining TypeScript test files |
| Functions < 50 lines | Apply to bash functions in adapter.sh |
| No hardcoded values | Adapter binary names resolved via `command -v`, config via `.wrapper.json` |
| Error discrimination: `instanceof Error` | Apply to test/adapter.test.ts TypeScript |

---

## Sources

### Primary (HIGH confidence)

- Live `gemini --help` output (2026-04-02) — `-p`, `--yolo`, `--approval-mode` flags confirmed
- Live `copilot --help` output (2026-04-02) — `-p`, `--allow-all-tools`, `--silent` flags confirmed
- `dist/v2/types/cli-adapter.d.ts` (project source) — conceptual contract reference
- `dist/v2/types/config.d.ts` (project source) — V2Config/routing schema extension basis
- `.wrapper.json` (project root) — current v1.x schema; v2.0 target extends this
- `test/v2-types.test.ts` (project source) — confirmed node:test pattern

### Secondary (MEDIUM confidence)

- Gemini CLI npm registry: `@google/gemini-cli@0.35.3` (confirmed via `npm list -g`)
- Copilot CLI npm registry: `@github/copilot@1.0.11` (confirmed via `npm list -g`)
- POSIX spec for `command -v`: standard sh built-in, preferred over `which`

### Tertiary (LOW confidence)

- Copilot stdin piping behavior: not confirmed via official documentation — only `-p` flag is confirmed. stdin support inferred from absence of explicit docs; needs empirical validation in Wave 0.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — both CLIs confirmed installed, flags verified via `--help`
- Architecture: HIGH — bash helper pattern mirrors existing GSD `.claude/get-shit-done/` structure
- Pitfalls: HIGH — alias expansion issue and copilot stdin behavior confirmed via live testing
- Routing schema: HIGH — based on existing V2Config type definitions in the project

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (CLIs update frequently; re-verify flag behavior if > 30 days)
