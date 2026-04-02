# ai-cli-orch-wrapper

Installable Claude Code command pack for Gemini CLI and GitHub Copilot CLI, backed by a provider-based Node.js wrapper runtime.

## Install

```bash
# Option 1: npx (no local install required)
npx aco-install

# Option 2: from this repo
npm install
aco pack setup
```

## Provider Setup

After pack installation, configure each provider:

```bash
# Gemini CLI
aco provider setup gemini
# If not installed: npm install -g @google/gemini-cli

# GitHub Copilot CLI
aco provider setup copilot
# If not installed: npm install -g @github/copilot && gh auth login
```

## Commands

| Command | Description |
|---|---|
| `/gemini:review [file]` | Code review via Gemini CLI (`git diff HEAD` if no file) |
| `/gemini:adversarial [--focus security\|performance\|correctness] [file]` | Adversarial review |
| `/gemini:rescue [--from file] [--error msg]` | Get unstuck with second opinion |
| `/gemini:result [--session id]` | Retrieve last/named session output |
| `/gemini:status [--session id]` | Session or provider status |
| `/gemini:cancel [--session id]` | Cancel a running background session |
| `/gemini:setup` | Provider install/auth guidance |
| `/copilot:*` | Same surface for GitHub Copilot CLI |

## Runtime: `aco` CLI

The `aco` wrapper owns execution, session, and output lifecycle:

```bash
aco run gemini review            # run via wrapper
aco run copilot adversarial      # run via wrapper
aco result                       # print last session output
aco result --session <id>        # print named session output
aco status                       # show last session status
aco cancel --session <id>        # cancel a running session
```

Sessions are stored at `~/.aco/sessions/<uuid>/` with `task.json` and `output.log`.

## Repo Layout

```text
packages/
  wrapper/          — aco wrapper runtime (provider interface, session store, CLI)
  installer/        — aco-install CLI (pack install, provider setup)
templates/
  commands/         — Claude Code slash command templates (installed to .claude/commands/)
    gemini/
    copilot/
  prompts/          — Provider prompt templates (installed to .claude/aco/prompts/)
    gemini/
    copilot/
openspec/           — Architecture specs and change proposals
CLAUDE.md
README.md
package.json        — npm workspace root
```

## Tests

```bash
npm test            # runs packages/wrapper unit tests
npm run test:smoke  # provider availability smoke check
```
