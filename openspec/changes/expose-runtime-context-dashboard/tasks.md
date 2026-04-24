## 1. Provider Readiness Metadata

- [x] 1.1 Extend `AuthResult` with optional non-secret fields for auth method, provider version, and binary path.
- [x] 1.2 Update Codex auth detection to report `api-key`, `oauth`, `cli-fallback`, or `missing` without exposing credential values.
- [x] 1.3 Update Gemini auth detection to report `api-key`, `oauth`, `cli-fallback`, or `missing` without exposing credential values.
- [x] 1.4 Add tests for provider auth method detection and redaction behavior.

## 2. Runtime Context Inspection

- [x] 2.1 Add runtime context types for active session facts and exposed provider surfaces.
- [x] 2.2 Collect active runtime facts in `aco run`: provider, command, session id, permission profile, cwd, branch, prompt template path, and auth readiness.
- [x] 2.3 Inspect Codex exposed surfaces from `.codex/agents/*.toml`, `.agents/skills/*/SKILL.md`, `.codex/hooks.json`, and `.codex/config.toml`.
- [x] 2.4 Inspect Gemini exposed surfaces from `.gemini/agents/*.md`, `.agents/skills/*/SKILL.md`, and `.gemini/settings.json`.
- [x] 2.5 Classify discovered data as `active` or `exposed` and avoid marking provider-internal selections as active.

## 3. Dashboard Rendering

- [x] 3.1 Add a small ANSI/formatting helper that supports color, bold, dim, and plain-text fallback without a new dependency.
- [x] 3.2 Render an emoji-enhanced colorful runtime dashboard to stderr when stderr is a TTY and `NO_COLOR`/`CI` are unset.
- [x] 3.3 Render stable plain text without ANSI sequences for non-TTY, `NO_COLOR`, and `CI` environments.
- [x] 3.4 Ensure dashboard output does not enter provider stdout or provider output logs.

## 4. Session Persistence And Status

- [x] 4.1 Persist non-secret runtime metadata in `task.json` or a session-local metadata file.
- [x] 4.2 Update `aco status` to show a concise runtime context summary when metadata is present.
- [x] 4.3 Update `aco pack status` or shared status helpers to reuse provider readiness formatting where practical.
- [x] 4.4 Preserve compatibility with existing session records that do not contain runtime metadata.

## 5. Tests And Documentation

- [x] 5.1 Add runtime context discovery tests for Codex agents, Gemini agents, shared skills, and hooks.
- [x] 5.2 Add dashboard renderer tests for colorful TTY mode and plain automation mode.
- [x] 5.3 Add session store/status tests for runtime metadata persistence and backward compatibility.
- [x] 5.4 Review root `README.md` and `packages/wrapper/README.md`; add or update representative runtime dashboard and command output examples where needed.
- [x] 5.5 Review relevant `docs/` pages; add or update examples for changed `aco run`, provider status, session status, and Codex/Gemini runtime context output where needed.
- [x] 5.6 Document the active versus exposed distinction, TTY versus plain output behavior, stderr/stdout placement, and secret redaction rules.

## 6. Validation

- [x] 6.1 Run `npm test --workspace=packages/wrapper`.
- [ ] 6.2 Run `npm run typecheck --workspace=packages/wrapper`.
- [x] 6.3 Run `git diff --check`.
- [ ] 6.4 Manually smoke `aco run` in a TTY-like environment to verify dashboard placement and provider stdout preservation.
