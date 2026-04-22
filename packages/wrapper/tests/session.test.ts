import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SessionStore } from '../src/session/store';

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

  it('latestId() returns the most recent session', async () => {
    const { store } = await makeStore();
    await store.create('gemini', 'review');
    await new Promise(r => setTimeout(r, 5));
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
