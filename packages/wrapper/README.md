# @pureliture/ai-cli-orch-wrapper

Public npm package for the `aco` CLI.

## Commands

```bash
aco --version
aco run <provider> <command>
aco pack install
aco pack setup
aco pack status
aco provider setup gemini
aco provider setup codex
aco result
aco status
```

Provider run starts with a compact runtime dashboard on stderr so you can see the active session and exposed context.

```text
🛰️  aco Runtime Session

✨ Active
  Provider: gemini
  Command: review
  Session ID: f3f2d9...b1
  Permission: default
  Working Dir: /path/to/repo
  Branch: main
  Prompt Template: /path/to/repo/.claude/aco/prompts/gemini/review.md
  Auth: ready (cli-fallback, vgemini-cli 1.2.3, bin gemini)

🧩 Exposed
  Providers: gemini
  Agents: reviewer
  Hooks: PostToolUse
  Config: settings.json
  Shared Skills: review-skill
```

## Provider Auth

`aco provider setup <provider>` checks the provider binary first, then uses local
credential-readiness heuristics before spawning the CLI. The `--version` fallback verifies binary
availability; it is not a remote authentication check.

| Provider | Fast-path auth sources                                           | Fallback           |
| -------- | ---------------------------------------------------------------- | ------------------ |
| Gemini   | `GEMINI_API_KEY`, `GOOGLE_API_KEY`, `~/.gemini/oauth_creds.json` | `gemini --version` |
| Codex    | `OPENAI_API_KEY`, `~/.codex/auth.json`                           | `codex --version`  |

Expired Codex OAuth tokens report `codex login` as the fix.

## Development

```bash
npm run build
npm test
```
