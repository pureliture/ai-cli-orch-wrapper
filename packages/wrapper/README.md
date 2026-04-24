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
