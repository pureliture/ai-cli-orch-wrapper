# Claude Code Gemini/Copilot Spawn Pack

This repository contains a minimal Claude Code command pack for spawning
Gemini CLI and GitHub Copilot CLI from slash commands.

## Scope

Included commands:
- `/gemini:review`
- `/gemini:adversarial`
- `/gemini:rescue`
- `/gemini:result`
- `/gemini:cancel`
- `/gemini:status`
- `/gemini:setup`
- `/copilot:review`
- `/copilot:adversarial`
- `/copilot:rescue`
- `/copilot:result`
- `/copilot:cancel`
- `/copilot:status`
- `/copilot:setup`

Common execution logic lives in `.claude/aco/lib/adapter.sh`.

## Layout

```text
.claude/
  aco/
    lib/
      adapter.sh
    prompts/
      gemini/
      copilot/
    tests/
  commands/
    gemini/
    copilot/
CLAUDE.md
README.md
package.json
```

## Prerequisites

- `gemini` available in `PATH`
- `copilot` available in `PATH`
- `gh auth login` completed for Copilot

## Usage In Claude Code

```text
/gemini:status
/copilot:status
/gemini:review
/copilot:review path/to/file.ts
/gemini:adversarial --focus security
/copilot:adversarial --background --focus correctness
/gemini:result <task-id>
/copilot:cancel <task-id>
/gemini:rescue --from logs/error.txt
```

Behavior:
- `review` reads `git diff HEAD` when no file argument is provided
- `adversarial` runs a more aggressive review with optional `--focus`
- `rescue` sends a problem description, file content, stdin, or error text
- `result` and `cancel` manage background tasks

## Verification

Deterministic checks:

```bash
npm test
```

Environment smoke:

```bash
npm run test:smoke
```
