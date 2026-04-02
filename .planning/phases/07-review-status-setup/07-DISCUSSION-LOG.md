# Phase 7: review + status + setup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 07-review-status-setup
**Areas discussed:** Command namespace, Review prompt design, Output presentation, Setup command depth

---

## Command Namespace

| Option | Description | Selected |
|--------|-------------|----------|
| Per-CLI namespace (`/gemini:*`, `/copilot:*`) | Separate commands in `.claude/commands/gemini/` and `.claude/commands/copilot/` — ROADMAP-aligned, explicit, no routing needed | ✓ |
| `/aco:review --target` | Single command dispatches via routing config or explicit flag — REQUIREMENTS.md-aligned | |
| Both (thin wrappers over shared core) | `/gemini:review` and `/copilot:review` as wrappers over shared `/aco:review` — DRY | |

**User's choice:** Per-CLI namespace wins. ROADMAP success criteria takes precedence over REQUIREMENTS.md REV-01 routing approach.
**Notes:** Commands go in `.claude/commands/gemini/` and `.claude/commands/copilot/` directories.

---

## Review Prompt Design

| Option | Description | Selected |
|--------|-------------|----------|
| ccg-workflow pattern | `reviewer.md` role files per CLI at `.claude/aco/prompts/<cli>/reviewer.md`, output structured as Critical/Major/Minor/Suggestion | ✓ |
| Generic prompt | Simple 'review this code' one-liner | |
| Minimal | Pass diff only, no extra instructions | |

**User's choice:** Port ccg-workflow `reviewer.md` role file pattern directly. Don't invent new prompts.
**Notes:** User clarified that this project is about porting codex-plugin-cc command structure with ccg-workflow internals — not creating something new.

---

## Output Presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Verbatim (ccg-workflow / codex-plugin-cc reference) | `reviewer.md` controls output format; slash command passes through verbatim | ✓ |
| Structured header | Add `## Gemini Review` header before CLI output | |

**User's choice:** Reference ccg-workflow and codex-plugin-cc — reviewer.md prompt structures output, bash layer passes through verbatim.
**Notes:** User directed to reference the existing patterns rather than re-discussing.

---

## Setup Command Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Reference-based (ccg-workflow / codex-plugin-cc) | Follow existing reference implementations for install + auth steps depth | ✓ |
| Minimal | Install command + auth steps only | |
| With verification | Install + auth + run `aco_adapter_available` check | |

**User's choice:** Reference codex-plugin-cc / ccg-workflow patterns.
**Notes:** User again directed to use existing reference implementations rather than discussing.

---

## Claude's Discretion

- Exact `reviewer.md` wording (adapt from ccg-workflow references)
- Internal bash variable naming
- Whether to add a brief header before verbatim CLI output

## Deferred Ideas

- `/aco:review --target <adapter>` centralized routing — future phase
- Multi-model parallel review — out of scope Phase 7
- `--focus` flag — Phase 8
- Background task (`--background`) — Phase 9
