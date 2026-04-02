# Phase 7: review + status + setup - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement per-CLI slash commands for code review delegation, availability status checks, and setup guidance — targeting Gemini CLI and Copilot CLI as the two primary adapters.

Commands to deliver:
- `/gemini:review`, `/copilot:review` — delegate code review (diff or file) to each CLI
- `/gemini:status`, `/copilot:status` — check adapter availability and version
- `/gemini:setup`, `/copilot:setup` — print install instructions and auth steps

This phase does NOT create a centralized `/aco:review` routing command — that may come later. Phase 7 is per-CLI named commands only.

</domain>

<decisions>
## Implementation Decisions

### Command Namespace (D-01)
- **D-01:** Per-CLI namespace wins. Commands live in `.claude/commands/gemini/` and `.claude/commands/copilot/` directories, one file per command (`review.md`, `status.md`, `setup.md`). No routing config involvement — each command hardcodes its adapter key (`gemini` or `copilot`).
- This aligns with ROADMAP success criteria and the codex-plugin-cc / ccg-workflow command structure philosophy.

### Review Prompt Architecture (D-02)
- **D-02:** Port the ccg-workflow `reviewer.md` role file pattern. Create:
  - `.claude/aco/prompts/gemini/reviewer.md` — Gemini-specific reviewer role
  - `.claude/aco/prompts/copilot/reviewer.md` — Copilot-specific reviewer role
- The reviewer prompt instructs the CLI to output findings structured as Critical / Major / Minor / Suggestion (same as ccg-workflow).
- The slash command passes the diff/file content + reviewer.md role to `aco_adapter_invoke` — output is returned verbatim to the Claude Code session.

### Output Presentation (D-03)
- **D-03:** Follow ccg-workflow/codex-plugin-cc output pattern. The `reviewer.md` role file controls output structure (CLI outputs formatted markdown). The slash command passes that output through verbatim — no extra wrapping or headers added by the bash layer.

### Setup Command Depth (D-04)
- **D-04:** Follow codex-plugin-cc/ccg-workflow reference for setup commands. Include install command + required auth steps (the minimum specified in ROADMAP success criteria). Depth and exact wording: reference `.claude/aco/prompts/` or ccg-workflow equivalents.

### Reuse Phase 6 Infrastructure (D-05)
- **D-05:** All commands source `.claude/aco/lib/adapter.sh` via `@` reference. Use:
  - `aco_check_adapter <key>` for missing CLI error + install hint
  - `aco_adapter_invoke <key> <prompt>` for dispatching to the CLI
  - `aco_adapter_version <key>` for status command output
- No new adapter infrastructure needed — Phase 6 provides the complete API.

### Claude's Discretion
- Exact reviewer.md prompt wording (structure of Critical/Major/Minor/Suggestion sections, tone)
- Internal bash variable naming in each slash command
- Whether to add a brief summary line before verbatim CLI output (e.g., "## Gemini Review") — minimal is preferred, but acceptable if it aids readability

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 6 Foundation
- `.claude/aco/lib/adapter.sh` — Public adapter API: `aco_adapter_available`, `aco_adapter_version`, `aco_check_adapter`, `aco_adapter_invoke`, `_read_routing_adapter`. Downstream commands MUST source this file.
- `.wrapper.json` — v2.0 schema with routing block. `review → gemini`, `adversarial → copilot` defaults.
- `.claude/aco/tests/smoke-adapters.sh` — Adapter smoke tests (reference for test patterns).

### Reference Implementations (External)
- `/Users/pureliture/fork-repo/ccg-workflow/templates/commands/review.md` — ccg-workflow review command structure (multi-model pattern, diff collection, severity output)
- `/Users/pureliture/fork-repo/ccg-workflow/templates/prompts/gemini/reviewer.md` — Gemini reviewer role file (adapt for this project)
- `/Users/pureliture/fork-repo/ccg-workflow/templates/prompts/codex/reviewer.md` — Codex reviewer role file (adapt for Copilot)
- `/Users/pureliture/everything-claude-code/commands/code-review.md` — codex-plugin-cc review command (severity-structured output pattern)
- `/Users/pureliture/everything-claude-code/contexts/review.md` — Review context/role definition pattern

### Requirements
- `.planning/REQUIREMENTS.md` — REV-01, REV-02, REV-03, STAT-01, STAT-02, SETUP-01 are the core targets.
- `.planning/ROADMAP.md` — Phase 7 success criteria (6 verifiable truths).

### Project Context
- `.planning/PROJECT.md` — v1.2 pivot: slash commands are Markdown + Bash, no TypeScript.
- `.planning/phases/06-adapter-infrastructure/06-RESEARCH.md` — Gemini CLI and Copilot CLI binary flags, quirks, and invocation patterns.
- `.planning/phases/06-adapter-infrastructure/06-03-SUMMARY.md` — adapter.sh current state and exported functions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.claude/aco/lib/adapter.sh` — Complete adapter API. `aco_adapter_invoke` accepts `<key> <prompt> [stdin_content]`. The `gemini` key uses `--yolo` flag; `copilot` uses `--allow-all-tools --silent`.
- `.claude/aco/tests/` — Test scaffolding: `smoke-adapters.sh`, `test-error-handling.sh`, `test-routing.sh`. New test files follow this pattern.
- `.wrapper.json` — v2.0 with `routing.review = "gemini"`, `routing.adversarial = "copilot"`.

### Established Patterns
- Slash commands are Markdown files with embedded bash blocks — no TypeScript
- `@`-reference syntax to source shared files: `@.claude/aco/lib/adapter.sh`
- Error messages from `aco_check_adapter` already name the missing tool + install hint

### Integration Points
- New commands in `.claude/commands/gemini/` and `.claude/commands/copilot/` directories (must be created)
- Reviewer prompt files at `.claude/aco/prompts/gemini/reviewer.md` and `.claude/aco/prompts/copilot/reviewer.md` (must be created)
- Test file at `.claude/aco/tests/test-review-commands.sh` (follow existing pattern)

</code_context>

<specifics>
## Specific Ideas

- "Port ccg-workflow and codex-plugin-cc patterns — don't invent new patterns. Gemini and Copilot CLI are the two primary adapters."
- Gemini binary quirk: aliased as `gemini --yolo` in shell, but bash scripts don't expand aliases — `aco_adapter_invoke` handles this correctly already.
- Copilot CLI requires `--allow-all-tools --silent` for non-interactive mode — `aco_adapter_invoke` handles this already.

</specifics>

<deferred>
## Deferred Ideas

- `/aco:review --target <adapter>` centralized routing command — Phase 8 or later
- Multi-model parallel review (ccg-workflow style cross-validation) — out of scope for Phase 7
- `--focus` flag for scoped review — Phase 8 (`/gemini:adversarial --focus security`)
- Background task execution (`--background` flag) — Phase 9

</deferred>

---

*Phase: 07-review-status-setup*
*Context gathered: 2026-04-02*
