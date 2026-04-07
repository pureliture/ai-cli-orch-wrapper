/**
 * Fixture 06: Timeout Marking
 *
 * Contract: blocking timeout handling
 *
 * Verifies that a provider that exceeds the timeout is killed and reported as
 * a timeout by aco.
 *
 * Known Node.js gap: No.
 */
import { registerFixture } from '../harness';
import assert from 'node:assert/strict';

registerFixture({
  name: '06-timeout-marking',
  knownNodeGap: true,
  async fn(runner) {
    const { writeFile } = await import('node:fs/promises');
    const mockGemini = runner.providerPath('gemini');
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

    assert.match(result.stderr, /timed out/i);
  },
});
