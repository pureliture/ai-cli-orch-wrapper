import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createWriteStream, existsSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { providerRegistry } from '../providers/registry.js';
import { isCredentialLikePath, findCredentialEnvKeys } from '../util/credential-guard.js';
import { sessionStore } from '../session/store.js';
import type { IProvider, OutputBufferPolicy, PermissionProfile } from '../providers/interface.js';
import { invokeProviderForSession } from '../runtime/provider-session-runner.js';
import { checkProviderProfileSupport } from '../runtime/provider-profile-guard.js';
import { emitRuntimeDashboard } from '../runtime/session-dashboard.js';
import { getCachedProviderAuth } from '../providers/auth-cache.js';
import {
  installProviderCancellationHandler,
  type ProviderCancellationState,
} from '../runtime/provider-cancellation.js';
import {
  parseProviderTimeoutFlag,
  resolveProviderExecutionControl,
  resolveProviderTimeoutSeconds,
  type ProviderExecutionControl,
} from '../runtime/provider-execution-control.js';
import { defaultSummarizeOutput } from '../util/summarize-output.js';
import { parseGeminiUsage, parseCodexUsage, type UsageResult } from '../util/usage-parse.js';

const execFileAsync = promisify(execFile);

const EXIT_ERROR = 1;
const DEFAULT_PROVIDERS = ['mock'];
const VALID_PERMISSION_PROFILES: PermissionProfile[] = ['default', 'restricted', 'unrestricted'];
const VALID_OUTPUT_MODES = ['brief', 'save-only', 'full'] as const;
const VALID_PRESET_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const SUMMARY_CHAR_LIMIT = 600;
const SUMMARY_SOURCE_CHAR_LIMIT = 16 * 1024;
const ADVISORY_NOTICE =
  'External provider output is advisory. Claude Code remains the supervisor and final synthesizer.';

type OutputMode = (typeof VALID_OUTPUT_MODES)[number];

export function resolveAskOutputBuffering(outputMode: OutputMode): OutputBufferPolicy {
  if (outputMode === 'brief') {
    return { mode: 'bounded' };
  }
  return { mode: 'stream-only' };
}

interface AskOptions {
  providers: string[];
  task?: string;
  input?: string;
  inputFile?: string;
  allowSensitive: boolean;
  preset?: string;
  permissionProfile: PermissionProfile;
  outputMode: OutputMode;
  yes: boolean;
  dryRun: boolean;
  timeoutSeconds: number;
  executionControl: ProviderExecutionControl;
  model?: string;
}

interface AskSessionLedger {
  id: string;
  provider: string;
  status: 'done' | 'failed' | 'cancelled';
  outputLog: string;
  briefPath: string;
  summary: string;
  error?: string;
  usageStatus: 'captured' | 'unavailable' | 'parse_error';
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  nativeSessionPath?: string;
  hasOutput: boolean;
  outputBytes: number;
  stderrBytes: number;
  warningCount: number;
  resultQuality: 'complete' | 'empty' | 'warning_heavy' | 'error';
  stderrArtifactPath?: string;
  canonicalInputPath: string;
  inputHash: string;
  summaryTruncated: boolean;
  topFindings?: string[] | null;
}

export async function cmdAsk(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    printAskUsage();
    return;
  }

  const rawModel = parseFlag(args, '--model');
  if (args.includes('--model') && (!rawModel || rawModel.startsWith('-'))) {
    fail('Error: --model requires a valid value');
  }

  let options: AskOptions;
  try {
    options = parseAskOptions(args);
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }
  validateAskOptions(options);

  let providers: IProvider[];
  try {
    providers = resolveProvidersForAsk(options.providers, options.permissionProfile);
  } catch (err) {
    // checkProviderProfileSupport는 미지원 profile에 대해 Error를 throw한다.
    fail(err instanceof Error ? err.message : String(err));
  }
  const input = await collectInput(options);
  const preset = options.preset ? await loadPreset(options.preset) : undefined;
  const prompt = buildPrompt(options, preset);

  // F-c: --model이 설정되어 있고 antigravity provider가 포함된 경우 경고 출력.
  // agy는 per-call model flag가 없으며, --model은 codex에만 적용된다.
  if (options.model) {
    for (const provider of providers) {
      if (provider.key === 'antigravity') {
        process.stderr.write(
          `[aco] warning: antigravity(agy) ignores --model; the agy persisted /model default is used. --model applies to codex only.\n`
        );
        break;
      }
    }
  }

  if (options.dryRun) {
    printDryRun(options, input, preset);
    return;
  }

  if (!options.yes) {
    console.error(
      [
        'Consent required: aco ask will not invoke external providers without explicit approval.',
        'Re-run with --dry-run to inspect the plan, or add --yes to invoke providers.',
      ].join('\n')
    );
    process.exit(EXIT_ERROR);
  }

  const credentialEnvKeys = findCredentialEnvKeys(process.env);
  if (credentialEnvKeys.length > 0) {
    process.stderr.write(
      `[aco] note: the following environment variables look like credentials and are present in your environment: ${credentialEnvKeys.join(', ')}.\n` +
        `[aco] Provider processes receive only an explicit env allowlist and will NOT inherit these variables.\n`
    );
  }

  const runId = randomUUID();
  const runDir = join(homedir(), '.aco', 'runs', runId);
  await mkdir(runDir, { recursive: true, mode: 0o700 });

  const startedAt = new Date().toISOString();

  const gitProvenance = await collectGitProvenance();

  const canonicalInputPath = join(runDir, 'input.md');
  await writeFile(canonicalInputPath, input, { mode: 0o600 });

  const inputHashValue = sha256Hex(input);

  // 사용자 취소(SIGINT/SIGTERM) 시 진행 중인 provider 자식 프로세스를 graceful하게
  // 정리하고 현재 세션을 cancelled로 기록한다. state는 루프에서 활성 PID/세션을 갱신한다.
  const cancellationState: ProviderCancellationState = {
    activePid: undefined,
    sessionId: undefined,
  };
  const cancellation = installProviderCancellationHandler({
    state: cancellationState,
    markCancelled: (sessionId) => sessionStore.markCancelled(sessionId),
    killGraceMs: options.executionControl.killGraceMs,
  });

  const sessions: AskSessionLedger[] = [];
  try {
    for (const provider of providers) {
      const session = await sessionStore.create(
        provider.key,
        'ask',
        undefined,
        options.permissionProfile
      );
      cancellationState.sessionId = session.id;
      cancellationState.activePid = undefined;
      // P1b: provider별 실행 구간을 try/finally로 감싸 invoke가 throw해도
      // activePid를 반드시 초기화한다(이후 신호가 죽은/엉뚱한 PID를 종료하지 않게).
      try {
        const sessionDir = sessionStore.sessionDir(session.id);
        await writeFile(join(sessionDir, 'prompt.md'), prompt, { mode: 0o600 });

        // 공통 커널로 'aco Runtime Session' 대시보드를 stderr에 렌더한다.
        // aco run과 동일한 커널을 사용하며, stdout brief는 손상시키지 않는다.
        // (U7에서 멀티프로바이더 롤업으로 확장된다. 현재는 provider별 단일 행.)
        const auth = await getCachedProviderAuth(provider, { skipCache: true });
        const runtimeContext = await emitRuntimeDashboard({
          provider: provider.key,
          command: 'ask',
          sessionId: session.id,
          permissionProfile: options.permissionProfile,
          auth,
        });
        await sessionStore.update(session.id, { runtimeContext });

        const outputLog = sessionStore.outputLogPath(session.id);
        const outputStream = createWriteStream(outputLog, { flags: 'a', mode: 0o600 });
        const outputBuffer = resolveAskOutputBuffering(options.outputMode);
        if (outputBuffer.mode === 'bounded') {
          outputBuffer.snapshot = { value: '' };
        }
        let error: string | undefined;
        let status: AskSessionLedger['status'] = 'done';
        const runResult = await invokeProviderForSession({
          provider,
          command: 'ask',
          prompt,
          content: input,
          permissionProfile: options.permissionProfile,
          sessionId: session.id,
          output: outputStream,
          outputBuffer,
          maxOutputBuffer: SUMMARY_SOURCE_CHAR_LIMIT,
          timeoutMs: options.executionControl.timeoutMs,
          killGraceMs: options.executionControl.killGraceMs,
          ...(options.model ? { model: options.model } : {}),
          envPolicy: 'allowlist',
          onPid: (pid) => {
            cancellationState.activePid = pid;
          },
          onChunk:
            options.outputMode === 'full'
              ? (chunk) => {
                  process.stdout.write(chunk);
                }
              : undefined,
        });

        if (!runResult.error) {
          const latest = await sessionStore.read(session.id);
          if (latest.status === 'cancelled') {
            status = 'cancelled';
            error = 'Session was cancelled before provider completion.';
            await writeFile(sessionStore.errorLogPath(session.id), `${error}\n`, { mode: 0o600 });
          } else {
            await sessionStore.markDone(session.id);
          }
        } else {
          const err = runResult.error;
          error = err instanceof Error ? err.message : String(err);
          await writeFile(sessionStore.errorLogPath(session.id), `${error}\n`, { mode: 0o600 });
          const latest = await sessionStore.read(session.id).catch(() => undefined);
          if (latest?.status === 'cancelled') {
            status = 'cancelled';
          } else {
            status = 'failed';
            await sessionStore.markFailed(session.id);
          }
        }

        const usage = await collectUsage(provider.key, session.id);

        const outputBytes = Buffer.byteLength(runResult.fullOutput, 'utf8');
        const stderrContent = runResult.stderrContent;
        const stderrBytes = Buffer.byteLength(stderrContent, 'utf8');
        const warningCount = countWarnings(runResult.stderrContent);
        const resultQuality = resolveResultQuality(status, runResult.hasOutput, warningCount);

        let stderrArtifactPath: string | undefined;
        if (stderrBytes > 0) {
          const stderrPath = join(sessionDir, 'stderr.log');
          await writeFile(stderrPath, stderrContent, { mode: 0o600 });
          stderrArtifactPath = stderrPath;
        }

        const summary = summarizeProviderOutput(runResult.fullOutput, provider);
        const brief = renderSessionBrief({
          runId,
          task: options.task ?? '',
          provider: provider.key,
          sessionId: session.id,
          outputLog,
          status,
          summary,
          error,
        });
        const briefPath = join(sessionDir, 'brief.md');
        await writeFile(briefPath, brief, { mode: 0o600 });

        sessions.push({
          id: session.id,
          provider: provider.key,
          status,
          outputLog,
          briefPath,
          summary,
          ...(error ? { error } : {}),
          usageStatus: usage.usageStatus,
          ...(usage.model !== undefined ? { model: usage.model } : {}),
          ...(usage.inputTokens !== undefined ? { inputTokens: usage.inputTokens } : {}),
          ...(usage.outputTokens !== undefined ? { outputTokens: usage.outputTokens } : {}),
          ...(usage.nativeSessionPath !== undefined
            ? { nativeSessionPath: usage.nativeSessionPath }
            : {}),
          hasOutput: runResult.hasOutput,
          outputBytes,
          stderrBytes,
          warningCount,
          resultQuality,
          ...(stderrArtifactPath !== undefined ? { stderrArtifactPath } : {}),
          canonicalInputPath,
          inputHash: inputHashValue,
          // true only when the summarizer applied char-limit truncation,
          // not when the provider simply reformats/filters output
          summaryTruncated: summary.includes('...[truncated to'),
          topFindings: extractTopFindings(runResult.fullOutput),
        });
      } finally {
        // P1b: 정상/예외 경로 모두에서 활성 PID를 초기화해 stale PID 오종료를 막는다.
        cancellationState.activePid = undefined;
      }
    }
  } finally {
    cancellationState.activePid = undefined;
    cancellationState.sessionId = undefined;
    cancellation.dispose();
  }

  const endedAt = new Date().toISOString();
  const durationMs = new Date(endedAt).getTime() - new Date(startedAt).getTime();

  const runBrief = renderRunBrief(runId, options, sessions);
  await writeFile(join(runDir, 'brief.md'), runBrief, { mode: 0o600 });
  await writeFile(
    join(runDir, 'ledger.json'),
    JSON.stringify(
      {
        runId,
        createdAt: new Date().toISOString(),
        task: options.task,
        preset: options.preset,
        providers: providers.map((provider) => provider.key),
        permissionProfile: options.permissionProfile,
        outputMode: options.outputMode,
        timeoutSeconds: options.timeoutSeconds,
        advisory: ADVISORY_NOTICE,
        sessions,
        startedAt,
        endedAt,
        durationMs,
        cwd: process.cwd(),
        gitBranch: gitProvenance.gitBranch,
        gitHead: gitProvenance.gitHead,
        gitDirty: gitProvenance.gitDirty,
        inputPath: resolveInputPath(options),
        inputBytes: Buffer.byteLength(input, 'utf8'),
        inputHash: sha256Hex(input),
        promptBytes: Buffer.byteLength(prompt, 'utf8'),
        promptHash: sha256Hex(prompt),
        permissionClass: resolvePermissionClass(options.permissionProfile),
        envPolicy: 'allowlist',
      },
      null,
      2
    ),
    { mode: 0o600 }
  );

  if (options.outputMode === 'brief') {
    process.stdout.write(runBrief);
  } else if (options.outputMode === 'save-only') {
    process.stdout.write(`Run ${runId} saved to ${runDir}\n`);
    for (const session of sessions) {
      process.stdout.write(`Session ${session.id} saved to ${session.outputLog}\n`);
    }
  }

  if (sessions.some((session) => session.status === 'failed' || session.status === 'cancelled')) {
    process.exit(EXIT_ERROR);
  }
}

function parseAskOptions(args: string[]): AskOptions {
  const timeoutFlag = parseProviderTimeoutFlag(args);
  return {
    providers: parseProviders(parseFlag(args, '--providers')),
    task: parseFlag(args, '--task'),
    input: parseFlag(args, '--input'),
    inputFile: parseFlag(args, '--input-file'),
    allowSensitive: args.includes('--allow-sensitive'),
    preset: parseFlag(args, '--preset'),
    permissionProfile: parseFlag<PermissionProfile>(args, '--permission-profile') ?? 'restricted',
    outputMode: parseFlag<OutputMode>(args, '--output-mode') ?? 'brief',
    yes: args.includes('--yes'),
    dryRun: args.includes('--dry-run'),
    timeoutSeconds: resolveProviderTimeoutSeconds(timeoutFlag),
    executionControl: resolveProviderExecutionControl(timeoutFlag),
    model: parseFlag(args, '--model'),
  };
}

function validateAskOptions(options: AskOptions): void {
  if (options.yes && options.dryRun) {
    fail('Invalid options: --yes and --dry-run are mutually exclusive');
  }

  if (!options.task && !options.preset) {
    fail('Error: aco ask requires --task or --preset');
  }

  if (options.providers.length === 0) {
    fail('Error: --providers must include at least one provider');
  }

  if (options.preset && !VALID_PRESET_NAME.test(options.preset)) {
    fail('Invalid --preset: use letters, numbers, hyphen, or underscore only');
  }

  if (!VALID_PERMISSION_PROFILES.includes(options.permissionProfile)) {
    fail(
      `Invalid --permission-profile '${options.permissionProfile}'. Valid values: default|restricted|unrestricted`
    );
  }

  if (!VALID_OUTPUT_MODES.includes(options.outputMode)) {
    fail(`Invalid --output-mode '${options.outputMode}'. Valid values: brief|save-only|full`);
  }
}

/**
 * provider key 목록을 IProvider 인스턴스로 해석하고, 각 provider가 요청된
 * permission profile을 지원하는지 검증한다. 미지원 profile이면 Error를 throw해
 * 실행을 차단한다 (checkProviderProfileSupport).
 *
 * registry 인자는 테스트에서 격리된 registry를 주입하기 위한 seam이며,
 * 기본값은 전역 providerRegistry다.
 */
export function resolveProvidersForAsk(
  keys: string[],
  permissionProfile: PermissionProfile,
  registry: { get(key: string): IProvider | undefined } = providerRegistry
): IProvider[] {
  return keys.map((key) => {
    const provider = registry.get(key);
    if (!provider) fail(`Unknown provider: ${key}`);
    checkProviderProfileSupport(provider, permissionProfile);
    return provider;
  });
}

function parseProviders(value: string | undefined): string[] {
  if (!value) return DEFAULT_PROVIDERS;
  return value
    .split(',')
    .map((provider) => provider.trim())
    .filter(Boolean);
}

async function collectInput(options: AskOptions): Promise<string> {
  const chunks: string[] = [];

  if (options.input) {
    chunks.push(options.input);
  }

  if (options.inputFile) {
    if (isCredentialLikePath(options.inputFile)) {
      if (options.allowSensitive) {
        process.stderr.write(
          `[aco] warning: --input-file '${options.inputFile}' looks like a credential or secret file. ` +
            `Proceeding because --allow-sensitive was specified.\n`
        );
      } else {
        fail(
          `Blocked: --input-file '${options.inputFile}' looks like a credential or secret file. ` +
            `Pass --allow-sensitive to override.`
        );
      }
    }
    const filePath = resolve(process.cwd(), options.inputFile);
    const fileInput = await readFile(filePath, 'utf8').catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      fail(`Failed to read --input-file '${options.inputFile}': ${message}`);
    });
    chunks.push(fileInput);
  }

  return chunks.join('\n\n');
}

async function loadPreset(name: string): Promise<string> {
  const relativePath = join('.claude', 'aco', 'tasks', `${name}.md`);
  const candidates = [resolve(process.cwd(), relativePath), join(homedir(), relativePath)];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return readFile(candidate, 'utf8');
    }
  }

  fail(`Preset not found: ${name}`);
}

function buildPrompt(options: AskOptions, preset: string | undefined): string {
  const editPolicy =
    options.permissionProfile === 'restricted'
      ? 'Never modify files. Return advisory analysis only.'
      : 'Do not modify files unless the user explicitly requested file edits.';

  return [
    'You are an external AI CLI acting as an advisory reviewer for Claude Code.',
    ADVISORY_NOTICE,
    editPolicy,
    `Permission profile: ${options.permissionProfile}`,
    '',
    options.preset ? `Preset: ${options.preset}` : undefined,
    preset ? `Preset instructions:\n${preset.trim()}` : undefined,
    options.task ? `Task:\n${options.task}` : undefined,
  ]
    .filter((line): line is string => line !== undefined)
    .join('\n');
}

function printDryRun(options: AskOptions, input: string, preset: string | undefined): void {
  console.log('Dry run: aco ask would invoke external providers only with --yes.');
  console.log(`Providers: ${options.providers.join(',')}`);
  console.log(`Permission profile: ${options.permissionProfile}`);
  console.log(`Output mode: ${options.outputMode}`);
  console.log(`Timeout seconds: ${options.timeoutSeconds}`);
  if (options.preset) console.log(`Preset: ${options.preset}`);
  console.log(`Task: ${options.task ?? '(preset only)'}`);
  console.log(`Input bytes: ${Buffer.byteLength(input, 'utf8')}`);
  if (preset) console.log(`Preset bytes: ${Buffer.byteLength(preset, 'utf8')}`);
  console.log('Provider execution: skipped');
}

function renderSessionBrief(input: {
  runId: string;
  task: string;
  provider: string;
  sessionId: string;
  outputLog: string;
  status: AskSessionLedger['status'];
  summary: string;
  error?: string;
}): string {
  return [
    '# aco ask session brief',
    '',
    `Run: ${input.runId}`,
    `Provider: ${input.provider}`,
    `Session: ${input.sessionId}`,
    `Status: ${input.status}`,
    `Full output saved: ${input.outputLog}`,
    `Summary:`,
    input.summary,
    '',
    `Advisory: ${ADVISORY_NOTICE}`,
    input.error ? `Error: ${input.error}` : undefined,
    '',
  ]
    .filter((line): line is string => line !== undefined)
    .join('\n');
}

function renderRunBrief(runId: string, options: AskOptions, sessions: AskSessionLedger[]): string {
  return [
    '# aco ask brief',
    '',
    `Run: ${runId}`,
    `Task: ${options.task ?? '(preset only)'}`,
    `Providers: ${options.providers.join(',')}`,
    `Permission profile: ${options.permissionProfile}`,
    `Output mode: ${options.outputMode}`,
    `Timeout seconds: ${options.timeoutSeconds}`,
    '',
    `Advisory: ${ADVISORY_NOTICE}`,
    '',
    ...sessions.flatMap((session) => [
      `Provider: ${session.provider}`,
      `Session: ${session.id}`,
      `Status: ${session.status}`,
      `Full output saved: ${session.outputLog}`,
      `Summary:`,
      session.summary,
      session.error ? `Error: ${session.error}` : undefined,
      '',
    ]),
  ]
    .filter((line): line is string => line !== undefined)
    .join('\n');
}

function summarizeProviderOutput(
  output: string,
  provider: import('../providers/interface.js').IProvider
): string {
  if (provider.summarizeOutput) {
    return provider.summarizeOutput(output, SUMMARY_CHAR_LIMIT);
  }
  // Fallback for providers that have not yet implemented summarizeOutput.
  // All built-in providers should implement this; the fallback is a safety net.
  return defaultSummarizeOutput(output, SUMMARY_CHAR_LIMIT);
}

function parseFlag<T extends string = string>(args: string[], flag: string): T | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1] as T;
}

function printAskUsage(): void {
  console.log(`Usage: aco ask --task <text> [options]

Options:
  --providers <list>              Comma-separated providers (default: mock)
  --task <text>                   Natural language task
  --input <text>                  Inline input
  --input-file <path>             Input file to include (credential-like paths blocked by default)
  --allow-sensitive               Allow credential-like --input-file paths (shows warning)
  --preset <name>                 .claude/aco/tasks/<name>.md
  --permission-profile <profile>  restricted|default|unrestricted (default: restricted)
  --output-mode <mode>            brief|save-only|full (default: brief)
                                    brief summary bound: ${SUMMARY_CHAR_LIMIT} chars
  --timeout <seconds>             Provider execution timeout (default: 300, env: ACO_TIMEOUT_SECONDS)
  --model <model>                 Model identifier passed to the provider binary via -m flag
  --dry-run                       Print execution plan without invoking providers
  --yes                           Explicitly consent to provider execution`);
}

function fail(message: string): never {
  console.error(message);
  process.exit(EXIT_ERROR);
}

/**
 * git 저장소 provenance 정보를 수집한다.
 * git 명령 실패 시 (git 미설치 또는 repo 외부) 모든 필드를 null로 반환한다.
 */
async function collectGitProvenance(): Promise<{
  gitBranch: string | null;
  gitHead: string | null;
  gitDirty: boolean | null;
}> {
  try {
    const [branchResult, headResult, statusResult] = await Promise.all([
      execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { timeout: 3000 }),
      execFileAsync('git', ['rev-parse', 'HEAD'], { timeout: 3000 }),
      execFileAsync('git', ['status', '--porcelain'], { timeout: 3000 }),
    ]);
    return {
      gitBranch: branchResult.stdout.trim() || null,
      gitHead: headResult.stdout.trim() || null,
      gitDirty: statusResult.stdout.trim().length > 0,
    };
  } catch {
    return { gitBranch: null, gitHead: null, gitDirty: null };
  }
}

/**
 * SHA-256 hex digest를 계산한다.
 */
function sha256Hex(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * input 소스 경로를 결정한다.
 * --input-file이 있으면 해당 경로, inline input이면 "inline", 없으면 "stdin".
 */
function resolveInputPath(options: AskOptions): string {
  if (options.inputFile) return options.inputFile;
  if (options.input) return 'inline';
  return 'stdin';
}

/**
 * permissionProfile을 기반으로 permissionClass를 결정한다.
 * restricted → runtime_enforced, default → best_effort, unrestricted → prompt_only.
 */
function resolvePermissionClass(
  profile: PermissionProfile
): 'runtime_enforced' | 'best_effort' | 'prompt_only' {
  if (profile === 'restricted') return 'runtime_enforced';
  if (profile === 'default') return 'best_effort';
  return 'prompt_only';
}

/**
 * provider별 usage telemetry를 파싱한다.
 */
async function collectUsage(providerKey: string, sessionId: string): Promise<UsageResult> {
  switch (providerKey) {
    case 'gemini':
      return parseGeminiUsage(sessionId);
    case 'codex':
      return parseCodexUsage(sessionId);
    default:
      // mock 및 기타 built-in provider는 네이티브 세션 로그 없음
      return { usageStatus: 'unavailable' };
  }
}

/**
 * provider output에서 warning 라인 수를 계산한다.
 */
function countWarnings(output: string): number {
  return output.split('\n').filter((line) => /warning:|warn:/i.test(line)).length;
}

/**
 * provider output에서 상위 목록 항목을 추출한다.
 * numbered list (1. ), bullet list (-, *, •) 패턴을 인식한다.
 * 최대 10개 항목을 반환하며, 항목이 없으면 null을 반환한다.
 */
export function extractTopFindings(output: string): string[] | null {
  const results: string[] = [];
  const lines = output.split('\n');
  const numberedPattern = /^\s*\d+\.\s+(.*)/;
  const bulletPattern = /^\s*[-*•]\s+(.*)/;

  for (const line of lines) {
    if (results.length >= 10) break;

    const numberedMatch = numberedPattern.exec(line);
    if (numberedMatch) {
      const content = numberedMatch[1].trim();
      if (content.length > 0) {
        results.push(content);
        continue;
      }
    }

    const bulletMatch = bulletPattern.exec(line);
    if (bulletMatch) {
      const content = bulletMatch[1].trim();
      if (content.length > 0) {
        results.push(content);
      }
    }
  }

  return results.length > 0 ? results : null;
}

/**
 * resultQuality를 결정한다.
 */
function resolveResultQuality(
  status: AskSessionLedger['status'],
  hasOutput: boolean,
  warningCount: number
): 'complete' | 'empty' | 'warning_heavy' | 'error' {
  if (status === 'failed' || status === 'cancelled') return 'error';
  if (!hasOutput) return 'empty';
  if (warningCount > 3) return 'warning_heavy';
  return 'complete';
}
