/**
 * Fixture 03: Cancel — SIGTERM then SIGKILL Escalation
 *
 * Contract: R-CANCEL-03, CPW-06, CPW-07
 *
 * Verifies two-phase kill:
 * 1. SIGTERM is sent on cancel
 * 2. If process does not exit within 3s, SIGKILL is sent
 *
 * Known Node.js gap: YES — current implementation sends only SIGTERM.
 */
import { registerFixture, createMockProvider } from '../harness.js';
import { join } from 'node:path';
import assert from 'node:assert/strict';

registerFixture({
  name: '03-cancel-sigterm-sigkill',
  knownNodeGap: true,
  async fn(runner) {
    // Case A: Provider that exits cleanly on SIGTERM
    // SIGTERM is sent; process exits within 3s; SIGKILL is not needed
    {
      const mockGemini = join(runner.sessionBaseDir, '..', 'bin', 'gemini-sigterm-responder');
      await createMockProvider({
        path: mockGemini,
        hangForever: false,
        chunkCount: 0,
        // Script traps SIGTERM and exits 0
      });
      // Override: create a script that responds to SIGTERM
      const { writeFile } = await import('node:fs/promises');
      await writeFile(mockGemini, [
        '#!/usr/bin/env bash',
        'trap "exit 0" SIGTERM',
        'sleep 10',
      ].join('\n') + '\n', { mode: 0o755 });

      const child = runner.spawn(['run', 'gemini', 'review', '--input', 'test']);

      let sessionId: string | undefined;
      const deadline = Date.now() + 500;
      while (Date.now() < deadline && !sessionId) {
        sessionId = (await runner.readLatestSessionId()) ?? undefined;
        if (!sessionId) await new Promise((r) => setTimeout(r, 10));
      }
      assert.ok(sessionId, 'No session ID');

      // Cancel after 100ms
      await new Promise((r) => setTimeout(r, 100));
      const cancelStart = Date.now();
      const cancelResult = await runner.run(['cancel', '--session', sessionId]);
      const cancelDuration = Date.now() - cancelStart;

      assert.equal(cancelResult.exitCode, 0, 'cancel should exit 0');
      // Should complete quickly (process responded to SIGTERM)
      assert.ok(cancelDuration < 3500, `Cancel took ${cancelDuration}ms — SIGKILL escalation did not trigger correctly`);

      await new Promise<void>((r) => child.on('close', () => r()));
      const task = await runner.readTaskJson(sessionId);
      assert.equal(task.status, 'cancelled', 'session must be cancelled');
    }

    // Case B: Provider that ignores SIGTERM (requires SIGKILL)
    {
      const mockGemini = join(runner.sessionBaseDir, '..', 'bin', 'gemini-sigterm-ignorer');
      const { writeFile } = await import('node:fs/promises');
      await writeFile(mockGemini, [
        '#!/usr/bin/env bash',
        'trap "" SIGTERM',  // ignore SIGTERM
        'sleep 30',
      ].join('\n') + '\n', { mode: 0o755 });

      const child = runner.spawn(['run', 'gemini', 'review', '--input', 'test']);

      let sessionId: string | undefined;
      const deadline = Date.now() + 500;
      while (Date.now() < deadline && !sessionId) {
        sessionId = (await runner.readLatestSessionId()) ?? undefined;
        if (!sessionId) await new Promise((r) => setTimeout(r, 10));
      }
      assert.ok(sessionId, 'No session ID for SIGKILL test');

      await new Promise((r) => setTimeout(r, 100));
      const cancelStart = Date.now();
      const cancelResult = await runner.run(['cancel', '--session', sessionId]);
      const cancelDuration = Date.now() - cancelStart;

      // Must complete within 3.5s (3s SIGKILL window + buffer)
      assert.ok(
        cancelDuration < 3500,
        `Cancel took ${cancelDuration}ms — SIGKILL was not sent after 3s`,
      );
      assert.equal(cancelResult.exitCode, 0);

      await new Promise<void>((r) => child.on('close', () => r()));
      const task = await runner.readTaskJson(sessionId);
      assert.equal(task.status, 'cancelled');
    }
  },
});
