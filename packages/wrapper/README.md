# @pureliture/ai-cli-orch-wrapper

Public npm package for the `aco` CLI.

## Commands

```bash
aco --version
aco run <provider> <command>
aco ask --preset <name> --dry-run
aco pack install
aco pack setup
aco pack status
aco provider setup antigravity
aco provider setup codex
aco result
aco status
```

Provider run starts with a compact runtime dashboard on stderr so you can see the active session and exposed context.

`aco pack setup` installs packaged runtime assets into the target project:

- `.claude/commands/**`
- `.claude/aco/prompts/**`
- `.claude/aco/tasks/**`

Packaged task presets are `review`, `spec-critique`, `plan-critique`, `tdd`, `code-simplify`, and `default`. Use `aco ask --preset <name> --dry-run` to verify a preset without invoking providers.

If post-install sync fails, use the manifest path printed by setup and run `pack uninstall` through the same entrypoint that launched setup. For global installs, use `pack uninstall --global`.

```text
🛰️  aco Runtime Session

✨ Active
  Provider: antigravity
  Command: review
  Session ID: f3f2d9...b1
  Permission: default
  Working Dir: /path/to/repo
  Branch: main
  Prompt Template: /path/to/repo/.claude/aco/prompts/antigravity/review.md
  Auth: ready (keyring)

🧩 Exposed
  Providers: antigravity
  Agents: reviewer
  Hooks: PostToolUse
  Config: settings.json
  Shared Skills: review-skill
```

## Provider Auth

`aco provider setup <provider>` checks the provider binary first, then uses local
credential-readiness heuristics before spawning the CLI. The `--version` fallback verifies binary
availability; it is not a remote authentication check.

| Provider    | Fast-path auth sources         | Fallback          |
| ----------- | ------------------------------ | ----------------- |
| Antigravity | OS Keyring (no API key env)    | `agy --version`   |
| Codex       | `OPENAI_API_KEY`, `~/.codex/auth.json` | `codex --version` |

Expired Codex OAuth tokens report `codex login` as the fix.

## Development

```bash
npm run build
npm test
npm run test:pack-runtime-contract
```
