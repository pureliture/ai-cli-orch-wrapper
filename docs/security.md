# Security Model

작성일: 2026-05-08

`ai-cli-orch-wrapper` is a consent-gated external AI delegation wrapper for Claude Code. It helps Claude Code ask external AI CLIs for advisory work, but it is not a sandbox, secret scanner, or remote auth verifier.

## Consent-Gated Execution

`aco ask` never invokes providers unless the user gives explicit execution consent.

```bash
aco ask --task "review this input" --dry-run
aco ask --providers mock --task "review this input" --input "demo" --yes
```

`--dry-run` prints the plan and does not create provider sessions. `--yes` is required for provider execution. `--yes` and `--dry-run` are mutually exclusive.

## What `aco ask` Sends

When execution is approved, `aco ask` sends the following to each selected provider:

- advisory system/task prompt
- permission profile guidance
- optional preset instructions from `.claude/aco/tasks/<name>.md`
- task text from `--task`
- explicit user input from `--input`
- explicit file content from `--input-file`

`aco ask` does not implicitly read stdin. It does not automatically discover unrelated project files.

## Token-Saving Output Model

Default output mode is `brief`.

| Mode        | Behavior                                                   |
| ----------- | ---------------------------------------------------------- |
| `brief`     | Prints metadata and a bounded provider summary only        |
| `save-only` | Prints save locations only                                 |
| `full`      | Prints full provider output only when explicitly requested |

Full provider output is stored under `~/.aco/sessions/<session-id>/output.log` and can be read later with `aco result`. Provider-specific summarization strips provider-internal sections (e.g., `Findings:` for the mock provider) before truncating to the 600-character bound. The full output stream is still captured to disk; only the in-memory summary buffer is bounded to limit memory usage.

## Artifact Storage

Artifacts are stored under the local user's home directory:

```text
~/.aco/runs/<run-id>/
~/.aco/sessions/<session-id>/
```

Artifact files can contain user-provided input and provider output. Treat them as local sensitive files when the task input is sensitive.

See [Session And Run Artifacts](reference/session-artifacts.md).

## Environment Caveat

The Node wrapper invokes provider CLIs as local child processes. Those child processes inherit the environment supplied to the `aco` process unless the provider implementation changes that behavior.

Do not run `aco ask --yes` with secrets in the environment unless you are comfortable with the selected provider CLI process seeing that environment.

## Node Wrapper vs Go Runtime Boundary

This repository has both a Node wrapper and a Go runtime. The Go runtime has its own process and environment boundary experiments. Those Go runtime allowlist protections do not automatically apply to Node wrapper provider execution.

For `aco ask`, use the Node wrapper security model documented here.

## Provider Permissions

Default permission profile is `restricted`.

`restricted` means the wrapper requests the safest available provider behavior and includes advisory prompt instructions such as not modifying files. It is not a complete OS-level sandbox and does not prove that a provider cannot modify files if the provider CLI ignores the requested behavior.

Do not enable broader permission profiles unless the task requires it and the provider behavior is understood.

## Timeout And Cancellation Boundary

`aco run` and `aco ask --yes` apply provider execution timeout with this precedence:

1. `--timeout <seconds>`
2. `ACO_TIMEOUT_SECONDS`
3. default `300` seconds

Timeout and `aco cancel --session <id>` are reliability controls. They best-effort terminate provider processes and record session artifacts, but they are not sandbox, secret-redaction, or remote-auth guarantees.

Real Codex/Gemini smoke commands can require provider credentials, local CLI setup, network access, and real provider latency. Keep those commands opt-in and separate from default CI or deterministic repo tests.

## Currently Implemented Protections

### Input-File Credential Guard

`aco ask --input-file <path>` blocks file paths that match common credential and secret file patterns by default:

- `.env`, `.env.local`, `.env.production`, and similar `.env*` variants
- `auth.json`, `*_creds.json`, `*_credentials.json`
- SSH private keys: `id_rsa`, `id_ed25519`, `id_dsa`, `id_ecdsa`
- Private key files: `*.pem`, `*.key`
- Certificate bundles: `*.pfx`, `*.p12`
- Generic secret files: `secrets.json`, `secrets.yaml`, `secrets.yml`
- Well-known CLI credential files: `.codex/auth.json`, `.gemini/oauth_creds.json`

If a blocked path is supplied, `aco ask` exits with an error. To override explicitly:

```bash
aco ask --input-file .env --allow-sensitive --task "..."
```

`--allow-sensitive` prints a warning to stderr and continues. Use it only when you have reviewed the file content and understand the risk.

### Environment Variable Warning

When `aco ask --yes` is about to invoke provider processes, it scans `process.env` for keys whose names end with credential-like suffixes (`_TOKEN`, `_KEY`, `_SECRET`, `_API_KEY`, `_PASSWORD`, `PRIVATE_KEY`). If any are found, a warning listing the key names (not values) is printed to stderr:

```
[aco] warning: the following environment variables look like credentials and will be
inherited by the provider process: GITHUB_TOKEN, OPENAI_API_KEY.
[aco] To suppress this warning, unset these variables before running aco ask.
```

Provider execution is not blocked; the warning is informational only.

## Planned Improvements

The following protections are planned but not yet implemented:

- **Provider env filtering**: opt-in `--no-inherit-env` or allowlist-based env filtering to prevent credential-like environment variables from being passed to provider child processes at all.
- **`.acoignore` enforcement**: file-pattern-based blocklist for `--input-file`. Currently `.acoignore.example` is a policy/example only.

Until env filtering exists, unset sensitive environment variables before running `aco ask`, or use a clean environment wrapper (e.g., `env -i HOME=$HOME ... aco ask ...`).

## Secrets Policy

Do not send secrets, credentials, private tokens, local auth files, or unrelated sensitive files through `--input` or `--input-file`.

The input-file credential guard blocks the most common cases automatically, but it cannot detect all sensitive content. User responsibility remains for:
- Inline `--input` text containing secrets
- Custom file formats that happen to contain credentials
- Files with non-standard names

`aco doctor` does not print secret values. It reports local readiness heuristics only.

## Inspect Before Sharing

Before pasting or sharing provider output, inspect artifacts:

```bash
aco result
cat ~/.aco/sessions/<session-id>/brief.md
cat ~/.aco/runs/<run-id>/ledger.json
```

If output appears to contain secrets, stop and delete or quarantine the artifact locally before sharing.
