import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createWriteStream, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { providerRegistry } from '../providers/registry.js';
import { sessionStore } from '../session/store.js';
import type { PermissionProfile } from '../providers/interface.js';
import { invokeProviderForSession } from '../runtime/provider-session-runner.js';

const EXIT_ERROR = 1;
const DEFAULT_PROVIDERS = ['mock'];
const VALID_PERMISSION_PROFILES: PermissionProfile[] = ['default', 'restricted', 'unrestricted'];
const VALID_OUTPUT_MODES = ['brief', 'save-only', 'full'] as const;
const VALID_PRESET_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const SUMMARY_CHAR_LIMIT = 600;
const ADVISORY_NOTICE =
  'External provider output is advisory. Claude Code remains the supervisor and final synthesizer.';

type OutputMode = (typeof VALID_OUTPUT_MODES)[number];

interface AskOptions {
  providers: string[];
  task?: string;
  input?: string;
  inputFile?: string;
  preset?: string;
  permissionProfile: PermissionProfile;
  outputMode: OutputMode;
  yes: boolean;
  dryRun: boolean;
}

interface AskSessionLedger {
  id: string;
  provider: string;
  status: 'done' | 'failed' | 'cancelled';
  outputLog: string;
  briefPath: string;
  summary: string;
  error?: string;
}

export async function cmdAsk(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    printAskUsage();
    return;
  }

  const options = parseAskOptions(args);
  validateAskOptions(options);

  const providers = resolveProviders(options.providers);
  const input = await collectInput(options);
  const preset = options.preset ? await loadPreset(options.preset) : undefined;
  const prompt = buildPrompt(options, preset);

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

  const runId = randomUUID();
  const runDir = join(homedir(), '.aco', 'runs', runId);
  await mkdir(runDir, { recursive: true, mode: 0o700 });

  const sessions: AskSessionLedger[] = [];
  for (const provider of providers) {
    const session = await sessionStore.create(
      provider.key,
      'ask',
      undefined,
      options.permissionProfile
    );
    const sessionDir = sessionStore.sessionDir(session.id);
    await writeFile(join(sessionDir, 'input.md'), input, { mode: 0o600 });
    await writeFile(join(sessionDir, 'prompt.md'), prompt, { mode: 0o600 });

    const outputLog = sessionStore.outputLogPath(session.id);
    const outputStream = createWriteStream(outputLog, { flags: 'a', mode: 0o600 });
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

    const summary = summarizeProviderOutput(runResult.fullOutput, provider.key);
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
    });
  }

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
        advisory: ADVISORY_NOTICE,
        sessions,
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
  return {
    providers: parseProviders(parseFlag(args, '--providers')),
    task: parseFlag(args, '--task'),
    input: parseFlag(args, '--input'),
    inputFile: parseFlag(args, '--input-file'),
    preset: parseFlag(args, '--preset'),
    permissionProfile: parseFlag<PermissionProfile>(args, '--permission-profile') ?? 'restricted',
    outputMode: parseFlag<OutputMode>(args, '--output-mode') ?? 'brief',
    yes: args.includes('--yes'),
    dryRun: args.includes('--dry-run'),
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

function resolveProviders(keys: string[]) {
  return keys.map((key) => {
    const provider = providerRegistry.get(key);
    if (!provider) fail(`Unknown provider: ${key}`);
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

function summarizeProviderOutput(output: string, providerKey: string): string {
  const mockFindingsIndex = providerKey === 'mock' ? output.lastIndexOf('\nFindings:\n') : -1;
  const beforeFindings = mockFindingsIndex === -1 ? output : output.slice(0, mockFindingsIndex);
  const source = beforeFindings.trimEnd();
  if (!source) return '(no provider output)';

  if (source.length <= SUMMARY_CHAR_LIMIT) return source;

  return `${source.slice(0, SUMMARY_CHAR_LIMIT).trimEnd()}\n...[truncated to ${SUMMARY_CHAR_LIMIT} chars]`;
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
  --input-file <path>             Input file to include
  --preset <name>                 .claude/aco/tasks/<name>.md
  --permission-profile <profile>  restricted|default|unrestricted (default: restricted)
  --output-mode <mode>            brief|save-only|full (default: brief)
                                    brief summary bound: ${SUMMARY_CHAR_LIMIT} chars
  --dry-run                       Print execution plan without invoking providers
  --yes                           Explicitly consent to provider execution`);
}

function fail(message: string): never {
  console.error(message);
  process.exit(EXIT_ERROR);
}
