/**
 * Fixture 06: Timeout Marking
 *
 * Contract: R-RUN-09, R-EXIT-03, CPW-02, CPW-07
 *
 * Verifies that a provider that exceeds the timeout is killed and the session
 * is marked failed with signal: "timeout" (not "SIGKILL").
 *
 * Known Node.js gap: YES — no timeout support in current implementation.
 */
import { registerFixture } from '../harness.js';
import { join } from 'node:path';
import assert from 'node:assert/strict';

registerFixture({
  name: '06-timeout-marking',
  knownNodeGap: true,
  async fn(runner) {
    const { writeFile } = await import('node:fs/promises');
    const mockGemini = join(runner.sessionBaseDir, '..', 'bin', 'gemini');
    // Provider hangs forever
    await writeFile(mockGemini, [
      '#!/usr/bin/env bash',
      'sleep 999',
    ].join('\n') + '\n', { mode: 0o755 });

    const start = Date.now();
    // Run with a 2-second timeout
    const result = await runner.run(
      ['run', 'gemini', 'review', '--input', 'test', '--timeout', '2'],
      { timeoutMs: 10_000 }, // harness timeout (must not be the one that fires)
    );
    const elapsed = Date.now() - start;

    // Must complete within 5s (2s timeout + 3s SIGKILL window + buffer)
    assert.ok(elapsed < 6000, `Timeout took ${elapsed}ms — too slow`);

    // Must exit with non-zero
    assert.notEqual(result.exitCode, 0, 'timed-out run must exit non-zero');

    const sessionId = await runner.readLatestSessionId();
    assert.ok(sessionId);
    const task = await runner.readTaskJson(sessionId);
    assert.equal(task.status, 'failed');
    assert.equal(task.signal, 'timeout', `Expected signal: "timeout", got: "${task.signal ?? 'undefined'}"`);
    assert.equal(task.exitCode, undefined, 'timeout must not also have exitCode');
    assert.ok(task.endedAt, 'endedAt must be set');
  },
});
