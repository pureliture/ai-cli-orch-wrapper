/**
 * Fixture 04: Cancel Preserves Partial Output
 *
 * Contract: R-TEE-04, R-CANCEL-04, CPW-08
 *
 * Verifies that output.log contains the bytes written before cancellation.
 * Cancellation must NOT truncate or clear partial output.
 *
 * Known Node.js gap: No — partial output preservation works currently.
 */
import { registerFixture, createMockProvider } from '../harness.js';
import { join } from 'node:path';
import assert from 'node:assert/strict';

registerFixture({
  name: '04-cancel-partial-output',
  knownNodeGap: false,
  async fn(runner) {
    const { writeFile } = await import('node:fs/promises');
    const mockGemini = join(runner.sessionBaseDir, '..', 'bin', 'gemini');
    // Provider: write one chunk, then hang
    await writeFile(mockGemini, [
      '#!/usr/bin/env bash',
      'echo "partial output line 1"',
      'sleep 30',
    ].join('\n') + '\n', { mode: 0o755 });

    const child = runner.spawn(['run', 'gemini', 'review', '--input', 'test']);

    // Wait for session to be created and output to be written
    let sessionId: string | undefined;
    const deadline = Date.now() + 1000;
    while (Date.now() < deadline && !sessionId) {
      sessionId = (await runner.readLatestSessionId()) ?? undefined;
      if (!sessionId) await new Promise((r) => setTimeout(r, 10));
    }
    assert.ok(sessionId, 'No session ID');

    // Wait for the first chunk to appear in output.log
    const outputDeadline = Date.now() + 1000;
    let outputContent = '';
    while (Date.now() < outputDeadline && !outputContent.includes('partial')) {
      outputContent = await runner.readOutputLog(sessionId);
      if (!outputContent.includes('partial')) await new Promise((r) => setTimeout(r, 20));
    }
    assert.ok(outputContent.includes('partial'), 'Provider did not write first chunk before cancel');

    // Cancel the session
    await runner.run(['cancel', '--session', sessionId]);
    await new Promise<void>((r) => child.on('close', () => r()));

    // output.log must still contain the partial output
    const finalContent = await runner.readOutputLog(sessionId);
    assert.ok(
      finalContent.includes('partial output line 1'),
      `output.log lost content after cancel. Got: "${finalContent}"`,
    );

    const task = await runner.readTaskJson(sessionId);
    assert.equal(task.status, 'cancelled');
  },
});
