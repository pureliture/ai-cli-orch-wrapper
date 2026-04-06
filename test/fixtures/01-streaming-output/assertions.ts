/**
 * Fixture 01: Streaming Output
 *
 * Contract: R-TEE-01, R-RUN-04
 * ccg-workflow parity: CPW-03
 *
 * Verifies that stdout chunks from the provider are forwarded incrementally
 * instead of being buffered until process exit.
 *
 * This fixture DOES test the Go binary.
 * Known Node.js gap: No — streaming works in current Node implementation.
 */
import { registerFixture, createMockProvider } from '../harness';
import assert from 'node:assert/strict';

registerFixture({
  name: '01-streaming-output',
  knownNodeGap: false,
  async fn(runner) {
    // Create a mock provider that writes 3 chunks with 100ms delay between each
    const mockGemini = runner.providerPath('gemini');
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

    assert.equal(result.exitCode, 0);
  },
});
