/**
 * Fixture 08: Auth Failure Classification
 *
 * Contract: R-AUTH-01, R-AUTH-02, R-EXIT-01
 *
 * Verifies that when the provider binary exits indicating an auth problem,
 * the session is marked failed with signal: "auth-failure" and the auth hint
 * is written to error.log.
 *
 * Note: Auth failure detection is heuristic at the wrapper level — it depends
 * on the provider binary's exit behavior. This fixture uses a mock binary that
 * exits with a recognizable auth error pattern.
 *
 * Known Node.js gap: Partial — no auth failure classification in current impl.
 */
import { registerFixture } from '../harness.js';
import { join } from 'node:path';
import assert from 'node:assert/strict';

registerFixture({
  name: '08-auth-failure',
  knownNodeGap: true,
  async fn(runner) {
    const { writeFile } = await import('node:fs/promises');
    const mockGemini = join(runner.sessionBaseDir, '..', 'bin', 'gemini');
    // Simulates a provider that exits with an auth error signal
    // The Go wrapper must detect this as an auth failure
    await writeFile(mockGemini, [
      '#!/usr/bin/env bash',
      'echo "Error: authentication required" >&2',
      'exit 126',  // 126 = command found but not executable / auth convention
    ].join('\n') + '\n', { mode: 0o755 });

    const result = await runner.run(['run', 'gemini', 'review', '--input', 'test']);

    assert.equal(result.exitCode, 1, 'auth failure must exit 1');

    const sessionId = await runner.readLatestSessionId();
    assert.ok(sessionId, 'Session must be created even on auth failure');

    const task = await runner.readTaskJson(sessionId);
    assert.equal(task.status, 'failed');

    // Auth failure is recorded as signal: "auth-failure"
    assert.equal(
      task.signal,
      'auth-failure',
      `Expected signal: "auth-failure", got: "${task.signal ?? 'undefined'}"`,
    );

    // Auth hint must be in error.log
    const errorLog = await runner.readErrorLog(sessionId);
    assert.ok(
      errorLog.length > 0,
      'error.log must be non-empty on auth failure',
    );
  },
});
