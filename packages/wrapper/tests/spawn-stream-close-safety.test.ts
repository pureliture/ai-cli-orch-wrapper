import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnStream } from '../src/util/spawn-stream.js';

async function makeScriptBinary(binDir: string, name: string, script: string): Promise<string> {
  const binaryPath = join(binDir, name);
  await writeFile(binaryPath, `#!/usr/bin/env node\n${script}`, { mode: 0o755 });
  return binaryPath;
}

describe('spawnStream close event race condition fix', () => {
  it('captures close event when process exits before for-await loop drains stdout', async () => {
    const tmpBin = await mkdtemp(join(tmpdir(), 'aco-spawn-close-race-'));
    // Process writes one line and exits immediately — may exit before consumer reads
    const binary = await makeScriptBinary(
      tmpBin,
      'fast-exit',
      `process.stdout.write('hello\\n'); process.exit(0);`
    );

    try {
      const chunks: string[] = [];
      for await (const chunk of spawnStream(
        binary,
        [],
        { processName: 'fast-exit', stdin: 'ignore' }
      )) {
        chunks.push(chunk);
      }
      assert.ok(chunks.join('').includes('hello'));
    } finally {
      await rm(tmpBin, { recursive: true, force: true });
    }
  });

  it('resolves normally when process exits with code 0', async () => {
    const tmpBin = await mkdtemp(join(tmpdir(), 'aco-spawn-close-exit0-'));
    const binary = await makeScriptBinary(
      tmpBin,
      'exit-0',
      `process.stdout.write('ok\\n'); process.exit(0);`
    );

    try {
      const chunks: string[] = [];
      for await (const chunk of spawnStream(
        binary,
        [],
        { processName: 'exit-0', stdin: 'ignore' }
      )) {
        chunks.push(chunk);
      }
      assert.ok(chunks.join('').includes('ok'));
    } finally {
      await rm(tmpBin, { recursive: true, force: true });
    }
  });

  it('rejects with error message when process exits with non-zero code', async () => {
    const tmpBin = await mkdtemp(join(tmpdir(), 'aco-spawn-close-exit1-'));
    const binary = await makeScriptBinary(
      tmpBin,
      'exit-1',
      `process.stderr.write('something went wrong\\n'); process.exit(1);`
    );

    try {
      await assert.rejects(
        (async () => {
          for await (const chunk of spawnStream(
            binary,
            [],
            { processName: 'exit-1', stdin: 'ignore' }
          )) {
            void chunk;
          }
        })(),
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.ok(
            err.message.includes('exited with code 1'),
            `Expected "exited with code 1" in: ${err.message}`
          );
          return true;
        }
      );
    } finally {
      await rm(tmpBin, { recursive: true, force: true });
    }
  });

  it('rejects with signal message when process is killed by SIGKILL', async () => {
    const tmpBin = await mkdtemp(join(tmpdir(), 'aco-spawn-close-signal-'));
    const binary = await makeScriptBinary(
      tmpBin,
      'signal-exit',
      `process.kill(process.pid, 'SIGKILL');`
    );

    try {
      await assert.rejects(
        (async () => {
          for await (const chunk of spawnStream(
            binary,
            [],
            { processName: 'signal-exit', stdin: 'ignore' }
          )) {
            void chunk;
          }
        })(),
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.ok(
            err.message.includes('terminated by signal'),
            `Expected "terminated by signal" in: ${err.message}`
          );
          return true;
        }
      );
    } finally {
      await rm(tmpBin, { recursive: true, force: true });
    }
  });
});
