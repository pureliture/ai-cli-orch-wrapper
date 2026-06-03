import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  getPrimarySession,
  emitRuntimeDashboard,
  type RuntimeSessionLike,
} from '../src/runtime/session-dashboard.js';
import type { AuthResult } from '../src/providers/interface.js';

function makeAuth(method: AuthResult['method'] = 'api-key'): AuthResult {
  return { ok: true, method };
}

describe('getPrimarySession', () => {
  it('returns the only session when one is present', () => {
    const sessions: RuntimeSessionLike[] = [{ id: 'session-a', provider: 'mock' }];
    const primary = getPrimarySession(sessions);
    assert.equal(primary?.id, 'session-a');
    assert.equal(primary?.provider, 'mock');
  });

  it('returns the first session when several are present (U7 multi-session seam)', () => {
    const sessions: RuntimeSessionLike[] = [
      { id: 'session-a', provider: 'antigravity' },
      { id: 'session-b', provider: 'codex' },
    ];
    const primary = getPrimarySession(sessions);
    assert.equal(primary?.id, 'session-a');
  });

  it('returns undefined for an empty list', () => {
    assert.equal(getPrimarySession([]), undefined);
  });
});

describe('emitRuntimeDashboard', () => {
  async function withWorkspace(run: (workspace: string) => Promise<void>): Promise<void> {
    const workspace = await mkdtemp(join(tmpdir(), 'aco-session-dashboard-'));
    try {
      await run(workspace);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  }

  it('renders the runtime dashboard to the provided stderr sink', async () => {
    await withWorkspace(async (workspace) => {
      const chunks: string[] = [];
      const context = await emitRuntimeDashboard(
        {
          provider: 'mock',
          command: 'ask',
          sessionId: 'session-dash-1',
          permissionProfile: 'restricted',
          auth: makeAuth('cli-fallback'),
          cwd: workspace,
        },
        {
          write: (chunk: string) => {
            chunks.push(chunk);
          },
          color: false,
        }
      );

      const rendered = chunks.join('');
      assert.match(rendered, /aco Runtime Session/);
      assert.match(rendered, /session-dash-1/);
      assert.equal(context.active.provider, 'mock');
      assert.equal(context.active.sessionId, 'session-dash-1');
    });
  });
});
