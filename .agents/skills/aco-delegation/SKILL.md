---
name: aco-delegation
description: Use when a Claude Code session should consider delegating an advisory review, critique, or analysis task to external AI CLIs through aco ask.
---

# aco Delegation

Use `aco ask` when an external Codex/Antigravity/mock CLI perspective can save Claude Code context tokens or provide an advisory second opinion.

## Entrypoints

The single delegation entrypoint is `/aco` in Claude Code sessions and `$aco` in Codex sessions.
Do not use `/antigravity:review`, `/antigravity:adversarial`, `/antigravity:rescue`, `/review`, `/execute`, or `/research` — these have been retired.
Use `/antigravity:setup` only for provider provisioning (installing the Antigravity CLI), not for delegation.

## When To Suggest

- Broad review, critique, or comparison work would consume a lot of Claude Code tokens.
- The user asks for an external reviewer, Codex/Antigravity perspective, or multi-tool critique.
- A spec, plan, diff, or document needs architecture, testing, tech-debt, or simplification feedback.
- A deterministic no-auth demo is enough; use `--providers mock`.

## Consent Rule

Never invoke external providers silently.

Start with:

```bash
aco ask --task "<natural language task>" --dry-run
```

Only run providers after explicit user consent:

```bash
aco ask --providers mock --task "<natural language task>" --input "<text>" --yes
```

## Output Rule

Prefer the default `brief` output mode. Full provider output is saved to session artifacts and can be read with:

```bash
aco result --session <id>
```

Use `--output-mode full` only when the user explicitly wants full provider output in the current Claude Code session.

## Visibility

The `aco` runtime session dashboard renders only on an interactive TTY (stderr),
so it stays invisible when `aco ask` runs through a non-TTY host such as the
Claude Code Bash tool or an IDE wrapper. To keep delegation explicit to the
user, announce it in the session text instead of relying on the dashboard.

- Before the live call: print a one-line banner naming the provider and task,
  e.g. `🛰️ aco delegation → <provider>: <task>`.
- After the call returns: state which provider contributed what in a short
  summary (a small markdown table when several providers run). External output
  stays advisory; the main session remains the final synthesizer.
- The goal is that the user notices every external delegation as it happens.

## Safety Notes

- Default permission profile is `restricted`.
- External provider output is advisory.
- Claude Code remains the supervisor and final synthesizer.
- Do not send secrets, credentials, private tokens, or unrelated files.
- Do not create task-specific slash commands; use natural language tasks or `.claude/aco/tasks/<preset>.md`.
