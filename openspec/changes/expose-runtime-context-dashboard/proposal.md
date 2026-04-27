## Why

`aco` already checks Codex and Gemini CLI installation/authentication, but that information is only surfaced through setup/status commands. During a real provider run, users cannot quickly see which provider is active, what runtime context is being used, or which agent/skill/hook surfaces are exposed to Codex and Gemini.

Claude Octopus sets a useful precedent: provider activation should feel visible, colorful, and session-native rather than hidden behind plain setup diagnostics. This change brings that runtime presence to `aco` while preserving provider-neutral behavior and avoiding secret leakage.

## What Changes

- Add a colorful TTY runtime dashboard shown when `aco` starts a provider-backed session.
- Show active execution context, including provider, command, session id, permission profile, working directory or branch, prompt template, and auth state.
- Show exposed Codex/Gemini context surfaces, including generated agents, shared skills, and configured hooks, while clearly distinguishing exposed surfaces from surfaces proven active in the current run.
- Keep the dashboard safe for automation: use plain text or suppress decorative styling in non-TTY, `CI`, or `NO_COLOR` environments.
- Persist the same non-secret runtime metadata in the session record so `aco status` can summarize the session after launch.
- Preserve provider stdout and sentinel/meta contracts by avoiding decorative HUD output in provider stdout streams.
- Review README and docs surfaces after implementation and add representative before/after command output or TUI examples wherever users need to understand the new dashboard.

## Capabilities

### New Capabilities

- `runtime-context-dashboard`: Defines the terminal dashboard, runtime metadata, active-versus-exposed context distinction, and safe display behavior for provider-backed `aco` sessions.

### Modified Capabilities

## Impact

- Affected runtime paths: `packages/wrapper/src/cli.ts`, `packages/wrapper/src/session/store.ts`, `packages/wrapper/src/providers/`, and likely a new small runtime/context inspection helper.
- Affected setup/status paths: `packages/installer/src/commands/pack-install.ts` and `aco pack status` output may share provider/context inspection formatting.
- Affected documentation paths: root `README.md`, `packages/wrapper/README.md`, and relevant `docs/` references or guides.
- Affected tests: provider auth tests, session record tests, and new dashboard rendering/context inspection tests.
- No breaking CLI argument changes are expected.
- No provider auth secrets, API key values, OAuth token contents, or full prompt bodies should be displayed or persisted.
