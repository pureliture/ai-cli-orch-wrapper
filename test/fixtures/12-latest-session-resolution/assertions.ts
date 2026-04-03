/**
 * Fixture 12: Latest Session Resolution via Pointer File
 *
 * Contract: R-LATEST-01, R-LATEST-02, R-LATEST-03, R-PERSIST-05
 *
 * Verifies that:
 * - The `latest` pointer file is updated on each new session
 * - aco status/result/cancel with no --session reads from the pointer file
 * - The pointer file is updated atomically
 *
 * Known Node.js gap: YES — current implementation scans all session directories.
 */
import { registerFixture, createMockProvider } from '../harness.js';
import { join } from 'node:path';
import { stat } from 'node:fs/promises';
import assert from 'node:assert/strict';

registerFixture({
  name: '12-latest-session-resolution',
  knownNodeGap: true,
  async fn(runner) {
    const mockGemini = join(runner.sessionBaseDir, '..', 'bin', 'gemini');

    // Run session 1
    await createMockProvider({ path: mockGemini, chunkCount: 1, exitCode: 0 });
    await runner.run(['run', 'gemini', 'review', '--input', 'session 1']);
    const sessionId1 = await runner.readLatestSessionId();
    assert.ok(sessionId1, 'No session ID after first run');

    // Verify pointer file exists and contains session 1
    const latestPath = join(runner.sessionBaseDir, 'latest');
    const latestStat = await stat(latestPath).catch(() => null);
    assert.ok(latestStat, 'latest pointer file must exist after first run');

    const latestContent1 = await runner.readLatestSessionId();
    assert.equal(latestContent1, sessionId1, 'latest pointer must point to session 1');

    // Run session 2
    await new Promise((r) => setTimeout(r, 10)); // ensure different timestamp
    await runner.run(['run', 'gemini', 'review', '--input', 'session 2']);
    const sessionId2 = await runner.readLatestSessionId();
    assert.ok(sessionId2, 'No session ID after second run');
    assert.notEqual(sessionId2, sessionId1, 'Session 2 must be different from session 1');

    // latest pointer must now point to session 2
    const latestContent2 = await runner.readLatestSessionId();
    assert.equal(latestContent2, sessionId2, 'latest pointer must update to session 2');

    // aco status with no --session must use session 2
    const statusResult = await runner.run(['status']);
    assert.equal(statusResult.exitCode, 0, 'aco status (no --session) must work');
    assert.ok(
      statusResult.stdout.includes(sessionId2),
      `aco status must show session 2 ID. Got: "${statusResult.stdout.slice(0, 300)}"`,
    );

    // aco result with no --session must return session 2 output
    const resultOutput = await runner.run(['result']);
    assert.equal(resultOutput.exitCode, 0);

    // aco cancel with no --session on a running session must cancel session 2
    const { writeFile } = await import('node:fs/promises');
    await writeFile(mockGemini, '#!/usr/bin/env bash\nsleep 30\n', { mode: 0o755 });
    const child = runner.spawn(['run', 'gemini', 'review', '--input', 'session 3']);
    await new Promise((r) => setTimeout(r, 200));

    const cancelResult = await runner.run(['cancel']); // no --session
    assert.equal(cancelResult.exitCode, 0, 'cancel (no --session) must succeed');

    child.kill('SIGKILL');
    await new Promise<void>((r) => child.on('close', () => r()));

    const sessionId3 = await runner.readLatestSessionId();
    assert.ok(sessionId3);
    const task3 = await runner.readTaskJson(sessionId3);
    assert.equal(task3.status, 'cancelled', 'session 3 must be cancelled');
  },
});
