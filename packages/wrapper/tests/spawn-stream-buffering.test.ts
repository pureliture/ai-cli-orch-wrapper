import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnStream } from '../src/util/spawn-stream.js';

const OUTPUT_TEXT = 'abcdefghijklmnopqrstuvwxyz';

async function makeFakeBinary(
  binDir: string,
  name: string,
  outputBytes: number
): Promise<string> {
  const binaryPath = join(binDir, name);
  const script = `
const chunk = '${OUTPUT_TEXT}';
const totalBytes = ${outputBytes};
let written = 0;
while (written < totalBytes) {
  process.stdout.write(chunk);
  written += chunk.length;
}
`;
  await writeFile(
    binaryPath,
    `#!/usr/bin/env node\n${script}`,
    { mode: 0o755 }
  );
  return binaryPath;
}

describe('spawnStream output buffering modes', () => {
  it('exposes a bounded snapshot capped to maxBytes when bounded mode is requested', async () => {
    const tmpBin = await mkdtemp(join(tmpdir(), 'aco-spawn-stream-bounded-'));
    const binary = await makeFakeBinary(tmpBin, 'bounded-output', 64 * 1024);

    try {
      let outputLength = 0;
      const outputBuffer = { mode: 'bounded' as const, maxBytes: 128, snapshot: { value: '' } };

      for await (const chunk of spawnStream(
        binary,
        [],
        { processName: 'bounded-output', stdin: 'ignore' },
        { outputBuffer }
      )) {
        outputLength += chunk.length;
      }

      assert.equal(typeof outputBuffer.snapshot.value, 'string');
      assert.ok(outputLength > 0);
      assert.ok(outputBuffer.snapshot.value.length <= outputBuffer.maxBytes);
      assert.ok(outputLength > outputBuffer.snapshot.value.length);
    } finally {
      await rm(tmpBin, { recursive: true, force: true });
    }
  });

  it('keeps stream-only mode from accumulating bounded snapshots by default', async () => {
    const tmpBin = await mkdtemp(join(tmpdir(), 'aco-spawn-stream-stream-only-'));
    const binary = await makeFakeBinary(tmpBin, 'stream-output', 32 * 1024);

    try {
      const outputBuffer = {
        mode: 'stream-only' as const,
        maxBytes: 128,
        snapshot: { value: 'seed' },
      };
      const chunks: string[] = [];

      for await (const chunk of spawnStream(
        binary,
        [],
        { processName: 'stream-output', stdin: 'ignore' },
        { outputBuffer }
      )) {
        chunks.push(chunk);
      }

      const output = chunks.join('');
      assert.ok(output.length >= 32_000);
      assert.equal(outputBuffer.snapshot.value, 'seed');
    } finally {
      await rm(tmpBin, { recursive: true, force: true });
    }
  });

  it('rejects invalid bounded maxBytes', async () => {
    const tmpBin = await mkdtemp(join(tmpdir(), 'aco-spawn-stream-invalid-'));
    const binary = await makeFakeBinary(tmpBin, 'invalid-output', 1);
    const outputBuffer = { mode: 'bounded' as const, maxBytes: 0, snapshot: { value: '' } };

    try {
      await assert.rejects(
        (async () => {
          for await (const chunk of spawnStream(
            binary,
            [],
            { processName: 'invalid-output', stdin: 'ignore' },
            { outputBuffer }
          )) {
            void chunk;
          }
        })(),
        /must be an integer >= 1 in bounded mode/
      );
    } finally {
      await rm(tmpBin, { recursive: true, force: true });
    }
  });
});
