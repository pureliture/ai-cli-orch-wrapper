/**
 * Fixture 05: Exit Code Recording
 *
 * Contract: R-EXIT-01, R-EXIT-02, R-RUN-06, R-RUN-07
 *
 * Verifies that task.json records exitCode for both success and failure cases.
 *
 * Known Node.js gap: YES — markFailed does not record exitCode or signal.
 */
import { registerFixture, createMockProvider } from '../harness.js';
import { join } from 'node:path';
import assert from 'node:assert/strict';

registerFixture({
  name: '05-exit-code-recording',
  knownNodeGap: true,
  async fn(runner) {
    // Case A: Successful run → exitCode: 0 in task.json
    {
      const mockGemini = join(runner.sessionBaseDir, '..', 'bin', 'gemini');
      await createMockProvider({ path: mockGemini, chunkCount: 1, exitCode: 0 });

      await runner.run(['run', 'gemini', 'review', '--input', 'test']);

      const sessionId = await runner.readLatestSessionId();
      assert.ok(sessionId);
      const task = await runner.readTaskJson(sessionId);
      assert.equal(task.status, 'done');
      assert.equal(task.exitCode, 0, 'done session must have exitCode: 0');
      assert.equal(task.signal, undefined, 'done session must not have signal');
    }

    // Case B: Failed run (exit code 2) → exitCode: 2 in task.json
    {
      const mockGemini = join(runner.sessionBaseDir, '..', 'bin', 'gemini');
      await createMockProvider({ path: mockGemini, chunkCount: 0, exitCode: 2 });

      await runner.run(['run', 'gemini', 'review', '--input', 'test']);

      const sessionId = await runner.readLatestSessionId();
      assert.ok(sessionId);
      const task = await runner.readTaskJson(sessionId);
      assert.equal(task.status, 'failed');
      assert.equal(task.exitCode, 2, 'failed session must have exitCode: 2');
      assert.equal(task.signal, undefined, 'exit-code failure must not have signal');
    }
  },
});
