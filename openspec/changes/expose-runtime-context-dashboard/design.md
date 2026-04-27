## Context

The current `aco` runtime already has the core signals needed for a useful runtime dashboard:

- Provider registry knows the available provider keys.
- Providers expose `isAvailable()` and `checkAuth()`.
- `aco run` creates a session record before invoking the provider.
- `aco sync` and generated target surfaces define where Codex and Gemini agents, skills, and hooks live.

What is missing is a session-native display layer. `aco pack status` can show installed/authenticated providers, but `aco run` does not show a visible activation indicator or the surrounding runtime context. Users therefore cannot easily see whether Codex or Gemini is active, which prompt/session is being used, or which generated context surfaces are exposed to that provider.

The design should keep the colorful, high-signal feel of Claude Octopus style provider activation while preserving `aco` contracts: provider-neutral abstractions, safe auth handling, and clean provider stdout.

## Goals / Non-Goals

**Goals:**
- Show a visually distinct runtime dashboard when a provider-backed `aco` session starts.
- Use emoji, color, bold labels, separators, and compact status chips in interactive terminals.
- Show plain, deterministic output in non-interactive environments.
- Distinguish active runtime facts from exposed context surfaces.
- Inspect Codex/Gemini agents, shared skills, and hooks without claiming they were selected by the provider unless `aco` directly selected them.
- Persist non-secret runtime metadata for later `aco status` display.
- Update README and relevant docs with the post-change runtime dashboard output so users can see the expected TUI/plain output behavior.
- Avoid leaking API keys, OAuth tokens, auth file contents, full prompts, or command stdin content.
- Keep provider stdout suitable for callers and sentinel/meta parsing.

**Non-Goals:**
- Implement provider-internal telemetry for whether Codex or Gemini actually selected a skill during its own reasoning.
- Build a full terminal UI framework.
- Add multi-provider orchestration or consensus workflows.
- Change provider auth setup semantics.
- Change the provider invocation contract or supported CLI flags.

## Decisions

### 1. Render the dashboard to stderr, not provider stdout

**Decision:** `aco run` SHALL print the decorative runtime dashboard to stderr by default. Provider stdout remains reserved for provider output and existing meta/sentinel contracts.

**Rationale:** The dashboard is for humans. Provider stdout may be consumed by scripts, stored as raw output, or parsed for sentinel lines. Mixing decorative UI into stdout would make automation brittle.

**Alternative considered:** Print the banner to stdout before provider output. Rejected because it would pollute raw provider output and session result logs.

### 2. Store structured runtime metadata separately from decorative rendering

**Decision:** Runtime inspection SHALL produce a structured object first, then render it as colorful TTY output or plain text depending on environment. The same non-secret object SHALL be persisted in the session record or a session-local metadata file.

**Rationale:** Rendering and data capture have different consumers. Separating them keeps `aco status` and tests stable while allowing the human-facing dashboard to evolve.

**Alternative considered:** Build the dashboard as formatted strings only. Rejected because it would make status reuse and testing fragile.

### 3. Use active versus exposed sections

**Decision:** The dashboard SHALL separate:

- `Active`: facts `aco` directly controls in the current run, such as provider, command, session id, permission profile, cwd, branch, prompt template, and auth status.
- `Exposed`: context surfaces available to the selected provider or host, such as `.codex/agents`, `.gemini/agents`, `.agents/skills`, `.codex/hooks.json`, and `.gemini/settings.json`.

**Rationale:** `aco` can prove which provider it invoked, but it cannot always prove which generated agent, skill, or hook the downstream provider internally used. The distinction prevents false claims while still giving users the desired visibility.

**Alternative considered:** Show all discovered agents/skills/hooks as active. Rejected because it overstates what the runtime knows.

### 4. Extend provider auth results with safe detail

**Decision:** Provider auth inspection SHOULD include safe method details such as `api-key`, `oauth`, `cli-fallback`, or `missing`, plus a version or binary path when available. It MUST NOT include secret values or auth file contents.

**Rationale:** Users want to know whether the ready state comes from OAuth, an API key, or a fallback probe. That is useful operational context and can be exposed safely if values are redacted.

**Alternative considered:** Keep `AuthResult` as only `{ ok, hint }`. Rejected because it forces the dashboard to infer too much from provider-specific checks.

### 5. Keep color and emoji opt-in by terminal capability

**Decision:** The renderer SHALL use colorful emoji-enhanced output only when stderr is a TTY and neither `NO_COLOR` nor `CI` is set. Non-TTY output SHALL be plain text and stable enough for logs.

**Rationale:** Interactive users get the intended visual identity. CI, logs, and scripted usage avoid ANSI control sequences and noisy decoration.

**Alternative considered:** Always print colorful output. Rejected because it degrades logs and can break simple parsers.

### 6. Avoid a new rendering dependency initially

**Decision:** Use a small local ANSI helper for color/bold/dim rendering instead of adding a dependency for the initial version.

**Rationale:** The needed styling is small, and avoiding a dependency keeps the wrapper package simple. A dependency can be introduced later if layout needs grow.

**Alternative considered:** Add a terminal UI package. Rejected for v1 because the dashboard is a compact status panel, not an interactive UI.

### 7. Treat dashboard examples as part of the user contract

**Decision:** Implementation SHALL include a documentation pass over root `README.md`, `packages/wrapper/README.md`, and relevant files under `docs/` to add or update representative runtime dashboard output examples where they help users understand the feature.

**Rationale:** The dashboard is a user-facing terminal experience, not only an internal metadata change. Without documented examples, users cannot easily tell whether the colorful TTY output, plain non-TTY output, active/exposed sections, and stderr/stdout separation are intentional.

**Alternative considered:** Rely only on tests and code behavior. Rejected because this feature is primarily experienced through CLI output, so the expected output should be visible in user documentation.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Dashboard implies provider-internal skill usage that `aco` cannot verify | Separate `Active` and `Exposed`, and use precise labels |
| Auth method detection leaks sensitive data | Store only method names, booleans, hints, versions, and redacted paths |
| Decorative output breaks automation | Render to stderr, disable color in non-TTY/CI/NO_COLOR, preserve provider stdout |
| Extra filesystem inspection slows startup | Keep inspection shallow and bounded to known directories/files |
| Provider auth checks add latency to `aco run` | Reuse existing fast-path checks and avoid slow provider execution where possible |
| Session metadata format churn breaks consumers | Add optional fields and preserve existing `TaskRecord` fields |
| Documented output examples drift from implementation | Add documentation update tasks after renderer behavior is finalized |

## Migration Plan

1. Add a runtime inspection helper that collects provider, auth, session, git, prompt, agent, skill, and hook metadata without secrets.
2. Extend provider auth results with optional safe fields for method, version, and binary path.
3. Add a renderer that emits colorful stderr output for TTY and plain output for non-TTY.
4. Persist runtime metadata in the session record or a session-local metadata file.
5. Update `aco status` and `aco pack status` to reuse the same structured inspection where appropriate.
6. Review root `README.md`, `packages/wrapper/README.md`, and relevant `docs/` pages; add updated TUI/plain output examples where needed.
7. Add unit tests for auth method detection, metadata redaction, active/exposed classification, TTY rendering, and non-TTY fallback.

Rollback is straightforward: disable dashboard rendering while leaving existing provider execution and session storage behavior intact.

## Open Questions

- Should the dashboard be enabled by default for every `aco run`, or gated by `--runtime-dashboard` until the visual design settles?
- Should users get a `--no-runtime-dashboard` flag in addition to environment controls?
- Should `aco status` show the full exposed surface summary or only active session facts by default?
