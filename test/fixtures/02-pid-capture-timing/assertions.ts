/**
 * Fixture 02: PID Capture Timing
 *
 * Contract: R-RUN-03, CPW-01
 *
 * Verifies that the PID is present in task.json BEFORE the first output chunk
 * arrives. This is the key structural correctness requirement that distinguishes
 * the Go wrapper from the current Node.js implementation.
 *
 * Known Node.js gap: YES — current implementation writes PID fire-and-forget.
 * The Go wrapper MUST pass this fixture.
 */
import { registerFixture, createMockProvider } from '../harness.js';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

registerFixture({
  name: '02-pid-capture-timing',
  knownNodeGap: true,
  async fn(runner) {
    // Create a mock provider that writes one chunk after a brief delay
    // The delay gives us a window to read task.json before output arrives
    const mockGemini = join(runner.sessionBaseDir, '..', 'bin', 'gemini');
    await createMockProvider({
      path: mockGemini,
      chunkCount: 1,
      chunkDelayMs: 200, // 200ms before first output
      exitCode: 0,
    });

    // Spawn aco run, capture the session ID from the latest pointer file,
    // then read task.json within the 200ms window before first output
    const child = runner.spawn(['run', 'gemini', 'review', '--input', 'test']);

    let pidAtFirstChunk: number | undefined;
    let sessionId: string | undefined;

    // Poll for the latest session ID to appear (up to 500ms)
    const sessionIdDeadline = Date.now() + 500;
    while (Date.now() < sessionIdDeadline) {
      sessionId = (await runner.readLatestSessionId()) ?? undefined;
      if (sessionId) break;
      await new Promise((r) => setTimeout(r, 10));
    }
    assert.ok(sessionId, 'No session ID found within 500ms of aco run start');

    // Poll for PID to appear in task.json within 100ms of session creation
    const pidDeadline = Date.now() + 100;
    let taskWithPid: { pid?: number } = {};
    while (Date.now() < pidDeadline) {
      try {
        const raw = await readFile(
          join(runner.sessionBaseDir, sessionId, 'task.json'),
          'utf8',
        );
        taskWithPid = JSON.parse(raw) as { pid?: number };
        if (taskWithPid.pid) break;
      } catch { /* file may not exist yet */ }
      await new Promise((r) => setTimeout(r, 5));
    }

    // Capture PID at the moment first stdout chunk arrives
    child.stdout?.once('data', () => {
      pidAtFirstChunk = taskWithPid.pid;
    });

    await new Promise<void>((resolve) => child.on('close', () => resolve()));

    // The PID must have been in task.json when the first chunk arrived
    assert.ok(
      pidAtFirstChunk !== undefined,
      'PID was not present in task.json when first output chunk arrived',
    );
    assert.ok(
      typeof pidAtFirstChunk === 'number' && pidAtFirstChunk > 0,
      `PID in task.json at first chunk was not a valid PID: ${String(pidAtFirstChunk)}`,
    );
  },
});
