/**
 * Fixture 07: Provider Not Found
 *
 * Contract: provider availability check
 *
 * Verifies that when the provider binary is not in PATH:
 * - aco exits with code 1
 * - The install hint is in stderr
 *
 * Known Node.js gap: No.
 */
import { registerFixture } from '../harness';
import assert from 'node:assert/strict';

registerFixture({
  name: '07-provider-not-found',
  knownNodeGap: false,
  async fn(runner) {
    // mockBinDir is empty — no 'gemini' binary present
    // runner.run uses mockBinDir as the first PATH component
    // so 'gemini' will not be found

    const result = await runner.run(['run', 'gemini', 'review', '--input', 'test'], { mockPathOnly: true });

    assert.equal(result.exitCode, 1, 'must exit 1 when provider not found');

    // Install hint must be in stderr
    assert.ok(
      result.stderr.includes('npm install') || result.stderr.includes('gemini'),
      `Install hint not found in stderr. Got: "${result.stderr}"`,
    );

    assert.equal(result.stdout, '', 'provider-not-found must not emit stdout');
  },
});
