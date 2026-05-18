/**
 * provider-invocation-security.test.ts
 *
 * Requirement 1: content는 argv가 아닌 stdin(temp file)으로 전달된다.
 * Requirement 2: child process env는 명시적 allowlist만 받는다.
 * Requirement 3: envPolicy가 session ledger에 기록된다.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnStream } from '../src/util/spawn-stream.js';
import { buildProviderEnv } from '../src/util/provider-env.js';
import { writeTempInput } from '../src/util/spawn-stream.js';
import { SessionStore } from '../src/session/store.js';
import { MockProvider } from '../src/providers/mock.js';
import { invokeProviderForSession } from '../src/runtime/provider-session-runner.js';
import { Writable } from 'node:stream';

// ── 헬퍼: fake binary 작성 ────────────────────────────────────────────────────

async function makeBinary(dir: string, name: string, script: string): Promise<string> {
  const p = join(dir, name);
  await writeFile(p, `#!/usr/bin/env node\n${script}`, { mode: 0o755 });
  return p;
}

// ── 테스트 suite ─────────────────────────────────────────────────────────────

describe('provider-invocation-security', () => {
  let tmpBin: string;

  before(async () => {
    tmpBin = await mkdtemp(join(tmpdir(), 'aco-sec-test-'));
  });

  after(async () => {
    await rm(tmpBin, { recursive: true, force: true });
  });

  // ── 1. argv에 content가 포함되지 않는다 ────────────────────────────────────

  it('argv does not contain content when stdinFile is used', async () => {
    const LARGE_CONTENT = 'SECRET_CONTENT_' + 'x'.repeat(200);

    // fake binary: argv를 stdout에 출력
    const binary = await makeBinary(tmpBin, 'print-argv', `
process.stdout.write(process.argv.join(' '));
process.stdout.end();
`);

    // content → temp file 작성
    const stdinFile = await writeTempInput(LARGE_CONTENT);

    try {
      const chunks: string[] = [];
      for await (const chunk of spawnStream(
        binary,
        ['only-this-prompt'],
        { processName: 'print-argv', stdin: 'pipe', stdinFile },
      )) {
        chunks.push(chunk);
      }
      const output = chunks.join('');
      assert.ok(
        !output.includes('SECRET_CONTENT_'),
        `content must NOT appear in argv, but got: ${output.slice(0, 200)}`,
      );
    } finally {
      // stdinFile cleanup은 spawnStream 내부에서 수행되므로 여기서는 별도 삭제 불필요
    }
  });

  // ── 2. stdin으로 content가 수신된다 ────────────────────────────────────────

  it('stdin receives content via temp file', async () => {
    const CONTENT = 'STDIN_PAYLOAD_12345';

    const binary = await makeBinary(tmpBin, 'print-stdin', `
const chunks = [];
process.stdin.on('data', d => chunks.push(d));
process.stdin.on('end', () => {
  process.stdout.write(Buffer.concat(chunks).toString());
});
`);

    const stdinFile = await writeTempInput(CONTENT);

    const chunks: string[] = [];
    for await (const chunk of spawnStream(
      binary,
      [],
      { processName: 'print-stdin', stdin: 'pipe', stdinFile },
    )) {
      chunks.push(chunk);
    }

    assert.ok(
      chunks.join('').includes(CONTENT),
      `Expected stdin content in output, got: ${chunks.join('').slice(0, 200)}`,
    );
  });

  // ── 3. temp file이 invoke 완료 후 삭제된다 ────────────────────────────────

  it('temp file is cleaned up after invoke completes', async () => {
    const PREFIX = 'aco-input-';
    const CONTENT = 'cleanup-test-content';

    const binary = await makeBinary(tmpBin, 'noop', `
process.stdin.resume();
process.stdin.on('end', () => process.exit(0));
`);

    const stdinFile = await writeTempInput(CONTENT);

    // temp file이 실제로 존재하는지 확인
    await stat(stdinFile); // 존재하지 않으면 throw

    for await (const _ of spawnStream(
      binary,
      [],
      { processName: 'noop', stdin: 'pipe', stdinFile },
    )) {
      // drain
    }

    // invoke 완료 후 temp file이 삭제되어야 함
    await assert.rejects(
      stat(stdinFile),
      (err: unknown) => {
        assert.ok(err instanceof Error && 'code' in err);
        assert.strictEqual((err as NodeJS.ErrnoException).code, 'ENOENT');
        return true;
      },
      'temp file must be deleted after invoke completes',
    );
  });

  // ── 4. credential env는 child에게 전달되지 않는다 ────────────────────────

  it('credential env is NOT inherited by child process', async () => {
    const binary = await makeBinary(tmpBin, 'print-secret-env', `
process.stdout.write(process.env.TEST_SECRET_KEY ?? 'UNDEFINED');
`);

    // 부모 env에 심어놓은 secret
    const savedEnv = process.env.TEST_SECRET_KEY;
    process.env.TEST_SECRET_KEY = 'should-not-reach-child';

    try {
      const env = buildProviderEnv([]);

      const chunks: string[] = [];
      for await (const chunk of spawnStream(
        binary,
        [],
        { processName: 'print-secret-env', stdin: 'ignore', env },
      )) {
        chunks.push(chunk);
      }

      const output = chunks.join('');
      assert.ok(
        !output.includes('should-not-reach-child'),
        `Secret must NOT reach child. Got: ${output}`,
      );
    } finally {
      if (savedEnv === undefined) {
        delete process.env.TEST_SECRET_KEY;
      } else {
        process.env.TEST_SECRET_KEY = savedEnv;
      }
    }
  });

  // ── 5. provider auth env는 child에게 전달된다 ─────────────────────────────

  it('provider auth env IS passed to child process', async () => {
    const binary = await makeBinary(tmpBin, 'print-gemini-key', `
process.stdout.write(process.env.GEMINI_API_KEY ?? 'UNDEFINED');
`);

    const savedKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'test-gemini-key-xyz';

    try {
      const env = buildProviderEnv(['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_APPLICATION_CREDENTIALS']);

      const chunks: string[] = [];
      for await (const chunk of spawnStream(
        binary,
        [],
        { processName: 'print-gemini-key', stdin: 'ignore', env },
      )) {
        chunks.push(chunk);
      }

      const output = chunks.join('');
      assert.ok(
        output.includes('test-gemini-key-xyz'),
        `GEMINI_API_KEY must reach child. Got: ${output}`,
      );
    } finally {
      if (savedKey === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = savedKey;
      }
    }
  });

  // ── 6. stdinFile이 존재하지 않으면 openSync 오류가 전파된다 ───────────────

  it('propagates openSync error when stdinFile does not exist', async () => {
    const nonExistentFile = join(tmpBin, 'does-not-exist-stdinfile');

    // nonExistentFile이 실제로 없음을 확인
    await assert.rejects(
      stat(nonExistentFile),
      (err: unknown) => {
        assert.ok(err instanceof Error && 'code' in err);
        assert.strictEqual((err as NodeJS.ErrnoException).code, 'ENOENT');
        return true;
      },
    );

    // spawnStream은 openSync 실패 오류를 삼키지 않고 전파해야 한다.
    await assert.rejects(
      async () => {
        for await (const _ of spawnStream(
          process.execPath,
          ['-e', 'process.exit(0)'],
          { processName: 'test-proc', stdin: 'pipe', stdinFile: nonExistentFile },
        )) {
          // drain
        }
      },
      (err: unknown) => {
        // ENOENT 오류가 전파되어야 한다
        assert.ok(err instanceof Error);
        return true;
      },
      'openSync failure must propagate as an error, not be swallowed',
    );
  });

  // ── 7. envPolicy가 session ledger에 기록된다 ──────────────────────────────
  //
  // ask.ts에서 invokeProviderForSession에 envPolicy: 'allowlist'를 전달하며,
  // invokeProviderForSession이 ledger에 기록한다.

  it('records envPolicy as "allowlist" in session ledger', async () => {
    const sessionDir = await mkdtemp(join(tmpdir(), 'aco-envpolicy-test-'));
    const store = new SessionStore(sessionDir);
    const provider = new MockProvider();

    // session 생성 (ask.ts의 sessionStore.create에 해당)
    const session = await store.create(provider.key, 'ask');

    // sink: 출력을 버리는 Writable
    const sink = new Writable({ write(_chunk, _enc, cb) { cb(); } });

    // provider 실행 (ask.ts의 invokeProviderForSession에 해당)
    // ask.ts는 envPolicy: 'allowlist'를 전달하며, invokeProviderForSession이 ledger에 기록한다.
    await invokeProviderForSession({
      provider,
      command: 'ask',
      prompt: 'test prompt',
      content: 'test content',
      permissionProfile: 'restricted',
      sessionId: session.id,
      output: sink,
      envPolicy: 'allowlist',
      store,
    });

    // fix: invokeProviderForSession이 envPolicy를 sessionStore.update로 기록해야 한다.
    const record = await store.read(session.id);
    assert.strictEqual(
      record.envPolicy,
      'allowlist',
      `ask flow must record envPolicy "allowlist" in session ledger, got: ${String(record.envPolicy)}`,
    );

    await rm(sessionDir, { recursive: true, force: true });
  });
});
