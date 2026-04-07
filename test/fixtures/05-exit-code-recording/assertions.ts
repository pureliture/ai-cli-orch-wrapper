/**
 * Fixture 05: Exit Code Recording
 *
 * Contract: blocking exit propagation
 *
 * Verifies that aco exits 0 on provider success and non-zero on provider
 * failure.
 *
 * Known Node.js gap: No.
 */
import { registerFixture, createMockProvider } from '../harness';
import assert from 'node:assert/strict';

registerFixture({
  name: '05-exit-code-recording',
  knownNodeGap: true,
  async fn(runner) {
    // Case A: Successful run → exit 0
    {
      const mockGemini = runner.providerPath('gemini');
      await createMockProvider({ path: mockGemini, chunkCount: 1, exitCode: 0 });

      const result = await runner.run(['run', 'gemini', 'review', '--input', 'test']);
      assert.equal(result.exitCode, 0, 'successful provider run must exit 0');
    }

    // Case B: Failed run (exit code 2) → aco exits non-zero and reports failure
    {
      const mockGemini = runner.providerPath('gemini');
      await createMockProvider({ path: mockGemini, chunkCount: 0, exitCode: 2 });

      const result = await runner.run(['run', 'gemini', 'review', '--input', 'test']);
      assert.equal(result.exitCode, 1, 'aco must normalize provider failure to exit 1');
      assert.match(result.stderr, /exited with code 2/);
    }
  },
});
