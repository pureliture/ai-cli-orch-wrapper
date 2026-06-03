import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectRuntimeContexts } from '../src/runtime/context.js';
import type { AuthResult } from '../src/providers/interface.js';

function makeAuth(ok = true, method: AuthResult['method'] = 'cli-fallback'): AuthResult {
  return { ok, method };
}

async function withWorkspace(run: (workspace: string) => Promise<void>): Promise<void> {
  const workspace = await mkdtemp(join(tmpdir(), 'aco-multi-context-'));
  try {
    await run(workspace);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

describe('collectRuntimeContexts (multi-session)', () => {
  it('collects one RuntimeContext per provider input (4.1)', async () => {
    await withWorkspace(async (workspace) => {
      const contexts = await collectRuntimeContexts([
        {
          provider: 'antigravity',
          command: 'ask',
          sessionId: 'session-ag',
          permissionProfile: 'restricted',
          auth: makeAuth(),
          cwd: workspace,
        },
        {
          provider: 'codex',
          command: 'ask',
          sessionId: 'session-cx',
          permissionProfile: 'restricted',
          auth: makeAuth(),
          cwd: workspace,
        },
      ]);

      assert.equal(contexts.length, 2);
      assert.equal(contexts[0].active.provider, 'antigravity');
      assert.equal(contexts[0].active.sessionId, 'session-ag');
      assert.equal(contexts[1].active.provider, 'codex');
      assert.equal(contexts[1].active.sessionId, 'session-cx');
    });
  });

  it('preserves per-provider auth state across sessions (4.7)', async () => {
    await withWorkspace(async (workspace) => {
      const contexts = await collectRuntimeContexts([
        {
          provider: 'codex',
          command: 'ask',
          sessionId: 'session-cx',
          permissionProfile: 'restricted',
          auth: makeAuth(true),
          cwd: workspace,
        },
        {
          provider: 'antigravity',
          command: 'ask',
          sessionId: 'session-ag',
          permissionProfile: 'restricted',
          auth: makeAuth(false, 'missing'),
          cwd: workspace,
        },
      ]);

      assert.equal(contexts[0].active.auth.ok, true);
      assert.equal(contexts[1].active.auth.ok, false);
    });
  });
});
