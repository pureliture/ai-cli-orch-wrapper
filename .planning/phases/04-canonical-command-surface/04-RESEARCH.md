# Phase 04: Canonical Command Surface - Research

**Researched:** 2026-03-31
**Domain:** Node.js CLI command-surface consolidation and legacy invocation recovery
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
### Canonical command name
- **D-01:** 최종 canonical end-user command는 `wrapper`가 아니라 `aco`다.
- **D-02:** Phase 04 범위의 user-facing runtime surface에서는 `wrapper`를 의도적으로 남기지 않는다.
- **D-03:** help, usage, version, unknown-command, stale invocation remediation에서 사용자에게 보이는 이름은 `aco`만 사용한다.

### Public invocation policy
- **D-04:** 지원되는 공식 public invocation path는 `aco` 하나만 둔다.
- **D-05:** `node dist/cli.js` 같은 raw entrypoint는 개발/테스트용 내부 경로로만 취급하고, 일반 사용자 사용 예시로 노출하지 않는다.

### Legacy invocation handling
- **D-06:** `wrapper`를 compatibility alias로 남기지 않는다.
- **D-07:** 사용자가 stale invocation 또는 예전 packaging assumption으로 들어오면 묵시적으로 통과시키지 말고, 명확히 실패시키면서 `aco`를 사용하라고 직접 안내한다.
- **D-08:** 목표는 점진적 병행 운영이 아니라 clean cutover다. Phase 04 범위 안에서는 남아 있는 옛 command naming을 찾아 `aco` 기준으로 치환한다.

### Remediation wording
- **D-09:** 복구 메시지는 짧고 직접적으로 유지한다.
- **D-10:** 복구 메시지에는 정확한 다음 행동 1개만 제시한다. 예시는 상황에 따라 `aco help` 또는 `aco setup` 중 하나를 고른다.

### Claude's Discretion
- stale invocation을 어떤 조건에서 감지할지에 대한 구현 방식
- 에러 상황별로 어떤 단일 next-step example을 붙일지 (`aco help` vs `aco setup`)
- package metadata와 내부 개발자용 설명에서 repo/package identity를 어디까지 유지할지에 대한 비-user-facing 정리 순서

### Deferred Ideas (OUT OF SCOPE)
- repo-local 계약 rename: `.wrapper.json`, `.wrapper/`, `wrapper.lock`를 `aco` 기준 이름으로 정리하는 작업은 다음 phase의 runtime contract 범위에서 이어서 처리
- command surface 바깥의 광범위한 문서/저장소 identity cleanup은 runtime phases 이후 남는 항목이 있으면 후속 정리 대상으로 추적
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CMD-01 | User can invoke the installed CLI through the canonical `wrapper` command on a supported machine | Treat REQUIREMENTS wording as stale milestone text. Implement the same acceptance target against installed `aco` by changing `package.json#bin`, regenerating `dist/`, and validating `npm link` / global-bin behavior. |
| CMD-02 | User sees `wrapper` in help, usage, version, and command error output instead of legacy command labels | Treat REQUIREMENTS wording as stale milestone text. Replace command-surface literals with `aco`, remove repo-name leakage from help/version/error output, and lock this with subprocess tests. |
| WRAP-03 | User receives direct remediation telling them to use `wrapper` when they hit a stale command invocation or packaging assumption | Treat REQUIREMENTS wording as stale milestone text. Implement fail-fast remediation that tells the user to use `aco`, with exactly one next-step example (`aco help` or `aco setup`). |
</phase_requirements>

## Summary

Phase 04 is a selective rename, not a global rename. The current shipped command surface is still fully `wrapper`-based: `package.json` installs `wrapper`, `src/cli.ts` prints `Usage: wrapper <command>`, version output is `ai-cli-orch-wrapper v0.3.0`, and the existing regression tests assert those exact strings. At the same time, the repo-local runtime contract remains `.wrapper.json` and `.wrapper/workflows`, and those paths are already used by code and persisted data in the working tree. The planner must separate these two concerns cleanly.

The practical implementation target is small but sharp: keep the runtime contract untouched, centralize the public command-surface metadata around `aco`, preserve built-ins-first dispatch, and add one explicit stale-path recovery flow. The current CLI does not distinguish between a missing command, a stale `wrapper` token, and a raw-entrypoint packaging assumption. `node dist/cli.js` currently falls into `Error: unknown command 'undefined'`, which is a poor baseline and should be normalized during this phase.

The biggest planning trap is runtime state outside git. This machine already has a global `/opt/homebrew/bin/wrapper` symlink created by `npm link`, and `~/.config/tmux/ai-cli.conf` still contains `wrapper` wording. Code edits alone will not migrate those installations. Phase 04 therefore needs both code changes and explicit re-link / refresh verification steps, while still deferring `.wrapper*` artifact renames to Phase 05.

**Primary recommendation:** Keep package identity internal, switch the single public executable to `aco` via `package.json#bin`, centralize all user-facing strings in one metadata helper, add explicit stale-invocation remediation, and add dedicated subprocess tests that lock the `aco` surface while preserving `.wrapper*` runtime paths.

## Project Constraints (from CLAUDE.md)

- `cao`, `tmux`, and `workmux` are assumed preinstalled; Phase 04 must not plan automatic installation.
- `~/.tmux.conf` must remain non-invasive; setup logic may only manage `~/.config/tmux/ai-cli.conf` and a single `source-file` line.
- Portability is a hard requirement; runtime state needed by the tool must stay reproducible from this repo.
- Do not hardcode registry-hub URLs or couple this wrapper to registry-hub implementation details.
- The repo is a pure Node.js / TypeScript CLI with zero runtime dependencies today; CLAUDE.md does not justify introducing a new CLI framework for this phase.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | `>=18.0.0` repo requirement; `25.7.0` available locally | CLI runtime, stdlib, test runner | Existing code already uses pure Node APIs and built-in subprocess/file handling |
| npm | `11.10.1` available locally | Package/bin installation surface | `package.json#bin` is the authoritative executable-install contract |
| TypeScript | repo range `^5.0.0`; latest registry `6.0.2` published `2026-03-23T16:14:45.521Z` | Compilation and types | Existing build/lint/test flow already assumes `tsc` with `NodeNext` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:test` | built into current Node | Regression tests via subprocess spawning | Keep using for CLI surface tests; no external test framework needed |
| `@types/node` | repo range `^20.0.0`; latest registry `25.5.0` published `2026-03-12T15:48:00.014Z` | Type coverage for Node APIs | Keep aligned with Node-focused codebase; no upgrade required for this phase |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `bin: { "aco": "dist/cli.js" }` | `bin: "dist/cli.js"` | String form would expose the package `name` as the command. Because package `name` is still `ai-cli-orch-wrapper`, object form is required if public command stays `aco`. |
| Keeping package `name` internal for now | Renaming package `name` to `aco` in Phase 04 | Broader package/repo identity cleanup than the locked scope requires |
| Existing manual argv dispatch | Adding Commander/Yargs | Violates the repo’s current zero-runtime-dependency posture and is unnecessary for this narrow cutover |

**Installation:**
```bash
npm install
npm run build
```

**Version verification:**
- `typescript`: `6.0.2` published `2026-03-23T16:14:45.521Z`
- `@types/node`: `25.5.0` published `2026-03-12T15:48:00.014Z`

## Architecture Patterns

### Recommended Project Structure
```text
src/
├── cli.ts                 # argv entrypoint and dispatch only
├── cli-surface.ts         # canonical command name, help text, version, recovery helpers
├── commands/              # setup / workflow / alias handlers
└── config/                # .wrapper.json contract (unchanged in Phase 04)
```

### Pattern 1: Centralize Public Command Metadata
**What:** Put the canonical command name, displayed version, help header, and recovery helpers in one small module.
**When to use:** Any string the user sees in help, usage, version, unknown-command, or stale-invocation output.
**Example:**
```ts
// Source: local pattern from src/cli.ts + package.json
export const CANONICAL_COMMAND = 'aco';

export function formatUsage(): string {
  return `Usage: ${CANONICAL_COMMAND} <command>`;
}
```

### Pattern 2: Classify Invocation Before Dispatch
**What:** Separate supported canonical invocation, raw internal entrypoint usage, and stale legacy invocation before normal command dispatch.
**When to use:** Before built-in command matching and before alias/workflow resolution.
**Example:**
```ts
// Source: Node process docs + local symlink probe
import path from 'node:path';

const invokedPath = process.argv[1] ?? '';
const invokedName = path.basename(invokedPath);
const subcommand = process.argv[2];
```

### Pattern 3: Preserve Built-Ins-First Dispatch
**What:** Keep `setup`, `help`, `version`, `workflow`, and `workflow-run` ahead of alias lookup.
**When to use:** During the `aco` cutover and while adding stale-invocation checks.
**Example:**
```ts
// Source: src/cli.ts
if (command === 'setup') { /* ... */ }
else if (command === 'help') { /* ... */ }
else if (command && config.aliases[command]) { /* alias dispatch */ }
```

### Anti-Patterns to Avoid
- **Global search-and-replace of `wrapper`:** This will break deferred `.wrapper.json` / `.wrapper/` runtime contracts.
- **Keeping `wrapper` as a hidden alias:** Locked decisions explicitly reject gradual parallel operation.
- **Duplicating version/help strings:** The repo already has drift: `package.json` is `0.2.0`, while CLI output and tests assert `0.3.0`.
- **Treating no-args and stale-invocation failures as the same branch:** `unknown command 'undefined'` is not acceptable recovery UX.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Public executable installation | Custom shell-link logic | `package.json#bin` | npm already handles symlink/cmd shim creation cross-platform |
| Displayed version text | Hardcoded version literals in CLI/tests | One package-version source of truth | Prevents the current `0.2.0` vs `0.3.0` drift |
| Recovery text | Per-branch ad hoc strings | One helper that returns a short message plus exactly one next step | Enforces D-09 and D-10 consistently |
| Rename scope | Blanket replacement of every `wrapper` string | Explicit allowlist of command-surface locations | Prevents accidental `.wrapper*` contract breakage |

**Key insight:** The difficult part of this phase is not argument parsing. It is boundary control: deciding exactly which `wrapper` strings are command-surface debt and which are deferred runtime-contract identifiers.

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Repo root currently contains `.wrapper.json` and `.wrapper/workflows/{ad-hoc,plan-review}/runs`; `wrapper.lock` is absent | **Phase 04:** preserve these paths. Code edit only. **Data migration:** none in this phase; rename/migration deferred to Phase 05. |
| Live service config | None — no external service UI/database config was found during repo and local-machine inspection | None for Phase 04 |
| OS-registered state | `/opt/homebrew/bin/wrapper` exists and symlinks to `../lib/node_modules/ai-cli-orch-wrapper/dist/cli.js`; global npm install is `ai-cli-orch-wrapper@0.2.0 -> ./../../../Users/pureliture/ai-cli-orch-wrapper`; `~/.config/tmux/ai-cli.conf` contains `# ai-cli-orch-wrapper tmux config` and `# Managed by wrapper setup` | **Code edit:** change future generated text to `aco` or neutral wording. **Runtime refresh:** after changing `bin`, rebuild and re-link/reinstall so `aco` exists and stale `wrapper` is removed. **Potential migration:** decide whether `aco setup` should rewrite managed `ai-cli.conf` headers on existing machines. |
| Secrets/env vars | No live `WRAPPER_*` or `ACO_*` variables are set in the current shell. Code/tests do reference `WRAPPER_CAO_BASE_URL` | If renamed in Phase 04, this is a code/test update plus rollout note. No stored-secret migration was observed locally. |
| Build artifacts | `dist/` is ignored but active; the global `wrapper` symlink resolves directly to this repo’s `dist/cli.js`; no packaged archives or installed egg-info-style artifacts were found | Rebuild `dist/` and re-link/reinstall after the cutover. No data migration required. |

## Common Pitfalls

### Pitfall 1: Renaming the Runtime Contract Too Early
**What goes wrong:** `.wrapper.json` or `.wrapper/workflows` gets renamed while only the command surface was supposed to change.
**Why it happens:** `wrapper` appears in many files, but not all appearances belong to the same boundary.
**How to avoid:** Maintain an explicit Phase 04 allowlist: `package.json#bin`, CLI help/usage/version/error output, setup-generated user-facing comments, and tests that lock those strings.
**Warning signs:** Workflow artifact tests or setup/config tests start failing on `.wrapper*` paths.

### Pitfall 2: Version Drift Survives the Cutover
**What goes wrong:** `aco version` shows a stale hardcoded value even after package metadata changes.
**Why it happens:** `src/cli.ts` prints a literal `ai-cli-orch-wrapper v0.3.0`, while `package.json` is `0.2.0`.
**How to avoid:** Make the displayed version come from one source of truth.
**Warning signs:** `npm test` passes only because assertions were updated to the wrong literal.

### Pitfall 3: Stale Invocation Detection Is More Fragile Than It Looks
**What goes wrong:** Detection logic works for Unix symlinks but not for every install shim or raw-entrypoint path.
**Why it happens:** Node guarantees `process.argv[1]` is the entrypoint path, but the exact path depends on how the executable/shim launched the script.
**How to avoid:** Keep the detection logic narrow, test the paths you claim to support, and explicitly document any platform caveats.
**Warning signs:** `aco` works locally, but stale `wrapper` remediation cannot be reproduced after reinstall on another shell/OS.

### Pitfall 4: Existing Managed Files Keep Old Branding
**What goes wrong:** New installs say `aco`, but existing `~/.config/tmux/ai-cli.conf` files still say `wrapper setup`.
**Why it happens:** `setupCommand()` currently treats existing files as immutable/idempotent success cases.
**How to avoid:** Decide whether Phase 04 only changes new output or also rewrites managed headers on rerun.
**Warning signs:** `aco setup` reports success without touching stale wrapper wording in managed files.

### Pitfall 5: No-Args Recovery Remains Broken
**What goes wrong:** Running the CLI without a subcommand still prints `unknown command 'undefined'`.
**Why it happens:** Missing-command handling currently falls through the same branch as unknown-command handling.
**How to avoid:** Add an explicit zero-arg path and give it one short next step.
**Warning signs:** Snapshot or subprocess tests still contain the string `'undefined'`.

## Code Examples

Verified patterns from authoritative sources and current repo behavior:

### Object `bin` Mapping for a Different Public Command Name
```json
// Source: https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#bin
{
  "name": "ai-cli-orch-wrapper",
  "bin": {
    "aco": "dist/cli.js"
  }
}
```

### Invocation Classification Inputs
```ts
// Source: https://nodejs.org/api/process.html#processargv
import path from 'node:path';

const invokedPath = process.argv[1] ?? '';
const invokedName = path.basename(invokedPath);
const argv = process.argv.slice(2);
```

### Spawn-Based CLI Regression Test Shape
```ts
// Source: local pattern from test/workflow-cli.test.ts and test/alias.test.ts
const result = spawnSync(process.execPath, [CLI_PATH, 'help'], {
  cwd,
  encoding: 'utf8',
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Public command hardcoded as `wrapper` in install metadata and CLI text | Canonical public command is `aco`; `wrapper` must be treated as stale | Locked in `04-CONTEXT.md` on `2026-03-31` | Phase 04 must correct code/tests/user-facing runtime output despite stale roadmap wording |
| Package name, displayed CLI name, and version are all independently hardcoded | Internal package identity may stay, but displayed command-surface metadata should come from one shared source | Best-practice correction for current drift | Prevents inconsistent help/version/install behavior |
| Zero-arg and stale invocation both hit generic unknown-command handling | Recovery path should classify failure type and suggest exactly one next step | Required by D-07 through D-10 | Cleaner remediation and simpler regression assertions |

**Deprecated/outdated:**
- `wrapper` as the canonical end-user command: superseded by locked Phase 04 decisions.
- `node dist/cli.js --help` as a user-facing quick-start example: raw entrypoint is now internal/developer-only.

## Open Questions

1. **How broad should stale-invocation detection be across platforms?**
What we know: Unix-style symlink invocation preserves the invoked path in `process.argv[1]`; local probes with `aco` and `wrapper` symlinks confirm this.
What's unclear: Whether every supported Windows/npm shim path preserves enough information for the same detection strategy.
Recommendation: Plan for one tested implementation path first, and add a manual verification step for `npm link`/global install behavior before claiming cross-platform coverage.

2. **Should `WRAPPER_CAO_BASE_URL` be renamed in Phase 04 or deferred?**
What we know: No live env var is set locally, but code/tests reference the name.
What's unclear: Whether maintainers consider this part of the user-facing command surface or part of the broader runtime contract.
Recommendation: Treat it as a scoped decision item during planning. If renamed now, add a compatibility note and update tests in the same wave.

3. **Should `aco setup` rewrite existing managed `ai-cli.conf` comments?**
What we know: Existing managed file content on this machine still says `wrapper`.
What's unclear: Whether Phase 04 should migrate existing managed text or only change new output.
Recommendation: Include an explicit task decision. If user-facing runtime surface must be fully clean immediately, migrate the managed header on rerun.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build, CLI execution, tests | ✓ | `v25.7.0` | — |
| npm | install/link/build/test workflow | ✓ | `11.10.1` | — |
| `tmux` | `setup` verification path | ✓ | `tmux 3.6a` | — |
| `workmux` | `setup` verification path | ✓ | `workmux 0.1.140` | — |
| `cao` | `setup` verification path, alias/workflow runtime | ✓ | version output not reported; executable at `/Users/pureliture/.local/bin/cao` | — |

**Missing dependencies with no fallback:**
- None

**Missing dependencies with fallback:**
- None

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (`node --test`) |
| Config file | none |
| Quick run command | `node --test test/alias.test.ts test/workflow-cli.test.ts test/setup.test.ts` |
| Full suite command | `npm test && npm run lint` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CMD-01 | Installed/public command surface exposes `aco` as the canonical executable | integration | `node --test test/canonical-command-surface.test.ts` | ❌ Wave 0 |
| CMD-02 | Help, usage, version, and unknown-command output show `aco` and not `wrapper` | integration | `node --test test/canonical-command-surface.test.ts` | ❌ Wave 0 |
| WRAP-03 | Stale `wrapper` / raw-entrypoint assumptions fail with direct `aco` remediation | integration | `node --test test/canonical-command-surface.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test test/alias.test.ts test/workflow-cli.test.ts test/setup.test.ts`
- **Per wave merge:** `npm test && npm run lint`
- **Phase gate:** Full suite green plus a manual smoke check of the installed executable after `npm link` or equivalent reinstall (`aco help`, and confirm stale `wrapper` behavior)

### Wave 0 Gaps
- [ ] `test/canonical-command-surface.test.ts` — dedicated subprocess coverage for `aco`, zero-arg recovery, and stale-invocation remediation
- [ ] A packaging smoke assertion for global-bin cutover (`package.json#bin` + `npm link` behavior) — likely manual in Phase 04 unless a portable harness is added

## Sources

### Primary (HIGH confidence)
- Local code inspection: `package.json`, `src/cli.ts`, `src/commands/setup.ts`, `src/config/wrapper-config.ts`, `test/alias.test.ts`, `test/workflow-cli.test.ts`, `test/setup.test.ts`, `README.md`
- npm package.json docs: https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#bin
- npm exec docs: https://docs.npmjs.com/cli/v8/commands/npm-exec/
- Node.js process docs: https://nodejs.org/api/process.html#processargv
- Local runtime probes: `node dist/cli.js help`, `node dist/cli.js version`, `node dist/cli.js`, `wrapper help`, symlink-based `process.argv` probe
- npm registry verification: `npm view typescript version time --json`, `npm view @types/node version time --json`

### Secondary (MEDIUM confidence)
- None

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - verified from local `package.json`, local tool versions, and npm registry queries
- Architecture: MEDIUM - current code paths are clear, but stale-invocation detection has cross-platform uncertainty
- Pitfalls: HIGH - directly supported by current code, tests, and live machine/runtime state

**Research date:** 2026-03-31
**Valid until:** 2026-04-30
