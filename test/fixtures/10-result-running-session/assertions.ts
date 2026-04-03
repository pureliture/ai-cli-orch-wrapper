/**
 * Fixture 10: Result — Running Session Shows Banner
 *
 * Contract: R-RESULT-02
 *
 * Verifies that aco result on a still-running session:
 * - Prints partial output.log content
 * - Includes a "still running" banner
 * - Exits with code 3
 *
 * Known Node.js gap: YES — current implementation prints output without banner
 * and exits 0 even for running sessions.
 */
import { registerFixture } from '../harness.js';
import { join } from 'node:path';
import assert from 'node:assert/strict';

registerFixture({
  name: '10-result-running-session',
  knownNodeGap: true,
  async fn(runner) {
    const { writeFile } = await import('node:fs/promises');
    const mockGemini = join(runner.sessionBaseDir, '..', 'bin', 'gemini');
    await writeFile(mockGemini, [
      '#!/usr/bin/env bash',
      'echo "output from running session"',
      'sleep 30',
    ].join('\n') + '\n', { mode: 0o755 });

    const child = runner.spawn(['run', 'gemini', 'review', '--input', 'test']);

    // Wait for the first output to appear
    let sessionId: string | undefined;
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      sessionId = (await runner.readLatestSessionId()) ?? undefined;
      if (sessionId) {
        const log = await runner.readOutputLog(sessionId);
        if (log.includes('output from running')) break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.ok(sessionId, 'No session ID');

    const result = await runner.run(['result', '--session', sessionId]);

    // Must exit with code 3 (running)
    assert.equal(result.exitCode, 3, `Expected exit code 3, got ${result.exitCode}`);

    // Must include "still running" banner
    assert.ok(
      result.stdout.includes('running') || result.stdout.includes('⟳'),
      `Expected running banner in stdout. Got: "${result.stdout.slice(0, 200)}"`,
    );

    // Must include partial output
    assert.ok(
      result.stdout.includes('output from running'),
      'Partial output.log content must be present',
    );

    child.kill('SIGKILL');
    await new Promise<void>((r) => child.on('close', () => r()));
  },
});
