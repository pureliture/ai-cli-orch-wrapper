import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SessionStore } from '../src/session/store';
import type { RuntimeContext } from '../src/runtime/types.js';

async function makeStore() {
  const dir = await mkdtemp(join(tmpdir(), 'aco-test-'));
  const store = new SessionStore(dir);
  return { store, dir };
}

describe('SessionStore', () => {
  it('create() creates task.json with status running', async () => {
    const { store, dir } = await makeStore();
    const record = await store.create('gemini', 'review');
    assert.equal(record.status, 'running');
    assert.equal(record.provider, 'gemini');
    assert.equal(record.command, 'review');
    assert.ok(typeof record.id === 'string');
    assert.ok(record.startedAt);
    // file exists
    const raw = await readFile(join(dir, record.id, 'task.json'), 'utf8');
    const parsed = JSON.parse(raw);
    assert.equal(parsed.status, 'running');
  });

  it('read() returns the same record created', async () => {
    const { store } = await makeStore();
    const created = await store.create('gemini', 'adversarial');
    const read = await store.read(created.id);
    assert.deepEqual(created, read);
  });

  it('markDone() transitions status to done and sets endedAt', async () => {
    const { store } = await makeStore();
    const record = await store.create('gemini', 'rescue');
    await store.markDone(record.id);
    const updated = await store.read(record.id);
    assert.equal(updated.status, 'done');
    assert.ok(updated.endedAt);
  });

  it('markFailed() transitions status to failed', async () => {
    const { store } = await makeStore();
    const record = await store.create('gemini', 'review');
    await store.markFailed(record.id);
    const updated = await store.read(record.id);
    assert.equal(updated.status, 'failed');
  });

  it('markCancelled() transitions status to cancelled', async () => {
    const { store } = await makeStore();
    const record = await store.create('gemini', 'review');
    await store.markCancelled(record.id);
    const updated = await store.read(record.id);
    assert.equal(updated.status, 'cancelled');
  });

  it('update() merges partial patch', async () => {
    const { store } = await makeStore();
    const record = await store.create('gemini', 'review', 1234);
    await store.update(record.id, { pid: 5678 });
    const updated = await store.read(record.id);
    assert.equal(updated.pid, 5678);
    assert.equal(updated.status, 'running');
  });

  it('update() stores runtimeContext metadata', async () => {
    const { store } = await makeStore();
    const record = await store.create('gemini', 'review');

    const runtimeContext: RuntimeContext = {
      active: {
        provider: 'gemini',
        command: 'review',
        sessionId: record.id,
        permissionProfile: 'default',
        cwd: '/tmp/project',
        branch: 'main',
        auth: { ok: true, method: 'api-key' },
      },
      exposed: {
        sharedSkills: ['planner', 'review'],
        providerAgents: ['planner'],
        providerHooks: ['PostToolUse'],
        providerConfigFiles: ['settings.json'],
        provider: 'gemini',
      },
    };

    await store.update(record.id, { runtimeContext });
    const read = await store.read(record.id);

    assert.deepEqual(read.runtimeContext, runtimeContext);
  });

  it('read() is backward compatible when runtimeContext is missing', async () => {
    const { store, dir } = await makeStore();
    const id = 'legacy-session-id';

    const legacyRecord = {
      id,
      provider: 'codex',
      command: 'review',
      status: 'done',
      startedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    };

    const sessionDir = join(dir, id);
    await mkdir(sessionDir, { recursive: true });
    await writeFile(join(sessionDir, 'task.json'), JSON.stringify(legacyRecord, null, 2));

    const read = await store.read(id);
    assert.equal(read.runtimeContext, undefined);
    assert.equal(read.id, id);
  });

  it('latestId() returns the most recent session', async () => {
    const { store } = await makeStore();
    await store.create('gemini', 'review');
    await new Promise((r) => setTimeout(r, 5));
    const second = await store.create('gemini', 'rescue');
    const latest = store.latestId();
    assert.equal(latest, second.id);
  });

  it('outputLogPath() returns path within session dir', async () => {
    const { store, dir } = await makeStore();
    const record = await store.create('gemini', 'review');
    const logPath = store.outputLogPath(record.id);
    assert.ok(logPath.startsWith(dir));
    assert.ok(logPath.endsWith('output.log'));
  });
});
