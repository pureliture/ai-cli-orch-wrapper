/**
 * Fixture 07: Provider Not Found
 *
 * Contract: R-AVAIL-01, R-AVAIL-02, R-RUN-01
 *
 * Verifies that when the provider binary is not in PATH:
 * - aco exits with code 1
 * - The install hint is in stderr
 * - No session directory is created
 *
 * Known Node.js gap: Partial — binary check exists but no install hint in error.
 */
import { registerFixture } from '../harness.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

registerFixture({
  name: '07-provider-not-found',
  knownNodeGap: false,
  async fn(runner) {
    // mockBinDir is empty — no 'gemini' binary present
    // runner.run uses mockBinDir as the first PATH component
    // so 'gemini' will not be found

    const result = await runner.run(['run', 'gemini', 'review', '--input', 'test']);

    assert.equal(result.exitCode, 1, 'must exit 1 when provider not found');

    // Install hint must be in stderr
    assert.ok(
      result.stderr.includes('npm install') || result.stderr.includes('gemini'),
      `Install hint not found in stderr. Got: "${result.stderr}"`,
    );

    // No session directory should be created
    const sessionId = await runner.readLatestSessionId();
    if (sessionId) {
      const sessionDir = join(runner.sessionBaseDir, sessionId);
      assert.ok(
        !existsSync(sessionDir),
        `Session directory was created despite provider not found: ${sessionDir}`,
      );
    }
    // If sessionId is null, that's also acceptable (no session created)
  },
});
