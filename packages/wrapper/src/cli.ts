#!/usr/bin/env node
import { readFile, appendFile, readdir, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import process from 'node:process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  packInstall,
  packSetup,
  packStatus,
  packUninstall,
  providerSetup,
} from './commands/pack-install.js';
import { cmdAsk } from './commands/ask.js';
import { cmdDelegate } from './commands/delegate.js';
import { cmdDoctor } from './commands/doctor.js';
import { providerRegistry } from './providers/registry.js';
import { sessionStore } from './session/store.js';
import type { PermissionProfile, OutputBufferPolicy } from './providers/interface.js';
import { acoHome } from './util/aco-home.js';
import { formatAuthStatus } from './runtime/auth-display.js';
import { invokeProviderForSession } from './runtime/provider-session-runner.js';
import { terminateProviderProcess } from './runtime/provider-process.js';
import { installProviderCancellationHandler } from './runtime/provider-cancellation.js';
import { SessionOrchestrator } from './runtime/session-orchestrator.js';
import {
  parseProviderTimeoutFlag,
  resolveProviderExecutionControl,
} from './runtime/provider-execution-control.js';
import { runSync } from './sync/sync-engine.js';

const execFileAsync = promisify(execFile);

const VERSION = loadVersion();
const EXIT_ERROR = 1;
const VALID_PERMISSION_PROFILES: PermissionProfile[] = ['default', 'restricted', 'unrestricted'];

export function resolveRunOutputBuffering(): OutputBufferPolicy {
  return { mode: 'stream-only' };
}

async function main(): Promise<void> {
  const [, , subcommand, ...rest] = process.argv;

  switch (subcommand) {
    case '--version':
    case '-v':
      console.log(`aco ${VERSION}`);
      break;
    case '--help':
    case '-h':
      printUsage();
      process.exit(0);
      break;
    case 'pack':
      await cmdPack(rest);
      break;
    case 'provider':
      await cmdProvider(rest);
      break;
    case 'run':
      await cmdRun(rest);
      break;
    case 'ask':
      await cmdAsk(rest);
      break;
    case 'delegate':
      await cmdDelegate(rest);
      break;
    case 'doctor':
      await cmdDoctor(rest);
      break;
    case 'result':
      await cmdResult(rest);
      break;
    case 'status':
      await cmdStatus(rest);
      break;
    case 'cancel':
      await cmdCancel(rest);
      break;
    case 'sync':
      await cmdSync(rest);
      break;
    default:
      console.error(`aco: unknown command '${subcommand ?? ''}'`);
      printUsage();
      process.exit(EXIT_ERROR);
  }
}

async function cmdPack(args: string[]): Promise<void> {
  const sub = args[0];
  switch (sub) {
    case 'install': {
      const isGlobal = args.includes('--global');
      const force = args.includes('--force');
      const binaryName = parseFlag(args, '--binary-name');
      if (args.includes('--binary-name') && (!binaryName || binaryName.startsWith('-'))) {
        console.error('Error: --binary-name requires a valid value');
        printUsage();
        process.exit(EXIT_ERROR);
      }
      await packInstall({ global: isGlobal, force, binaryName });
      return;
    }
    case 'uninstall': {
      const isGlobal = args.includes('--global');
      await packUninstall({ global: isGlobal });
      return;
    }
    case 'status': {
      const isGlobal = args.includes('--global');
      await packStatus({ global: isGlobal });
      return;
    }
    case 'setup':
    case undefined: {
      const isGlobal = args.includes('--global');
      const force = args.includes('--force');
      const binaryName = parseFlag(args, '--binary-name');
      if (args.includes('--binary-name') && (!binaryName || binaryName.startsWith('-'))) {
        console.error('Error: --binary-name requires a valid value');
        printUsage();
        process.exit(EXIT_ERROR);
      }
      await packSetup({ global: isGlobal, force, binaryName });
      return;
    }
    default:
      console.error(`Unknown pack sub-command: ${sub}`);
      printUsage();
      process.exit(EXIT_ERROR);
  }
}

async function cmdProvider(args: string[]): Promise<void> {
  const sub = args[0];
  if (sub !== 'setup') {
    console.error(`Unknown provider sub-command: ${sub ?? ''}`);
    printUsage();
    process.exit(EXIT_ERROR);
  }

  const providerName = args[1];
  if (!providerName) {
    console.error('Usage: aco provider setup <name>');
    process.exit(EXIT_ERROR);
  }
  await providerSetup(providerName);
}

// ---------------------------------------------------------------------------
// aco run <provider> <command> [--input <text>] [--permission-profile <profile>]
// ---------------------------------------------------------------------------
async function cmdRun(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    console.error(
      'Usage: aco run <provider> <command> [--input <text>] [--permission-profile default|restricted|unrestricted] [--timeout <seconds>] [--model <model>]'
    );
    process.exit(0);
  }

  const providerKey = args[0];
  const command = args[1];

  if (!providerKey || !command) {
    console.error(
      'Usage: aco run <provider> <command> [--input <text>] [--permission-profile default|restricted|unrestricted] [--timeout <seconds>] [--model <model>]'
    );
    process.exit(EXIT_ERROR);
  }

  const permissionProfile = parseFlag<PermissionProfile>(args, '--permission-profile') ?? 'default';
  if (!VALID_PERMISSION_PROFILES.includes(permissionProfile)) {
    console.error(
      `Invalid --permission-profile '${permissionProfile}'. Valid values: default|restricted|unrestricted`
    );
    process.exit(EXIT_ERROR);
  }
  let executionControl: ReturnType<typeof resolveProviderExecutionControl>;
  try {
    executionControl = resolveProviderExecutionControl(parseProviderTimeoutFlag(args));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(EXIT_ERROR);
  }
  const inputFlag = parseFlag(args, '--input') ?? '';
  const model = parseFlag(args, '--model');
  if (args.includes('--model') && (!model || model.startsWith('-'))) {
    console.error('Error: --model requires a valid value');
    process.exit(EXIT_ERROR);
  }

  // Validate the provider before draining stdin. The orchestrator re-checks this,
  // but reading stdin first means a bad provider on a non-terminating pipe
  // (e.g. `yes | aco run typo review`) would hang instead of failing fast.
  if (!providerRegistry.get(providerKey)) {
    console.error(`Unknown provider: ${providerKey}`);
    process.exit(EXIT_ERROR);
  }

  let content = inputFlag;
  if (!content && !process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    content = Buffer.concat(chunks).toString();
  }

  const orchestrator = new SessionOrchestrator({
    sessionStore,
    providerRegistry,
    providerRunner: {
      run: (opts) => invokeProviderForSession(opts),
    },
    cancellationInstaller: {
      install: (deps) => installProviderCancellationHandler(deps),
    },
  });

  try {
    await orchestrator.run({
      providerKey,
      command,
      permissionProfile,
      timeoutMs: executionControl.timeoutMs,
      killGraceMs: executionControl.killGraceMs,
      inputContent: content,
      model: model ?? undefined,
      cwd: process.cwd(),
      home: homedir(),
    });
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(EXIT_ERROR);
  }
}

// ---------------------------------------------------------------------------
// Run ledger types
// ---------------------------------------------------------------------------
interface RunLedgerSession {
  id: string;
  provider: string;
  status: string;
  outputLog?: string;
  briefPath?: string;
  summary?: string;
  usageStatus?: string;
  hasOutput?: boolean;
  outputBytes?: number;
  stderrBytes?: number;
  warningCount?: number;
  resultQuality?: string;
  stderrArtifactPath?: string;
  error?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  nativeSessionPath?: string;
  canonicalInputPath?: string;
  inputHash?: string;
  summaryTruncated?: boolean;
  topFindings?: string[] | null;
}

interface RunLedger {
  runId: string;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  providers?: string[];
  permissionProfile?: string;
  permissionClass?: string;
  envPolicy?: string;
  cwd?: string;
  gitBranch?: string | null;
  gitHead?: string | null;
  gitDirty?: boolean | null;
  sessions?: RunLedgerSession[];
}

async function resolveLatestRunId(runsDir: string): Promise<string | null> {
  let entries: string[];
  try {
    entries = await readdir(runsDir);
  } catch {
    return null;
  }
  if (entries.length === 0) return null;
  const withMtime = await Promise.all(
    entries.map(async (name) => {
      const s = await stat(join(runsDir, name)).catch(() => null);
      return { name, isDirectory: s?.isDirectory() ?? false, mtime: s?.mtimeMs ?? 0 };
    })
  );
  const runDirs = withMtime.filter((entry) => entry.isDirectory);
  if (runDirs.length === 0) return null;
  runDirs.sort((a, b) => b.mtime - a.mtime);
  return runDirs[0].name;
}

async function readRunLedger(runsDir: string, runId: string): Promise<RunLedger> {
  const ledgerPath = join(runsDir, runId, 'ledger.json');
  if (!existsSync(ledgerPath)) {
    throw new Error(`Run not found: ${runId}`);
  }
  const raw = await readFile(ledgerPath, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Corrupted ledger for run ${runId}: ${msg}`);
  }
  return parsed as RunLedger;
}

async function cmdResult(args: string[]): Promise<void> {
  const runFlag = parseFlag(args, '--run');

  // --run flag takes precedence over --session
  if (runFlag !== undefined) {
    const runsDir = join(acoHome(), 'runs');
    let runId = runFlag;

    if (runId === 'latest') {
      const resolved = await resolveLatestRunId(runsDir);
      if (!resolved) {
        console.error('No runs found.');
        process.exit(EXIT_ERROR);
      }
      runId = resolved;
    }

    let ledger: RunLedger;
    try {
      ledger = await readRunLedger(runsDir, runId);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(EXIT_ERROR);
    }

    console.log(`Run: ${ledger.runId ?? runId}`);
    console.log(`Started: ${ledger.startedAt}`);
    console.log(`Duration: ${ledger.durationMs ?? 0}ms`);
    console.log(`Providers: ${(ledger.providers ?? []).join(',')}`);

    for (const session of ledger.sessions ?? []) {
      console.log('');
      console.log(`Provider: ${session.provider}`);
      console.log(`Session: ${session.id}`);
      console.log(`Status: ${session.status}`);
      console.log(`Result quality: ${session.resultQuality ?? 'unknown'}`);
      console.log(`Warnings: ${session.warningCount ?? 0}`);
      console.log(`Output bytes: ${session.outputBytes ?? 0}`);
      console.log(`Output: ${session.outputLog ?? ''}`);
      console.log(`Brief: ${session.briefPath ?? ''}`);
      if (session.error) {
        console.log(`Error: ${session.error}`);
      }
      if (session.stderrArtifactPath) {
        console.log(`Stderr artifact: ${session.stderrArtifactPath}`);
      }
      console.log('Summary:');
      if (session.summary) {
        console.log(session.summary);
      }
    }
    return;
  }

  const sessionId = parseFlag(args, '--session') ?? sessionStore.latestId();
  if (!sessionId) {
    console.error('No sessions found.');
    process.exit(EXIT_ERROR);
  }

  const logPath = sessionStore.outputLogPath(sessionId);
  if (!existsSync(logPath)) {
    console.error(`No output log found for session ${sessionId}`);
    process.exit(EXIT_ERROR);
  }

  const output = await readFile(logPath, 'utf8');
  process.stdout.write(output);
}

async function cmdStatus(args: string[]): Promise<void> {
  const runFlag = parseFlag(args, '--run');

  // --run flag takes precedence over --session
  if (runFlag !== undefined) {
    const runsDir = join(acoHome(), 'runs');
    let runId = runFlag;

    if (runId === 'latest') {
      const resolved = await resolveLatestRunId(runsDir);
      if (!resolved) {
        console.error('No runs found.');
        process.exit(EXIT_ERROR);
      }
      runId = resolved;
    }

    let ledger: RunLedger;
    try {
      ledger = await readRunLedger(runsDir, runId);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(EXIT_ERROR);
    }

    console.log(`Run: ${ledger.runId ?? runId}`);
    console.log(`Started: ${ledger.startedAt}`);
    console.log(`Duration: ${ledger.durationMs ?? 0}ms`);
    console.log(`Providers: ${(ledger.providers ?? []).join(',')}`);
    console.log(`Permission class: ${ledger.permissionClass ?? 'unknown'}`);
    console.log(`Env policy: ${ledger.envPolicy ?? 'unknown'}`);

    for (const session of ledger.sessions ?? []) {
      console.log('');
      console.log(`Provider: ${session.provider}`);
      console.log(`Session: ${session.id}`);
      console.log(`Status: ${session.status}`);
      console.log(`Usage status: ${session.usageStatus ?? 'unknown'}`);
      console.log(`Warning count: ${session.warningCount ?? 0}`);
      console.log(`Result quality: ${session.resultQuality ?? 'unknown'}`);
      console.log(`Output bytes: ${session.outputBytes ?? 0}`);
      console.log(`Output: ${session.outputLog ?? ''}`);
      console.log(`Brief: ${session.briefPath ?? ''}`);
      if (session.stderrArtifactPath) {
        console.log(`Stderr artifact: ${session.stderrArtifactPath}`);
      }
    }
    return;
  }

  const sessionId = parseFlag(args, '--session') ?? sessionStore.latestId();
  if (!sessionId) {
    console.error('No sessions found.');
    process.exit(EXIT_ERROR);
  }

  try {
    const record = await sessionStore.read(sessionId);
    console.log(`Session:    ${record.id}`);
    console.log(`Provider:   ${record.provider}`);
    console.log(`Command:    ${record.command}`);
    console.log(`Status:     ${record.status}`);
    console.log(`Started:    ${record.startedAt}`);
    if (record.endedAt) console.log(`Ended:      ${record.endedAt}`);
    if (record.pid !== undefined) console.log(`PID:        ${record.pid}`);
    if (record.permissionProfile) console.log(`Permission: ${record.permissionProfile}`);
    if (record.runtimeContext) {
      const active = record.runtimeContext.active;
      const exposed = record.runtimeContext.exposed;
      console.log('Runtime:');
      console.log(`  Branch:    ${active.branch ?? '(none)'}`);
      console.log(`  Prompt:    ${active.promptTemplatePath ?? '(default)'}`);
      console.log(`  Auth:      ${formatAuthStatus(active.auth)}`);
      console.log(
        `  Agents:    ${
          exposed.providerAgents.length > 0 ? exposed.providerAgents.join(', ') : '(none)'
        }`
      );
      console.log(
        `  Hooks:     ${
          exposed.providerHooks.length > 0 ? exposed.providerHooks.join(', ') : '(none)'
        }`
      );
      if (exposed.providerConfigFiles.length > 0) {
        console.log(`  Config:    ${exposed.providerConfigFiles.join(', ')}`);
      }
      console.log(
        `  Skills:    ${
          exposed.sharedSkills.length > 0 ? exposed.sharedSkills.join(', ') : '(none)'
        }`
      );
    }
  } catch {
    console.error(`Session not found: ${sessionId}`);
    process.exit(EXIT_ERROR);
  }
}

async function cmdCancel(args: string[]): Promise<void> {
  const sessionId = parseFlag(args, '--session') ?? sessionStore.latestId();
  if (!sessionId) {
    console.error('No sessions found.');
    process.exit(EXIT_ERROR);
  }

  let record;
  try {
    record = await sessionStore.read(sessionId);
  } catch {
    console.error(`Session not found: ${sessionId}`);
    process.exit(EXIT_ERROR);
  }

  if (record.status === 'done' || record.status === 'failed') {
    console.warn(`Session ${sessionId} is already ${record.status} — nothing to cancel.`);
    return;
  }

  if (record.status === 'cancelled') {
    console.warn(`Session ${sessionId} is already cancelled.`);
    return;
  }

  await appendFile(sessionStore.errorLogPath(sessionId), `Session ${sessionId} cancelled.\n`, {
    mode: 0o600,
  });
  await sessionStore.markCancelled(sessionId);
  if (record.pid) {
    terminateProviderProcess(record.pid, 'SIGTERM');
  }
  console.log(`Session ${sessionId} cancelled.`);
}

async function cmdSync(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    console.error(
      'Usage: aco sync [--check] [--dry-run] [--force] [--strict] [--clean-duplicates] [--force-clean]\n' +
        '\n' +
        '  --check             Verify sync is current without writing files (exits 1 if stale)\n' +
        '  --dry-run           Show planned changes without writing files\n' +
        '  --force             Overwrite manifest-owned generated targets that have drifted\n' +
        '  --strict            Promote duplicate warnings to errors in check mode\n' +
        '  --clean-duplicates  Remove manifest-owned duplicate assets\n' +
        '  --force-clean       Allow cleaning ambiguous duplicate assets'
    );
    process.exit(0);
  }

  const check = args.includes('--check');
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  const strict = args.includes('--strict');
  const cleanDuplicates = args.includes('--clean-duplicates');
  const forceClean = args.includes('--force-clean');

  const repoRoot = await findRepoRoot(process.cwd());
  if (!repoRoot) {
    console.error('aco sync: could not find repository root (no git repo or CLAUDE.md found)');
    process.exit(EXIT_ERROR);
  }

  let result;
  try {
    result = await runSync(repoRoot, { check, dryRun, force, strict, cleanDuplicates, forceClean });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`aco sync: ${msg}`);
    process.exit(EXIT_ERROR);
  }

  const { created, updated, removed, skipped, warnings, conflicts } = result;
  const manifestPath = `${repoRoot}/.aco/sync-manifest.json`;

  if (check) {
    console.log('Sync check: context is current ✓');
    if (warnings > 0) {
      console.log(`  ${warnings} warning(s) — run 'aco sync' to view details`);
    }
    return;
  }

  const label = dryRun ? 'Dry-run plan' : 'Sync complete';
  console.log(`${label}:`);
  console.log(`  created:   ${created}`);
  console.log(`  updated:   ${updated}`);
  console.log(`  removed:   ${removed}`);
  console.log(`  skipped:   ${skipped}`);
  console.log(`  warnings:  ${warnings}`);
  console.log(`  conflicts: ${conflicts}`);

  if (!dryRun && conflicts > 0) {
    console.error(`\n  ${conflicts} conflict(s) detected — targets were overwritten by --force.`);
  }

  if (warnings > 0) {
    console.log(`\n  warnings: ${warnings} — see manifest for details: ${manifestPath}`);
  }

  if (!dryRun) {
    console.log(`\nManifest: ${manifestPath}`);
  }
}

async function findRepoRoot(startDir: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--show-toplevel'], {
      cwd: startDir,
    });
    return stdout.trim();
  } catch {
    let dir = startDir;
    while (true) {
      if (existsSync(join(dir, 'CLAUDE.md'))) return dir;
      const parent = join(dir, '..');
      if (parent === dir) return null;
      dir = parent;
    }
  }
}

function parseFlag<T extends string = string>(args: string[], flag: string): T | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1] as T;
}

function loadVersion(): string {
  try {
    const raw = readFileSync(join(__dirname, '..', 'package.json'), 'utf8');
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function printUsage(): void {
  console.error(`Usage:
  aco --version
  aco --help
  aco sync [--check] [--dry-run] [--force]
  aco ask --task <text> [--providers codex,antigravity,mock] [--input <text>] [--input-file <path>] [--preset <name>] [--permission-profile restricted|default|unrestricted] [--output-mode brief|save-only|full] [--model <model>] [--dry-run|--yes]
  aco delegate <agent-id> [--input <text>] [--input-file <path>]
  aco doctor
  aco run <provider> <command> [--input <text>] [--permission-profile default|restricted|unrestricted] [--timeout <seconds>] [--model <model>]
  aco result [--session <id>] [--run <runId|latest>]
  aco status [--session <id>] [--run <runId|latest>]
  aco cancel [--session <id>]
  aco pack install [--global] [--force] [--binary-name <name>]
  aco pack uninstall [--global]
  aco pack status [--global]
  aco pack setup [--global] [--force] [--binary-name <name>]
  aco provider setup <name>`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(EXIT_ERROR);
  });
}
