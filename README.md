# ai-cli-orch-wrapper

Installable Claude Code command pack for Gemini CLI and GitHub Copilot CLI, backed by a provider-based Node.js wrapper runtime.

## Install

```bash
# Option 1: npx (no local install required)
npx aco-install

# Option 2: from this repo
npm install
aco-install pack setup
```

After installation, verify the published CLIs are reachable:

```bash
npx aco-install --version
npx @aco/wrapper --version
```

## Provider Setup

After pack installation, configure each provider:

```bash
# Gemini CLI
aco-install provider setup gemini
# If not installed: npm install -g @google/gemini-cli

# GitHub Copilot CLI
aco-install provider setup copilot
# If not installed: npm install -g @github/copilot && gh auth login
```

## Commands

| Command | Description |
|---|---|
| `/gemini:review [file]` | Code review via Gemini CLI (`git diff HEAD` if no file) |
| `/gemini:adversarial [--focus security\|performance\|correctness] [file]` | Adversarial review |
| `/gemini:rescue [--from file] [--error msg]` | Get unstuck with second opinion |
| `/gemini:result [<session-id>]` | Retrieve last/named session output |
| `/gemini:status [<session-id>]` | Session or provider status |
| `/gemini:cancel [<session-id>]` | Cancel a running background session |
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

Sessions are stored at `~/.aco/sessions/<uuid>/` with restrictive permissions:

| File | Permissions | Purpose |
|---|---|---|
| `task.json` | `0600` | provider, command, status, pid, timestamps |
| `output.log` | `0600` | streamed provider output |
| `error.log` | `0600` | provider stderr and wrapper error details |

The session directory itself is created with `0700`.

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
.github/
  prompts/          — OpenSpec prompt surfaces for GitHub-side agents
  skills/           — OpenSpec workflow skill definitions
.claude/
  commands/opsx/    — Claude-side OpenSpec command entry points
  skills/           — Claude-side OpenSpec workflow skills
openspec/           — Architecture specs and change proposals
  changes/          — Active OpenSpec changes
CLAUDE.md
README.md
package.json        — npm workspace root
```

## OpenSpec Workflow

This repository is initialized for OpenSpec-based change tracking.

- Workflow assets live in `openspec/`, `.github/prompts/`, `.github/skills/`, `.claude/commands/opsx/`, and `.claude/skills/`.
- Create or inspect work with `openspec new change <name>`, `openspec list --json`, and `openspec status --change <name> --json`.
- Continue an implementation-ready change with `openspec instructions apply --change <name> --json`.
- Validate artifacts with `openspec validate <name>` before treating a change as complete.

## Development

```bash
git clone <repo>
cd ai-cli-orch-wrapper
npm install
npm run build
```

Build order matters: `packages/wrapper` must compile before `packages/installer`. The root `npm run build` script already enforces that order.

## Tests

```bash
npm test            # runs packages/wrapper unit tests
npm run test:smoke  # provider availability smoke check
```

## Troubleshooting

### `aco: command not found`

Install the wrapper binary explicitly:

```bash
npm install -g @aco/wrapper
```

### Provider not found or not authenticated

```bash
aco-install provider setup gemini
aco-install provider setup copilot
```

Gemini CLI installs via `npm install -g @google/gemini-cli`.  
Copilot CLI installs via `npm install -g @github/copilot && gh auth login`.

### Slash commands missing after install

Re-copy the templates:

```bash
aco-install pack install
```

### Build fails in `packages/installer`

Build the packages in dependency order:

```bash
npm run build --workspace=packages/wrapper
npm run build --workspace=packages/installer
```

## Publishing

Release flow, in order:

```bash
npm run build
cd packages/wrapper && npm publish
cd ../installer && npm publish
```

## Docs

- [Architecture](docs/architecture.md)
- [Contributing](docs/CONTRIBUTING.md)
- [Runbook](docs/RUNBOOK.md)
