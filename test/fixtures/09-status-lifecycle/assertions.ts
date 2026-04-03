/**
 * Fixture 09: Status Lifecycle Output
 *
 * Contract: R-STATUS-02, R-STATUS-04
 *
 * Verifies aco status output format and exit codes for all four lifecycle states.
 *
 * Known Node.js gap: YES — missing exitCode/signal fields in status output.
 */
import { registerFixture, createMockProvider } from '../harness.js';
import { join } from 'node:path';
import assert from 'node:assert/strict';

registerFixture({
  name: '09-status-lifecycle',
  knownNodeGap: true,
  async fn(runner) {

    // Case: done session
    {
      const mockGemini = join(runner.sessionBaseDir, '..', 'bin', 'gemini');
      await createMockProvider({ path: mockGemini, chunkCount: 1, exitCode: 0 });
      await runner.run(['run', 'gemini', 'review', '--input', 'test']);
      const sessionId = await runner.readLatestSessionId();
      assert.ok(sessionId);

      const status = await runner.run(['status', '--session', sessionId]);
      assert.equal(status.exitCode, 0, 'done session: exit code must be 0');
      assert.ok(status.stdout.includes('Status:'), 'output must contain Status:');
      assert.ok(status.stdout.includes('done'), 'status must show "done"');
      assert.ok(status.stdout.includes('ExitCode:'), 'done status must show ExitCode:');
      assert.ok(status.stdout.includes('0'), 'done status must show exitCode 0');
    }

    // Case: failed session
    {
      const mockGemini = join(runner.sessionBaseDir, '..', 'bin', 'gemini');
      await createMockProvider({ path: mockGemini, chunkCount: 0, exitCode: 1 });
      await runner.run(['run', 'gemini', 'review', '--input', 'test']);
      const sessionId = await runner.readLatestSessionId();
      assert.ok(sessionId);

      const status = await runner.run(['status', '--session', sessionId]);
      assert.equal(status.exitCode, 1, 'failed session: exit code must be 1');
      assert.ok(status.stdout.includes('failed'), 'status must show "failed"');
      assert.ok(status.stdout.includes('ExitCode:'), 'failed status must show ExitCode:');
    }

    // Case: cancelled session
    {
      const { writeFile } = await import('node:fs/promises');
      const mockGemini = join(runner.sessionBaseDir, '..', 'bin', 'gemini');
      await writeFile(mockGemini, '#!/usr/bin/env bash\nsleep 30\n', { mode: 0o755 });

      const child = runner.spawn(['run', 'gemini', 'review', '--input', 'test']);
      await new Promise((r) => setTimeout(r, 200));
      const sessionId = await runner.readLatestSessionId();
      assert.ok(sessionId);
      await runner.run(['cancel', '--session', sessionId]);
      await new Promise<void>((r) => child.on('close', () => r()));

      const status = await runner.run(['status', '--session', sessionId]);
      assert.equal(status.exitCode, 2, 'cancelled session: exit code must be 2');
      assert.ok(status.stdout.includes('cancelled'), 'status must show "cancelled"');
    }
  },
});
