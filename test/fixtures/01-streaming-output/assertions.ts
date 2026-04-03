/**
 * Fixture 01: Streaming Output
 *
 * Contract: R-TEE-01, R-RUN-04
 * ccg-workflow parity: CPW-03
 *
 * Verifies that stdout chunks from the provider are forwarded incrementally
 * (not buffered until process exits) and written to output.log simultaneously.
 *
 * This fixture DOES test the Go binary.
 * Known Node.js gap: No — streaming works in current Node implementation.
 */
import { registerFixture, createMockProvider } from '../harness.js';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

registerFixture({
  name: '01-streaming-output',
  knownNodeGap: false,
  async fn(runner) {
    // Create a mock provider that writes 3 chunks with 100ms delay between each
    const mockGemini = join(runner.sessionBaseDir, '..', 'bin', 'gemini');
    await createMockProvider({
      path: mockGemini,
      chunkCount: 3,
      chunkDelayMs: 100,
      exitCode: 0,
    });

    const result = await runner.run(['run', 'gemini', 'review', '--input', 'test input']);

    // At least 2 distinct chunks must have arrived while the process was running
    // (i.e., not all at once after process exit)
    assert.ok(result.chunks.length >= 2, `Expected >= 2 chunks, got ${result.chunks.length}`);

    // The time spread between first and last chunk must be > 50ms
    // (proving they were not buffered)
    const firstChunkTime = result.chunks[0]?.receivedAt ?? 0;
    const lastChunkTime = result.chunks[result.chunks.length - 1]?.receivedAt ?? 0;
    assert.ok(
      lastChunkTime - firstChunkTime > 50,
      `Chunks arrived within ${lastChunkTime - firstChunkTime}ms — likely buffered`,
    );

    // output.log must contain the same content as stdout
    const sessionId = await runner.readLatestSessionId();
    assert.ok(sessionId, 'No latest session ID found');
    const logContent = await runner.readOutputLog(sessionId);
    assert.ok(logContent.includes('chunk 1'), 'output.log missing chunk 1');
    assert.ok(logContent.includes('chunk 3'), 'output.log missing chunk 3');

    // Session must be marked done
    const task = await runner.readTaskJson(sessionId);
    assert.equal(task.status, 'done');
    assert.equal(task.exitCode, 0);

    assert.equal(result.exitCode, 0);
  },
});
