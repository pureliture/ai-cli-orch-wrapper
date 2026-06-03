---
name: aco-delegation
description: Use when a Claude Code session should consider delegating an advisory review, critique, or analysis task to external AI CLIs through aco ask.
---

# aco Delegation

Use `aco ask` when an external Codex/Antigravity/mock CLI perspective can save Claude Code context tokens or provide an advisory second opinion.

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

## Safety Notes

- Default permission profile is `restricted`.
- External provider output is advisory.
- Claude Code remains the supervisor and final synthesizer.
- Do not send secrets, credentials, private tokens, or unrelated files.
- Do not create task-specific slash commands; use natural language tasks or `.claude/aco/tasks/<preset>.md`.
