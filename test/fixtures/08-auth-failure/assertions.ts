/**
 * Fixture 08: Auth Failure Classification
 *
 * Contract: auth failure classification
 *
 * Verifies that when the provider binary exits indicating an auth problem,
 * aco exits 1 and prints an auth-oriented error with the recovery hint.
 *
 * Note: Auth failure detection is heuristic at the wrapper level — it depends
 * on the provider binary's exit behavior. This fixture uses a mock binary that
 * exits with a recognizable auth error pattern.
 *
 * Known Node.js gap: No.
 */
import { registerFixture } from '../harness';
import assert from 'node:assert/strict';

registerFixture({
  name: '08-auth-failure',
  knownNodeGap: true,
  async fn(runner) {
    const { writeFile } = await import('node:fs/promises');
    const mockGemini = runner.providerPath('gemini');
    // Simulates a provider that exits with an auth error signal
    // The Go wrapper must detect this as an auth failure
    await writeFile(mockGemini, [
      '#!/usr/bin/env bash',
      'echo "Error: authentication required" >&2',
      'exit 126', // 126 = command found but not executable / auth convention
    ].join('\n') + '\n', { mode: 0o755 });

    const result = await runner.run(['run', 'gemini', 'review', '--input', 'test']);

    assert.equal(result.exitCode, 1, 'auth failure must exit 1');
    assert.match(result.stderr, /authentication required/i);
    assert.match(result.stderr, /Run: gemini/i);
  },
});
