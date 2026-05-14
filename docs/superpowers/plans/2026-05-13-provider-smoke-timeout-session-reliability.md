# Provider Smoke Timeout Session Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement issue #105 by giving Node wrapper `aco run`, `aco ask`, and `aco cancel` a deterministic timeout/cancellation/session artifact contract without putting live Codex/Gemini calls in default CI.

**Architecture:** Keep `packages/wrapper/src/runtime/provider-session-runner.ts` as the shared execution coordinator for `aco run` and `aco ask`. Add small, testable runtime helpers for timeout resolution, typed provider execution errors, and provider process termination; then wire command handlers to preserve final session state and artifacts.

**Tech Stack:** TypeScript, Node.js test runner, `tsx`, npm workspaces, OpenSpec, Markdown docs. In this Codex environment, prefix shell commands with `rtk`; repo/CI commands are the same without the `rtk` prefix.

---

## Source Inputs

- GitHub issue: `#105 bug: add provider smoke timeout and session reliability`
- OpenSpec change: `openspec/changes/add-provider-smoke-timeout-session-reliability/`
- Existing artifact contract: `docs/reference/session-artifacts.md`
- Existing process contract contrast: `docs/contract/process-execution-contract.md`
- Current runtime runner: `packages/wrapper/src/runtime/provider-session-runner.ts`
- Current child process helper: `packages/wrapper/src/util/spawn-stream.ts`

## Skill And Agent Plan

| Phase                     | Required capability                                                            | Use in this task                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Spec gate                 | `openspec-propose`, architecture/system design review                          | Keep proposal, design, spec, and tasks aligned before implementation.                                                 |
| Plan gate                 | `superpowers:writing-plans`, `testing-strategy`, `deploy-checklist`            | This document defines file ownership, TDD tasks, validation gates, and release readiness.                             |
| Implementation            | `superpowers:test-driven-development`                                          | No production code before a failing test is observed.                                                                 |
| Parallel execution option | `superpowers:subagent-driven-development`                                      | If the user explicitly authorizes subagents, split tests/runtime/docs into separate workers with disjoint write sets. |
| Review gate               | `superpowers:requesting-code-review`, `typescript-reviewer`, `code-simplifier` | Review runtime correctness, security, and maintainability before final verification.                                  |
| Completion gate           | `superpowers:verification-before-completion`                                   | Fresh validation results must be written to `validation-ledger.md` before claiming done.                              |

## File Map

- Create `packages/wrapper/tests/provider-session-reliability.test.ts`: deterministic tests for timeout resolution, PID recording, timeout failure artifacts, cancellation, cancelled-state preservation, provider failure artifacts, and ask ledger status.
- Create `packages/wrapper/src/runtime/provider-execution-control.ts`: timeout parsing, default timeout constants, kill grace constants, and execution-control normalization.
- Create `packages/wrapper/src/runtime/provider-execution-error.ts`: typed errors for timeout and cancellation with stable `code` values.
- Modify `packages/wrapper/src/providers/interface.ts`: add execution-control fields to `InvokeOptions`.
- Modify `packages/wrapper/src/util/spawn-stream.ts`: spawn provider children in a process group where supported, record PID, terminate on timeout/cancel, and keep stderr-tail diagnostics.
- Modify `packages/wrapper/src/runtime/provider-session-runner.ts`: apply shared timeout, call provider invoke with execution control, preserve cancellation semantics, and return typed errors.
- Modify `packages/wrapper/src/cli.ts`: parse `--timeout` for `aco run`, pass execution control, preserve `cancelled`, and improve `aco cancel`.
- Modify `packages/wrapper/src/commands/ask.ts`: parse `--timeout`, pass execution control, preserve `cancelled`, and record ledger/session artifacts.
- Modify `packages/wrapper/package.json`: include the new test file in the wrapper `test` script if the script enumerates files explicitly.
- Modify `docs/reference/session-artifacts.md`: document timeout, cancellation, PID, and `error.log` behavior.
- Modify `docs/security.md`: document provider execution timeout/cancel boundaries and opt-in live smoke.
- Modify `docs/guides/runbook.md`: add deterministic validation commands and opt-in live Codex/Gemini smoke commands.
- Create `openspec/changes/add-provider-smoke-timeout-session-reliability/validation-ledger.md`: evidence split for repo tests, dry-run proof, live smoke, and skipped live-smoke rationale.

## Test Strategy

- Unit tests cover timeout value parsing and execution-control helpers without spawning providers.
- Runtime integration tests use fake provider binaries and temp `HOME` so no real Codex/Gemini credentials or network are needed.
- Cancellation tests start a long-running fake provider, wait until `task.json` includes a PID, run `aco cancel --session <id>`, and assert final artifacts.
- One or two integration tests may use a one-second timeout; keep slower behavior out of the full suite by using helper-level tests for grace/termination details.
- Existing `mock` provider tests stay advisory/runtime tests, not AI quality tests.
- Live Codex/Gemini smoke is documented as opt-in and recorded separately in `validation-ledger.md`.

## Deploy / Readiness Checklist

- [ ] OpenSpec validation passes for `add-provider-smoke-timeout-session-reliability`.
- [ ] Targeted provider reliability tests pass.
- [ ] `npm run typecheck --workspace=packages/wrapper` passes.
- [ ] `npm test --workspace=packages/wrapper` passes.
- [ ] `git diff --check` passes.
- [ ] Documentation states live provider smoke is opt-in and credential-dependent.
- [ ] `validation-ledger.md` separates repo-local tests, dry-run proof, and optional live runtime smoke.
- [ ] PR body links `Closes #105` and does not claim live smoke unless it was actually run.

## Task 1: Spec Gate And Validation Ledger

**Files:**

- Create: `openspec/changes/add-provider-smoke-timeout-session-reliability/validation-ledger.md`
- Modify: `openspec/changes/add-provider-smoke-timeout-session-reliability/tasks.md`

- [ ] **Step 1: Create the validation ledger before code**

Create `validation-ledger.md` with this structure:

```markdown
# Provider Smoke Timeout Session Reliability Validation Ledger

## Scope

- Issue: #105
- Change: add-provider-smoke-timeout-session-reliability
- Worktree: /Users/ddalkak/Projects/ai-cli-orch-wrapper/.aco-worktrees/fix-provider-smoke-timeout-session
- Branch: fix/provider-smoke-timeout-session

## Repo-Local Deterministic Evidence

| Command     | Result  | Notes                              |
| ----------- | ------- | ---------------------------------- |
| Not run yet | Pending | Tests must be added failing-first. |

## Dry-Run Evidence

| Command     | Result  | Notes                                                                  |
| ----------- | ------- | ---------------------------------------------------------------------- |
| Not run yet | Pending | Add dry-run proof if runtime commands are exercised without providers. |

## Optional Live Runtime Smoke

| Command | Result  | Notes                                                                 |
| ------- | ------- | --------------------------------------------------------------------- |
| Not run | Skipped | Live Codex/Gemini smoke requires explicit approval and provider auth. |

## Review Notes

- Architecture/system-design review: pending.
- Testing/TDD review: pending.
- Security/runtime review: pending.
- Code-simplifier pass: pending.
```

- [ ] **Step 2: Validate the current OpenSpec package**

Run:

```bash
rtk openspec validate add-provider-smoke-timeout-session-reliability --type change --strict
```

Expected:

```text
Change 'add-provider-smoke-timeout-session-reliability' is valid
```

- [ ] **Step 3: Record spec gate result**

Append the validation result to `validation-ledger.md`. If validation fails, fix OpenSpec artifacts before writing tests.

## Task 2: Failing Tests For Timeout Resolution

**Files:**

- Create: `packages/wrapper/tests/provider-session-reliability.test.ts`
- Create: `packages/wrapper/src/runtime/provider-execution-control.ts`
- Modify: `packages/wrapper/package.json`

- [ ] **Step 1: Add RED tests for timeout parsing**

Create the test file with this initial section:

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveProviderTimeoutSeconds } from '../src/runtime/provider-execution-control';

describe('provider execution timeout resolution', () => {
  it('uses the 300 second default when no flag or env timeout is provided', () => {
    assert.equal(resolveProviderTimeoutSeconds(undefined, {}), 300);
  });

  it('uses ACO_TIMEOUT_SECONDS when no CLI timeout is provided', () => {
    assert.equal(resolveProviderTimeoutSeconds(undefined, { ACO_TIMEOUT_SECONDS: '42' }), 42);
  });

  it('lets --timeout take precedence over ACO_TIMEOUT_SECONDS', () => {
    assert.equal(resolveProviderTimeoutSeconds('7', { ACO_TIMEOUT_SECONDS: '42' }), 7);
  });

  it('rejects non-positive and non-numeric timeout values', () => {
    assert.throws(() => resolveProviderTimeoutSeconds('0', {}), /--timeout/);
    assert.throws(() => resolveProviderTimeoutSeconds('-1', {}), /--timeout/);
    assert.throws(() => resolveProviderTimeoutSeconds('abc', {}), /--timeout/);
  });
});
```

- [ ] **Step 2: Wire the test into the wrapper test script**

If `packages/wrapper/package.json` still enumerates tests explicitly, add `tests/provider-session-reliability.test.ts` to the `test` script.

- [ ] **Step 3: Verify RED**

Run:

```bash
rtk npm test --workspace=packages/wrapper -- tests/provider-session-reliability.test.ts
```

Expected: fail because `provider-execution-control` does not exist.

- [ ] **Step 4: Implement the minimal timeout helper**

Create `packages/wrapper/src/runtime/provider-execution-control.ts`:

```typescript
export const DEFAULT_PROVIDER_TIMEOUT_SECONDS = 300;
export const DEFAULT_PROVIDER_KILL_GRACE_MS = 5_000;

export interface TimeoutEnv {
  ACO_TIMEOUT_SECONDS?: string;
}

export interface ProviderExecutionControl {
  timeoutMs: number;
  killGraceMs: number;
}

export function resolveProviderTimeoutSeconds(
  flagValue: string | undefined,
  env: TimeoutEnv = process.env
): number {
  const source = flagValue ?? env.ACO_TIMEOUT_SECONDS;
  if (source === undefined || source === '') return DEFAULT_PROVIDER_TIMEOUT_SECONDS;

  const parsed = Number(source);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    const label = flagValue !== undefined ? '--timeout' : 'ACO_TIMEOUT_SECONDS';
    throw new Error(`Invalid ${label}: expected a positive number of seconds`);
  }

  return parsed;
}

export function resolveProviderExecutionControl(
  flagValue: string | undefined,
  env: TimeoutEnv = process.env
): ProviderExecutionControl {
  return {
    timeoutMs: Math.ceil(resolveProviderTimeoutSeconds(flagValue, env) * 1000),
    killGraceMs: DEFAULT_PROVIDER_KILL_GRACE_MS,
  };
}
```

- [ ] **Step 5: Verify GREEN**

Run:

```bash
rtk npm test --workspace=packages/wrapper -- tests/provider-session-reliability.test.ts
```

Expected: timeout parsing tests pass.

## Task 3: Failing Runtime Tests For Timeout, PID, And Failure Artifacts

**Files:**

- Modify: `packages/wrapper/tests/provider-session-reliability.test.ts`
- Create: `packages/wrapper/src/runtime/provider-execution-error.ts`
- Modify: `packages/wrapper/src/providers/interface.ts`
- Modify: `packages/wrapper/src/util/spawn-stream.ts`
- Modify: `packages/wrapper/src/runtime/provider-session-runner.ts`

- [ ] **Step 1: Add fake binary helpers to the test**

Add these helpers below the imports:

```typescript
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, delimiter } from 'node:path';

interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
  home: string;
}

async function makeHome(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'aco-provider-reliability-home-'));
}

async function makeFakeProviderBin(name: string, body: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'aco-provider-reliability-bin-'));
  const file = join(dir, name);
  await writeFile(file, `#!/usr/bin/env node\n${body}\n`, { mode: 0o755 });
  return dir;
}

async function runCli(
  args: string[],
  options: { home?: string; cwd?: string; timeoutMs?: number; pathPrefix?: string } = {}
): Promise<CliResult> {
  const home = options.home ?? (await makeHome());
  const cliRoot = resolve(__dirname, '..');
  const cliPath = join(cliRoot, 'src', 'cli.ts');
  const tsxRegister = require.resolve('tsx/cjs');

  return new Promise((resolveResult) => {
    execFile(
      process.execPath,
      ['--require', tsxRegister, cliPath, ...args],
      {
        cwd: options.cwd ?? cliRoot,
        timeout: options.timeoutMs ?? 5_000,
        env: {
          ...process.env,
          HOME: home,
          USERPROFILE: home,
          NO_COLOR: '1',
          PATH: options.pathPrefix
            ? `${options.pathPrefix}${delimiter}${process.env.PATH ?? ''}`
            : process.env.PATH,
        },
      },
      (error, stdout, stderr) => {
        const code =
          error && typeof (error as { code?: unknown }).code === 'number'
            ? (error as { code: number }).code ?? 1
            : error
            ? 1
            : 0;
        resolveResult({ code, stdout, stderr, home });
      }
    );
  });
}

async function latestSessionId(home: string): Promise<string> {
  const entries = await readdir(join(home, '.aco', 'sessions'));
  assert.equal(entries.length, 1);
  return entries[0];
}
```

- [ ] **Step 2: Add RED test for timeout artifacts**

Add:

```typescript
describe('provider execution timeout artifacts', () => {
  it('marks a slow spawned provider failed and writes error.log', async () => {
    const binDir = await makeFakeProviderBin(
      'gemini',
      [
        "process.stdout.write('partial output before timeout\\n');",
        'setInterval(() => {}, 1000);',
      ].join('\n')
    );

    const result = await runCli(['run', 'gemini', 'review', '--input', 'demo', '--timeout', '1'], {
      pathPrefix: binDir,
      timeoutMs: 4_000,
    });

    assert.equal(result.code, 1);
    const sessionId = await latestSessionId(result.home);
    const sessionDir = join(result.home, '.aco', 'sessions', sessionId);
    const task = JSON.parse(await readFile(join(sessionDir, 'task.json'), 'utf8'));
    const output = await readFile(join(sessionDir, 'output.log'), 'utf8');
    const error = await readFile(join(sessionDir, 'error.log'), 'utf8');

    assert.equal(task.status, 'failed');
    assert.equal(task.provider, 'gemini');
    assert.equal(task.command, 'review');
    assert.equal(typeof task.pid, 'number');
    assert.match(output, /partial output before timeout/);
    assert.match(error, /timed out/i);
  });
});
```

- [ ] **Step 3: Verify RED**

Run:

```bash
rtk npm test --workspace=packages/wrapper -- tests/provider-session-reliability.test.ts
```

Expected: fail because timeout execution control is not wired into provider invocation.

- [ ] **Step 4: Add typed execution errors**

Create `packages/wrapper/src/runtime/provider-execution-error.ts`:

```typescript
export type ProviderExecutionErrorCode = 'timeout' | 'cancelled';

export class ProviderExecutionError extends Error {
  constructor(
    readonly code: ProviderExecutionErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ProviderExecutionError';
  }
}

export function isProviderExecutionError(
  error: unknown,
  code?: ProviderExecutionErrorCode
): error is ProviderExecutionError {
  return error instanceof ProviderExecutionError && (code === undefined || error.code === code);
}
```

- [ ] **Step 5: Extend provider invocation options**

In `packages/wrapper/src/providers/interface.ts`, add these optional fields to `InvokeOptions`:

```typescript
  /** Maximum provider execution time in milliseconds. */
  timeoutMs?: number;
  /** Grace period after SIGTERM before SIGKILL. */
  killGraceMs?: number;
```

- [ ] **Step 6: Implement process termination in `spawn-stream.ts`**

Update the child spawn and cleanup shape:

```typescript
const child = spawn(binary, args, {
  stdio: [config.stdin, 'pipe', 'pipe'],
  detached: process.platform !== 'win32',
});

let timedOut = false;
let timeout: NodeJS.Timeout | undefined;
let forceKill: NodeJS.Timeout | undefined;

const terminate = (signal: NodeJS.Signals): void => {
  if (child.pid === undefined) return;
  try {
    if (process.platform !== 'win32') {
      process.kill(-child.pid, signal);
      return;
    }
  } catch {
    // Fall back to direct PID kill below.
  }
  try {
    process.kill(child.pid, signal);
  } catch {
    // The process may already be gone.
  }
};

if (options?.timeoutMs !== undefined) {
  timeout = setTimeout(() => {
    timedOut = true;
    terminate('SIGTERM');
    forceKill = setTimeout(() => terminate('SIGKILL'), options.killGraceMs ?? 5_000);
  }, options.timeoutMs);
}
```

Then clear timers on close and reject timeout with:

```typescript
if (timedOut) {
  reject(
    new ProviderExecutionError(
      'timeout',
      `${config.processName} timed out after ${Math.ceil((options?.timeoutMs ?? 0) / 1000)}s`
    )
  );
  return;
}
```

- [ ] **Step 7: Pass timeout from `invokeProviderForSession()`**

When calling `options.provider.invoke(...)`, include:

```typescript
timeoutMs: options.timeoutMs,
killGraceMs: options.killGraceMs,
```

Also add these fields to `ProviderSessionRunOptions`.

- [ ] **Step 8: Verify GREEN for timeout artifacts**

Run:

```bash
rtk npm test --workspace=packages/wrapper -- tests/provider-session-reliability.test.ts
```

Expected: timeout parsing and timeout artifact tests pass.

## Task 4: Failing Tests And Implementation For Cancellation

**Files:**

- Modify: `packages/wrapper/tests/provider-session-reliability.test.ts`
- Modify: `packages/wrapper/src/cli.ts`
- Modify: `packages/wrapper/src/commands/ask.ts`
- Modify: `packages/wrapper/src/session/store.ts`

- [ ] **Step 1: Add RED cancellation test**

Add a spawn-based test that starts `aco run`, waits for a session PID, cancels it, and asserts final artifacts:

```typescript
import { spawn } from 'node:child_process';

async function waitForSessionWithPid(home: string): Promise<{ id: string; pid: number }> {
  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline) {
    const root = join(home, '.aco', 'sessions');
    if (existsSync(root)) {
      const ids = await readdir(root);
      for (const id of ids) {
        const taskPath = join(root, id, 'task.json');
        const task = JSON.parse(await readFile(taskPath, 'utf8'));
        if (typeof task.pid === 'number') return { id, pid: task.pid };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Timed out waiting for session PID');
}

it('cancels a running spawned provider and preserves cancelled status', async () => {
  const home = await makeHome();
  const binDir = await makeFakeProviderBin(
    'gemini',
    [
      "process.stdout.write('provider started\\n');",
      "process.on('SIGTERM', () => setTimeout(() => process.exit(0), 50));",
      'setInterval(() => {}, 1000);',
    ].join('\n')
  );
  const cliRoot = resolve(__dirname, '..');
  const cliPath = join(cliRoot, 'src', 'cli.ts');
  const tsxRegister = require.resolve('tsx/cjs');
  const env = {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    NO_COLOR: '1',
    PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}`,
  };

  const running = spawn(
    process.execPath,
    [
      '--require',
      tsxRegister,
      cliPath,
      'run',
      'gemini',
      'review',
      '--input',
      'demo',
      '--timeout',
      '30',
    ],
    {
      cwd: cliRoot,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  const { id } = await waitForSessionWithPid(home);
  const cancel = await runCli(['cancel', '--session', id], { home, pathPrefix: binDir });
  assert.equal(cancel.code, 0);

  await new Promise((resolve) => running.once('exit', resolve));

  const task = JSON.parse(await readFile(join(home, '.aco', 'sessions', id, 'task.json'), 'utf8'));
  const error = await readFile(join(home, '.aco', 'sessions', id, 'error.log'), 'utf8');
  assert.equal(task.status, 'cancelled');
  assert.match(error, /cancelled/i);
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
rtk npm test --workspace=packages/wrapper -- tests/provider-session-reliability.test.ts
```

Expected: fail because `cmdRun()` can overwrite cancelled status and `cmdCancel()` does not write `error.log`.

- [ ] **Step 3: Update `cmdCancel()`**

In `packages/wrapper/src/cli.ts`, after reading a running record, write cancellation error and terminate process:

```typescript
if (record.pid) {
  terminateProviderProcess(record.pid, 'SIGTERM');
}

await appendFile(
  sessionStore.errorLogPath(sessionId),
  `Session ${sessionId} cancelled by operator request\n`,
  { mode: 0o600 }
);
await sessionStore.markCancelled(sessionId);
console.log(`Session ${sessionId} cancelled.`);
```

Use the same termination helper as `spawnStream()` exports or move it into a shared runtime module.

- [ ] **Step 4: Preserve cancelled state in `cmdRun()`**

After provider invocation returns or errors, read latest session status before marking final state:

```typescript
const latest = await sessionStore.read(session.id).catch(() => undefined);
if (latest?.status === 'cancelled') {
  await appendFile(
    sessionStore.errorLogPath(session.id),
    'Provider execution observed cancellation\n',
    {
      mode: 0o600,
    }
  );
  process.exit(EXIT_ERROR);
}
```

Place this check before `markDone()` and before changing failed state on provider errors.

- [ ] **Step 5: Preserve cancelled state in `cmdAsk()`**

Keep the existing cancelled checks and extend them so timeout/cancel errors are represented in the per-session ledger with `status: 'cancelled'` when `task.json` is already cancelled.

- [ ] **Step 6: Verify GREEN for cancellation**

Run:

```bash
rtk npm test --workspace=packages/wrapper -- tests/provider-session-reliability.test.ts
```

Expected: timeout and cancellation tests pass.

## Task 5: Docs And Opt-In Live Smoke

**Files:**

- Modify: `docs/reference/session-artifacts.md`
- Modify: `docs/security.md`
- Modify: `docs/guides/runbook.md`
- Modify: `openspec/changes/add-provider-smoke-timeout-session-reliability/validation-ledger.md`

- [ ] **Step 1: Update session artifact docs**

Add a short section to `docs/reference/session-artifacts.md`:

```markdown
## Timeout And Cancellation

`aco run` and `aco ask --yes` apply provider execution timeout in this order:

1. `--timeout <seconds>`
2. `ACO_TIMEOUT_SECONDS`
3. default `300` seconds

When timeout occurs, the session is marked `failed`, partial `output.log` remains inspectable, and `error.log` records the timeout. When `aco cancel --session <id>` cancels a running session, the session is marked `cancelled` and `error.log` records the operator cancellation. `pid` is recorded in `task.json` when the provider process exposes a child PID.
```

- [ ] **Step 2: Update security docs**

Add a note to `docs/security.md` that timeout/cancel are reliability controls, not a sandbox guarantee, and live Codex/Gemini smoke requires explicit approval and credentials.

- [ ] **Step 3: Update runbook**

Add deterministic validation commands:

```bash
rtk npm test --workspace=packages/wrapper -- tests/provider-session-reliability.test.ts
rtk npm run typecheck --workspace=packages/wrapper
rtk npm test --workspace=packages/wrapper
```

Add opt-in live smoke commands under a clearly labelled heading:

```bash
node packages/wrapper/dist/cli.js run gemini review --input "hello" --permission-profile restricted --timeout 120
node packages/wrapper/dist/cli.js run codex review --input "hello" --permission-profile restricted --timeout 120
```

- [ ] **Step 4: Record validation status**

Update `validation-ledger.md` with each command, result, and live-smoke status. If live smoke is skipped, write: `Skipped because live provider execution requires explicit approval and local provider auth.`

## Task 6: Final Verification And Review Gate

**Files:**

- Modify: `openspec/changes/add-provider-smoke-timeout-session-reliability/validation-ledger.md`

- [ ] **Step 1: Run OpenSpec validation**

Run:

```bash
rtk openspec validate add-provider-smoke-timeout-session-reliability --type change --strict
```

Expected:

```text
Change 'add-provider-smoke-timeout-session-reliability' is valid
```

- [ ] **Step 2: Run package checks**

Run:

```bash
rtk npm run typecheck --workspace=packages/wrapper
rtk npm test --workspace=packages/wrapper
rtk git diff --check
```

Expected: all pass.

- [ ] **Step 3: Run review and simplification gates**

Review changed TypeScript with TypeScript/runtime/security focus. Apply only findings that affect correctness, runtime behavior, maintainability, testability, or backward compatibility. Then do a simplification pass to remove accidental duplication without changing behavior.

- [ ] **Step 4: Final ledger update**

Record the final commands and outcomes in `validation-ledger.md`. Separate:

- repo-local deterministic tests
- dry-run proof
- optional live runtime smoke
- skipped live runtime smoke rationale

- [ ] **Step 5: Prepare PR handoff**

The PR body should include:

```markdown
Closes #105

## What

- Adds deterministic provider timeout/cancel/session reliability for Node wrapper provider execution.
- Records PID/error artifacts and preserves cancellation state.
- Documents opt-in live provider smoke separately from repo-local validation.

## Validation

- [ ] npm run typecheck --workspace=packages/wrapper
- [ ] npm test --workspace=packages/wrapper
- [ ] openspec validate add-provider-smoke-timeout-session-reliability --type change --strict
- [ ] git diff --check
```

Do not claim live Codex/Gemini smoke unless it was actually executed and recorded.

## Self-Review

- Spec coverage: Every requirement in `provider-session-reliability/spec.md` maps to Tasks 2-6.
- Placeholder scan: No task uses open-ended `TBD`, `TODO`, or "implement later" language.
- Type consistency: `timeoutMs`, `killGraceMs`, `ProviderExecutionError`, and `resolveProviderTimeoutSeconds()` are named consistently across tests and implementation tasks.
- Scope check: The plan stays inside Node wrapper provider execution, docs, and OpenSpec evidence; it does not change provider auth, aggregation, or Go runtime behavior.
