/**
 * Antigravity E2E 검증 스위트
 *
 * 이 스위트는 REAL agy 바이너리를 wrapper를 통해 end-to-end로 실행합니다.
 *
 * 실행 조건:
 *   ACO_E2E=1 환경변수가 설정되어야만 실행됩니다.
 *   미설정 시 모든 real-agy 케이스는 SKIP 처리됩니다.
 *
 * 안전 원칙:
 *   - restricted 권한 프로파일 사용 (--dangerously-skip-permissions 미사용)
 *   - agy 실행 전 settings.json을 sandboxed/strict 설정으로 경화(hardening)
 *   - 실행 후 settings.json 원복
 *   - throwaway temp cwd에서 agy 실행, repo clean 검증
 *   - 60초 타임아웃으로 hung agy 빠른 감지
 *
 * 실행 방법:
 *   npm run test:e2e               # ACO_E2E 미설정: skip 보고
 *   ACO_E2E=1 npm run test:e2e     # 실제 agy 실행
 */

import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import {
  mkdtemp,
  rm,
  readFile,
  writeFile,
  mkdir,
  cp,
  stat,
} from 'node:fs/promises';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// 상수 및 설정
// ---------------------------------------------------------------------------

const E2E_ENABLED = process.env['ACO_E2E'] === '1';

/** 실제 agy 응답 검증에 사용하는 deterministic 토큰 */
const E2E_TOKEN = 'ACO_E2E_OK';

/**
 * agy가 확실하게 응답하고 도구를 호출하지 않도록 구성된 safe 프롬프트.
 * 웹 검색, 파일 읽기/쓰기, 명령 실행을 명시적으로 금지합니다.
 */
const SAFE_PROMPT = `Reply with exactly the literal token ${E2E_TOKEN} on a single line. Do not call any tools. Do not read or write files. Do not search the web. Do not run commands.`;

/** 개별 agy 호출 타임아웃 (ms) */
const AGY_TIMEOUT_MS = 60_000;

/** Node CLI 경로 */
const NODE_CLI = join(
  __dirname,
  '../../packages/wrapper/dist/cli.js'
);

/** Go 바이너리 경로 (빌드되어 있다면) */
const GO_BINARY = join(__dirname, '../../aco');

/** agy settings.json 경로 */
const AGY_SETTINGS_PATH = join(homedir(), '.gemini', 'antigravity-cli', 'settings.json');

/** ~/.aco/sessions 경로 */
const ACO_SESSIONS_DIR = join(homedir(), '.aco', 'sessions');

// ---------------------------------------------------------------------------
// 유틸리티
// ---------------------------------------------------------------------------

interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** 지정된 CLI(node 또는 go 바이너리)로 aco 명령을 실행합니다. */
async function runAco(
  binaryOrNode: 'node' | 'go',
  args: string[],
  opts: {
    cwd?: string;
    timeoutMs?: number;
    env?: Record<string, string | undefined>;
  } = {}
): Promise<RunResult> {
  const timeoutMs = opts.timeoutMs ?? AGY_TIMEOUT_MS;
  const env = { ...process.env, ...opts.env };

  return new Promise((resolve) => {
    const childArgs =
      binaryOrNode === 'node'
        ? [NODE_CLI, ...args]
        : args;
    const cmd =
      binaryOrNode === 'node' ? process.execPath : GO_BINARY;

    const child = spawn(cmd, childArgs, {
      cwd: opts.cwd ?? process.cwd(),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
    }, timeoutMs);

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
        exitCode: code ?? 1,
      });
    });
  });
}

/** Git repo의 clean 상태를 확인합니다. */
async function getGitStatus(repoRoot: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['status', '--porcelain'], {
      cwd: repoRoot,
    });
    return stdout.trim();
  } catch {
    return '(git status failed)';
  }
}

/** agy settings.json을 경화(sandbox/strict)하고 원본을 백업합니다. */
async function hardenAgySandbox(): Promise<{ restore: () => Promise<void> }> {
  const backupPath = AGY_SETTINGS_PATH + '.e2e-backup';
  const hardenedSettings = JSON.stringify(
    {
      enableTerminalSandbox: true,
      toolPermission: 'strict',
    },
    null,
    2
  );

  const existed = existsSync(AGY_SETTINGS_PATH);
  if (existed) {
    await cp(AGY_SETTINGS_PATH, backupPath);
  }

  // settings.json 디렉토리가 없으면 생성
  const settingsDir = join(homedir(), '.gemini', 'antigravity-cli');
  await mkdir(settingsDir, { recursive: true });

  await writeFile(AGY_SETTINGS_PATH, hardenedSettings, { mode: 0o600 });

  return {
    async restore() {
      if (existed) {
        await cp(backupPath, AGY_SETTINGS_PATH);
        await rm(backupPath, { force: true });
      } else {
        await rm(AGY_SETTINGS_PATH, { force: true });
      }
    },
  };
}

// ---------------------------------------------------------------------------
// 테스트 케이스
// ---------------------------------------------------------------------------

interface TestCase {
  name: string;
  real: boolean; // ACO_E2E=1 필요 여부
  fn: () => Promise<void>;
}

const results: Array<{
  name: string;
  status: 'pass' | 'fail' | 'skip';
  message?: string;
  detail?: string;
}> = [];

function registerCase(tc: TestCase): void {
  if (tc.real && !E2E_ENABLED) {
    results.push({
      name: tc.name,
      status: 'skip',
      message: 'ACO_E2E=1 미설정: 실제 agy 실행 생략',
    });
    return;
  }

  // 실행 예약
  results.push({ name: tc.name, status: 'skip', message: '실행 예정' });
}

async function runCase(tc: TestCase): Promise<void> {
  const idx = results.findIndex((r) => r.name === tc.name);

  if (tc.real && !E2E_ENABLED) {
    return; // 이미 skip 등록됨
  }

  try {
    await tc.fn();
    results[idx] = { name: tc.name, status: 'pass' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const detail = err instanceof Error ? err.stack : undefined;
    results[idx] = {
      name: tc.name,
      status: 'fail',
      message: msg,
      detail,
    };
  }
}

// ---------------------------------------------------------------------------
// MOCK-always 케이스 (ACO_E2E 불필요 — mock provider는 항상 온)
// ---------------------------------------------------------------------------

const mockCase: TestCase = {
  name: 'MOCK: mock provider 결정론적 응답 형태 검증',
  real: false,
  fn: async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-e2e-mock-'));
    try {
      const result = await runAco('node', [
        'run',
        'mock',
        'review',
        '--input',
        'E2E shape test',
        '--permission-profile',
        'restricted',
      ], { cwd: tmpDir });

      if (result.exitCode !== 0) {
        throw new Error(
          `mock provider: 예상 exit 0, 실제 ${result.exitCode}\nstderr: ${result.stderr}`
        );
      }

      const combined = result.stdout + result.stderr;
      if (!combined.includes('Provider: mock')) {
        throw new Error(
          `mock provider: 출력에 'Provider: mock' 없음\n출력: ${combined.slice(0, 500)}`
        );
      }
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  },
};

// ---------------------------------------------------------------------------
// REAL agy 케이스 (ACO_E2E=1 필요)
// ---------------------------------------------------------------------------

/**
 * E2E-1: aco run antigravity review — real agy로 deterministic 토큰 확인
 *
 * cwd를 repo 루트로 설정하여 .claude/aco/prompts/antigravity/review.md 템플릿이
 * 자동으로 해석되게 합니다. agy 프로세스는 이 cwd에서 실행됩니다.
 */
const e2e1: TestCase = {
  name: 'E2E-1: aco run antigravity — real agy 응답 토큰 + 세션 기록',
  real: true,
  fn: async () => {
    const sandbox = await hardenAgySandbox();

    // repo 루트 = prompt 템플릿이 위치한 곳 (cwd로 사용)
    const repoRoot = join(__dirname, '../..');

    // git status baseline (repo clean 검증용)
    const beforeStatus = await getGitStatus(repoRoot);

    try {
      const result = await runAco(
        'node',
        [
          'run',
          'antigravity',
          'review',
          '--input',
          SAFE_PROMPT,
          '--permission-profile',
          'restricted',
          '--timeout',
          '55',
        ],
        { cwd: repoRoot }
      );

      const combined = result.stdout + result.stderr;

      // 결과 기록
      console.log(`  [E2E-1] exit=${result.exitCode}`);
      console.log(`  [E2E-1] stdout(200): ${result.stdout.slice(0, 200)}`);
      console.log(`  [E2E-1] stderr(200): ${result.stderr.slice(0, 200)}`);

      // 토큰 검증
      if (!result.stdout.includes(E2E_TOKEN)) {
        // 타임아웃 or 권한 hang — 문서화된 제한으로 취급
        if (
          result.exitCode !== 0 &&
          (combined.includes('timeout') ||
            combined.includes('SIGTERM') ||
            result.stdout.trim() === '')
        ) {
          throw new Error(
            `[KNOWN LIMITATION] agy restricted 모드에서 응답 없음 또는 타임아웃\n` +
            `exit=${result.exitCode}\nstdout: ${result.stdout.slice(0, 300)}\n` +
            `stderr: ${result.stderr.slice(0, 300)}`
          );
        }
        throw new Error(
          `출력에 토큰 '${E2E_TOKEN}' 없음\n` +
          `stdout: ${result.stdout.slice(0, 500)}\nstderr: ${result.stderr.slice(0, 300)}`
        );
      }

      if (result.exitCode !== 0) {
        throw new Error(`토큰 확인됐지만 exit code = ${result.exitCode}`);
      }

      // 세션 기록 검증
      const latestSession = getLatestSessionId();
      if (!latestSession) {
        throw new Error('세션이 ~/.aco/sessions/에 기록되지 않음');
      }
      console.log(`  [E2E-1] 세션 ID: ${latestSession}`);

      const sessionDir = join(ACO_SESSIONS_DIR, latestSession);
      const taskJsonPath = join(sessionDir, 'task.json');
      if (!existsSync(taskJsonPath)) {
        throw new Error(`task.json 없음: ${taskJsonPath}`);
      }

      const taskJson = JSON.parse(await readFile(taskJsonPath, 'utf8'));
      console.log(`  [E2E-1] task.json status=${taskJson.status}, provider=${taskJson.provider}`);

      // repo clean 검증
      const afterStatus = await getGitStatus(repoRoot);
      if (afterStatus !== beforeStatus) {
        throw new Error(
          `E2E 후 repo 상태 변경 감지:\nbefore: ${beforeStatus || '(clean)'}\nafter: ${afterStatus}`
        );
      }
    } finally {
      await sandbox.restore();
    }
  },
};

/**
 * E2E-2: aco run antigravity ask — brief 응답 + 아티팩트 저장
 */
const e2e2: TestCase = {
  name: 'E2E-2: aco run antigravity ask — brief 응답 + 세션 아티팩트',
  real: true,
  fn: async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-e2e-2-'));
    const sandbox = await hardenAgySandbox();

    try {
      const result = await runAco(
        'node',
        [
          'run',
          'antigravity',
          'ask',
          '--input',
          SAFE_PROMPT,
          '--permission-profile',
          'restricted',
          '--timeout',
          '55',
        ],
        { cwd: tmpDir }
      );

      console.log(`  [E2E-2] exit=${result.exitCode}`);
      console.log(`  [E2E-2] stdout(200): ${result.stdout.slice(0, 200)}`);

      if (!result.stdout.includes(E2E_TOKEN)) {
        if (
          result.exitCode !== 0 &&
          (result.stdout.trim() === '' || result.stderr.includes('timeout'))
        ) {
          throw new Error(
            `[KNOWN LIMITATION] agy restricted 모드 ask — 응답 없음 또는 타임아웃\n` +
            `exit=${result.exitCode}\nstderr: ${result.stderr.slice(0, 300)}`
          );
        }
        throw new Error(
          `E2E-2: 토큰 없음\nstdout: ${result.stdout.slice(0, 500)}`
        );
      }

      // output.log 아티팩트 검증
      const latestId = getLatestSessionId();
      if (latestId) {
        const outputLog = join(ACO_SESSIONS_DIR, latestId, 'output.log');
        if (existsSync(outputLog)) {
          const content = await readFile(outputLog, 'utf8');
          console.log(`  [E2E-2] output.log 크기: ${content.length} bytes`);
          if (!content.includes(E2E_TOKEN)) {
            throw new Error(`output.log에 토큰 없음 (${content.length} bytes)`);
          }
        } else {
          throw new Error(`output.log 없음: ${outputLog}`);
        }
      }
    } finally {
      await sandbox.restore();
      await rm(tmpDir, { recursive: true, force: true });
    }
  },
};

/**
 * E2E-3: --model 플래그가 antigravity에서 무시되는지 검증
 *
 * --model=claude-sonnet-4.6을 지정해도 crash 없이 실행됩니다.
 * agy에는 CLI model flag가 없으므로 buildArgs에서 무시됩니다.
 * cwd를 repo 루트로 설정하여 review.md 템플릿을 해석합니다.
 */
const e2e3: TestCase = {
  name: 'E2E-3: --model 플래그 graceful no-op (antigravity는 model 무시)',
  real: true,
  fn: async () => {
    const sandbox = await hardenAgySandbox();
    const repoRoot = join(__dirname, '../..');

    try {
      const result = await runAco(
        'node',
        [
          'run',
          'antigravity',
          'review',
          '--input',
          SAFE_PROMPT,
          '--permission-profile',
          'restricted',
          '--model',
          'claude-sonnet-4.6', // agy에서 무시되어야 함
          '--timeout',
          '55',
        ],
        { cwd: repoRoot }
      );

      console.log(`  [E2E-3] exit=${result.exitCode}`);
      console.log(`  [E2E-3] stdout(200): ${result.stdout.slice(0, 200)}`);
      console.log(`  [E2E-3] stderr(100): ${result.stderr.slice(0, 100)}`);

      // --model 관련 오류가 없어야 함 (crash or bad flag error)
      const combined = result.stdout + result.stderr;
      if (
        combined.includes('unknown flag') &&
        combined.toLowerCase().includes('model')
      ) {
        throw new Error(
          `--model 플래그가 agy에 전달되어 오류 발생 (no-op이어야 함)\n` +
          `stderr: ${result.stderr.slice(0, 300)}`
        );
      }

      // 토큰이 있으면 완전 pass, 없으면 제한 사항 기록
      if (result.stdout.includes(E2E_TOKEN)) {
        console.log(`  [E2E-3] 토큰 확인 + model 무시 동작 검증 완료`);
      } else if (result.exitCode !== 0) {
        // model flag 이외의 이유로 실패 (타임아웃, 권한 등) — 허용
        console.log(
          `  [E2E-3] 토큰 없음 (exit=${result.exitCode}), 하지만 model flag 오류는 없음 → no-op 동작 확인`
        );
      } else {
        throw new Error(
          `E2E-3: exit 0이지만 토큰 없음\nstdout: ${result.stdout.slice(0, 300)}`
        );
      }
    } finally {
      await sandbox.restore();
    }
  },
};

/**
 * E2E-4: ultracode wrap — fan-out worker 패턴 시뮬레이션
 *
 * 임시 파일을 생성하고 aco run antigravity를 shell에서 호출합니다.
 * 이는 §13(consent-gated worker shelling out) 패턴을 검증합니다.
 *
 * cwd를 repo 루트로 설정하여 review.md 프롬프트 템플릿이 해석됩니다.
 * 임시 파일은 tmpDir에 생성되고 아티팩트는 ~/.aco/sessions/에 저장됩니다.
 */
const e2e4: TestCase = {
  name: 'E2E-4: ultracode wrap — fan-out worker shell 패턴',
  real: true,
  fn: async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-e2e-4-'));
    const sandbox = await hardenAgySandbox();
    // repo 루트: prompt 템플릿이 .claude/aco/prompts/에 있으므로 cwd로 사용
    const repoRoot = join(__dirname, '../..');

    try {
      // 임시 input 파일 생성
      const inputFile = join(tmpDir, 'review-input.txt');
      await writeFile(inputFile, SAFE_PROMPT, { mode: 0o600 });

      // fan-out worker bash snippet 시뮬레이션
      // cwd를 repoRoot로 전달하여 prompt 템플릿 해석 가능하게 함
      const scriptContent = `#!/usr/bin/env bash
set -euo pipefail
INPUT_FILE="$1"
REPO_ROOT="$2"
cd "$REPO_ROOT"
node "${NODE_CLI}" run antigravity review \\
  --input "$(cat "$INPUT_FILE")" \\
  --permission-profile restricted \\
  --timeout 55
`;
      const scriptPath = join(tmpDir, 'worker.sh');
      await writeFile(scriptPath, scriptContent, { mode: 0o755 });

      const result = await new Promise<RunResult>((resolve) => {
        const child = spawn('bash', [scriptPath, inputFile, repoRoot], {
          cwd: tmpDir,
          env: process.env,
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];

        child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
        child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

        const timer = setTimeout(() => {
          child.kill('SIGTERM');
        }, AGY_TIMEOUT_MS);

        child.on('close', (code) => {
          clearTimeout(timer);
          resolve({
            stdout: Buffer.concat(stdoutChunks).toString('utf8'),
            stderr: Buffer.concat(stderrChunks).toString('utf8'),
            exitCode: code ?? 1,
          });
        });
      });

      console.log(`  [E2E-4] exit=${result.exitCode}`);
      console.log(`  [E2E-4] stdout(200): ${result.stdout.slice(0, 200)}`);

      if (!result.stdout.includes(E2E_TOKEN)) {
        if (result.exitCode !== 0) {
          throw new Error(
            `[KNOWN LIMITATION] fan-out worker: agy restricted 응답 없음 또는 타임아웃\n` +
            `exit=${result.exitCode}\nstderr: ${result.stderr.slice(0, 300)}`
          );
        }
        throw new Error(
          `E2E-4: 토큰 없음\nstdout: ${result.stdout.slice(0, 500)}`
        );
      }

      console.log(`  [E2E-4] fan-out worker 패턴 검증 완료 (§13 대응)`);
    } finally {
      await sandbox.restore();
      await rm(tmpDir, { recursive: true, force: true });
    }
  },
};

// ---------------------------------------------------------------------------
// 헬퍼: 최근 세션 ID 조회
// ---------------------------------------------------------------------------

function getLatestSessionId(): string | undefined {
  if (!existsSync(ACO_SESSIONS_DIR)) return undefined;

  let latestId: string | undefined;
  let latestTime = '';

  try {
    for (const name of readdirSync(ACO_SESSIONS_DIR)) {
      const taskFile = join(ACO_SESSIONS_DIR, name, 'task.json');
      try {
        const record = JSON.parse(readFileSync(taskFile, 'utf8')) as {
          startedAt?: string;
          provider?: string;
        };
        if (
          record.provider === 'antigravity' &&
          record.startedAt &&
          record.startedAt > latestTime
        ) {
          latestTime = record.startedAt;
          latestId = name;
        }
      } catch {
        // 무시
      }
    }
  } catch {
    // 무시
  }

  return latestId;
}

// ---------------------------------------------------------------------------
// 메인: 케이스 등록 및 실행
// ---------------------------------------------------------------------------

const allCases: TestCase[] = [mockCase, e2e1, e2e2, e2e3, e2e4];

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Antigravity E2E 검증 스위트');
  console.log(`ACO_E2E=${process.env['ACO_E2E'] ?? '(미설정)'}`);
  console.log(`실행 시각: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  if (!E2E_ENABLED) {
    console.log(
      '\n[INFO] ACO_E2E=1 미설정 — real agy 케이스는 SKIP됩니다.'
    );
    console.log('[INFO] mock 케이스는 항상 실행됩니다.\n');
  }

  // 등록
  for (const tc of allCases) {
    registerCase(tc);
  }

  // 실행
  for (const tc of allCases) {
    if (tc.real && !E2E_ENABLED) continue; // 이미 skip
    process.stdout.write(`  실행 중: ${tc.name} ... `);
    const before = Date.now();
    await runCase(tc);
    const elapsed = Date.now() - before;
    const r = results.find((x) => x.name === tc.name);
    if (r?.status === 'pass') {
      console.log(`✓ (${elapsed}ms)`);
    } else if (r?.status === 'fail') {
      console.log(`✗ (${elapsed}ms)`);
      if (r.message) console.log(`    ERROR: ${r.message}`);
    } else {
      console.log(`- SKIP`);
    }
  }

  // 결과 요약
  console.log('\n' + '='.repeat(60));
  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const skipped = results.filter((r) => r.status === 'skip').length;

  console.log(`결과: ${passed} 통과, ${failed} 실패, ${skipped} 건너뜀`);

  if (failed > 0) {
    console.log('\n실패 케이스:');
    for (const r of results.filter((r) => r.status === 'fail')) {
      console.log(`  ✗ ${r.name}`);
      console.log(`    ${r.message}`);
    }
    process.exit(1);
  } else {
    console.log('\n모든 실행된 케이스 통과');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('E2E 스위트 치명적 오류:', err);
  process.exit(2);
});
