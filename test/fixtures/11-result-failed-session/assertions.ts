/**
 * Fixture 11: Result — Failed Session Shows error.log
 *
 * Contract: R-RESULT-04
 *
 * Verifies that aco result on a failed session:
 * - Prints output.log content (partial or empty)
 * - Prints error.log content with separator
 * - Exits with code 1
 *
 * Known Node.js gap: YES — current implementation does not surface error.log.
 */
import { registerFixture } from '../harness.js';
import { join } from 'node:path';
import assert from 'node:assert/strict';

registerFixture({
  name: '11-result-failed-session',
  knownNodeGap: true,
  async fn(runner) {
    const { writeFile } = await import('node:fs/promises');
    const mockGemini = join(runner.sessionBaseDir, '..', 'bin', 'gemini');
    await writeFile(mockGemini, [
      '#!/usr/bin/env bash',
      'echo "some stdout before failure"',
      'echo "this is an error message" >&2',
      'exit 1',
    ].join('\n') + '\n', { mode: 0o755 });

    await runner.run(['run', 'gemini', 'review', '--input', 'test']);

    const sessionId = await runner.readLatestSessionId();
    assert.ok(sessionId);

    const task = await runner.readTaskJson(sessionId);
    assert.equal(task.status, 'failed');

    const result = await runner.run(['result', '--session', sessionId]);

    // Must exit with code 1 (failed)
    assert.equal(result.exitCode, 1, `Expected exit code 1, got ${result.exitCode}`);

    // Must include partial stdout content
    assert.ok(
      result.stdout.includes('some stdout before failure'),
      'output.log content must be in result output',
    );

    // Must include error.log content with separator
    assert.ok(
      result.stdout.includes('error') || result.stdout.includes('---'),
      'error separator or error content must be present',
    );
    assert.ok(
      result.stdout.includes('this is an error message'),
      'error.log content must be included in result',
    );
  },
});
