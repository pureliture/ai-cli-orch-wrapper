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
import { CodexProvider } from '../src/providers/codex.js';
import { invokeProviderForSession } from '../src/runtime/provider-session-runner.js';
import { Writable } from 'node:stream';
import { delimiter } from 'node:path';

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

  // ── 5b. base allowlist에 USERPROFILE이 포함되어 전달된다 ──────────────────
  //
  // HOME이 비어 있는 환경에서도 child CLI가 home 기반 경로(provider OAuth/session
  // 파일)를 해석할 수 있도록 USERPROFILE을 base allowlist에 포함한다. process.env에
  // 값이 있으면 child로 전달되어야 한다.

  it('passes USERPROFILE through the base env allowlist when present', async () => {
    const savedProfile = process.env.USERPROFILE;
    process.env.USERPROFILE = '/home/test-user-profile';

    try {
      const env = buildProviderEnv([]);
      assert.equal(
        env.USERPROFILE,
        '/home/test-user-profile',
        `USERPROFILE must be allowlisted in base env. Got: ${String(env.USERPROFILE)}`
      );
    } finally {
      if (savedProfile === undefined) {
        delete process.env.USERPROFILE;
      } else {
        process.env.USERPROFILE = savedProfile;
      }
    }
  });

  it('omits USERPROFILE from env when it is not set on the parent', async () => {
    const savedProfile = process.env.USERPROFILE;
    delete process.env.USERPROFILE;

    try {
      const env = buildProviderEnv([]);
      assert.ok(
        !('USERPROFILE' in env),
        `USERPROFILE must be absent when parent has none. Got keys: ${Object.keys(env).join(',')}`
      );
    } finally {
      if (savedProfile !== undefined) {
        process.env.USERPROFILE = savedProfile;
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

  // ── 6b. CodexProvider.invoke가 prompt+content를 stdin으로 합쳐 보낸다 ─────
  //
  // codex exec는 PROMPT positional이 비어 있거나 `-`일 때만 stdin에서 프롬프트를 읽으므로,
  // content가 있을 때 argv에 prompt만 두고 content를 stdin으로 보내면 codex가 content를
  // 무시한다. CodexProvider는 prompt+content를 하나로 합쳐 stdin으로 보내고 argv에는
  // `-`를 두어야 한다.

  it('CodexProvider.invoke routes prompt+content to stdin and uses `-` placeholder in argv', async () => {
    // fake codex binary: argv와 stdin을 명시적 토큰으로 구분하여 stdout에 출력한다.
    const binary = await makeBinary(
      tmpBin,
      'codex',
      `
const chunks = [];
process.stdin.on('data', (d) => chunks.push(d));
process.stdin.on('end', () => {
  const stdin = Buffer.concat(chunks).toString('utf8');
  const argv = process.argv.slice(2).join('|');
  process.stdout.write('ARGV=' + argv + '\\n@@SPLIT@@\\n' + 'STDIN=' + stdin);
});
`
    );

    const originalPath = process.env.PATH;
    process.env.PATH = `${tmpBin}${delimiter}${originalPath ?? ''}`;

    try {
      const provider = new CodexProvider();
      const chunks: string[] = [];
      for await (const chunk of provider.invoke('ask', 'SHORT_PROMPT', 'LARGE_CONTENT_PAYLOAD')) {
        chunks.push(chunk);
      }
      const output = chunks.join('');
      const [argvPart, stdinPart] = output.split('\n@@SPLIT@@\n');

      // argv에는 content가 들어가지 않아야 한다 (보안 목적).
      assert.ok(
        !argvPart.includes('LARGE_CONTENT_PAYLOAD'),
        `argv must NOT contain content. Got argv: ${argvPart}`
      );
      // argv는 `-`로 끝나야 한다 (codex가 stdin에서 prompt를 읽도록).
      assert.ok(
        argvPart.endsWith('|-'),
        `argv must end with '-' placeholder. Got argv: ${argvPart}`
      );
      // stdin에는 prompt + content가 모두 포함되어야 한다.
      assert.ok(
        stdinPart.includes('SHORT_PROMPT') && stdinPart.includes('LARGE_CONTENT_PAYLOAD'),
        `stdin must include both prompt and content. Got stdin: ${stdinPart.slice(0, 200)}`
      );
    } finally {
      process.env.PATH = originalPath;
    }
  });

  // ── 6c. spawn 동기 throw에서도 stdinFile이 cleanup된다 ────────────────────
  //
  // spawn은 일부 invalid option 등으로 동기 throw를 던질 수 있다. 그 경로에서도
  // 미리 작성된 임시 입력 파일이 누수되지 않아야 한다.

  it('cleans up stdinFile when spawn throws synchronously', async () => {
    const stdinFile = await writeTempInput('throw-cleanup-payload');
    await stat(stdinFile); // 존재 확인

    // 존재하지 않는 binary는 비동기 'error' 이벤트로 보고되어 cleanup이
    // 'close'/'error' 핸들러 경로에서 수행된다. 이 시나리오도 stdinFile이
    // 사라지는지 확인한다.
    await assert.rejects(async () => {
      for await (const _ of spawnStream(
        '/path/that/does/not/exist/aco-binary',
        [],
        { processName: 'nonexistent', stdin: 'pipe', stdinFile }
      )) {
        // drain
      }
    });

    await assert.rejects(stat(stdinFile), (err: unknown) => {
      assert.ok(err instanceof Error && 'code' in err);
      assert.strictEqual((err as NodeJS.ErrnoException).code, 'ENOENT');
      return true;
    });
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
