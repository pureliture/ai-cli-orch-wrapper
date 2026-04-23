#!/usr/bin/env node
import { readFile, appendFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import process from 'node:process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Writable } from 'node:stream';
import {
  packInstall,
  packSetup,
  packStatus,
  packUninstall,
  providerSetup,
} from './commands/pack-install.js';
import { providerRegistry } from './providers/registry.js';
import { sessionStore } from './session/store.js';
import type { PermissionProfile } from './providers/interface.js';
import { runSync } from './sync/sync-engine.js';

const execFileAsync = promisify(execFile);

const VERSION = loadVersion();
const EXIT_ERROR = 1;
const VALID_PERMISSION_PROFILES: PermissionProfile[] = ['default', 'restricted', 'unrestricted'];

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
      await packSetup({ global: isGlobal, force });
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
      'Usage: aco run <provider> <command> [--input <text>] [--permission-profile default|restricted|unrestricted]'
    );
    process.exit(0);
  }

  const providerKey = args[0];
  const command = args[1];

  if (!providerKey || !command) {
    console.error(
      'Usage: aco run <provider> <command> [--input <text>] [--permission-profile default|restricted|unrestricted]'
    );
    process.exit(EXIT_ERROR);
  }

  const provider = providerRegistry.get(providerKey);
  if (!provider) {
    console.error(`Unknown provider: ${providerKey}`);
    process.exit(EXIT_ERROR);
  }

  const permissionProfile = parseFlag<PermissionProfile>(args, '--permission-profile') ?? 'default';
  if (!VALID_PERMISSION_PROFILES.includes(permissionProfile)) {
    console.error(
      `Invalid --permission-profile '${permissionProfile}'. Valid values: default|restricted|unrestricted`
    );
    process.exit(EXIT_ERROR);
  }
  const inputFlag = parseFlag(args, '--input') ?? '';

  let content = inputFlag;
  if (!content && !process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    content = Buffer.concat(chunks).toString();
  }

  const cwdPromptPath = join(
    process.cwd(),
    '.claude',
    'aco',
    'prompts',
    providerKey,
    `${command}.md`
  );
  const globalPromptPath = join(
    homedir(),
    '.claude',
    'aco',
    'prompts',
    providerKey,
    `${command}.md`
  );
  let prompt = `You are a code reviewer. Perform a ${command} for the following content.`;
  if (existsSync(cwdPromptPath)) {
    prompt = await readFile(cwdPromptPath, 'utf8');
  } else if (existsSync(globalPromptPath)) {
    prompt = await readFile(globalPromptPath, 'utf8');
  }

  const session = await sessionStore.create(providerKey, command, undefined, permissionProfile);
  const tee = sessionStore.createOutputTee(session.id);
  let hasOutput = false;
  let runError: unknown;

  try {
    for await (const chunk of provider.invoke(command, prompt, content, {
      permissionProfile,
      sessionId: session.id,
      onPid: (pid) => {
        // Fire-and-forget pid update so the session can be cancelled
        sessionStore.update(session.id, { pid }).catch((err: unknown) => {
          console.warn(
            'Failed to record process PID:',
            err instanceof Error ? err.message : String(err)
          );
        });
      },
    })) {
      tee.write(chunk);
      hasOutput = true;
    }
  } catch (err) {
    runError = err;
  } finally {
    await endWritable(tee);
  }

  if (runError) {
    const msg = runError instanceof Error ? runError.message : String(runError);
    await appendFile(sessionStore.errorLogPath(session.id), msg + '\n', { mode: 0o600 });
    await sessionStore.markFailed(session.id);
    console.error(`Error: ${msg}`);
    process.exit(EXIT_ERROR);
  }

  if (!hasOutput && permissionProfile === 'restricted') {
    await appendFile(
      sessionStore.errorLogPath(session.id),
      'Permission profile: restricted — output may be blocked\n',
      { mode: 0o600 }
    );
  }

  await sessionStore.markDone(session.id);
}

async function cmdResult(args: string[]): Promise<void> {
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
    if (record.permissionProfile) console.log(`Permission: ${record.permissionProfile}`);
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

  if (record.pid) {
    try {
      process.kill(record.pid, 'SIGTERM');
    } catch {
      // The process may have already exited — safe to ignore
    }
  }

  await sessionStore.markCancelled(sessionId);
  console.log(`Session ${sessionId} cancelled.`);
}

async function cmdSync(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    console.error(
      'Usage: aco sync [--check] [--dry-run] [--force]\n' +
        '\n' +
        '  --check    Verify sync is current without writing files (exits 1 if stale)\n' +
        '  --dry-run  Show planned changes without writing files\n' +
        '  --force    Overwrite manifest-owned generated targets that have drifted'
    );
    process.exit(0);
  }

  const check = args.includes('--check');
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');

  const repoRoot = await findRepoRoot(process.cwd());
  if (!repoRoot) {
    console.error('aco sync: could not find repository root (no git repo or CLAUDE.md found)');
    process.exit(EXIT_ERROR);
  }

  let result;
  try {
    result = await runSync(repoRoot, { check, dryRun, force });
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
  aco run <provider> <command> [--input <text>] [--permission-profile default|restricted|unrestricted]
  aco result [--session <id>]
  aco status [--session <id>]
  aco cancel [--session <id>]
  aco pack install [--global] [--force] [--binary-name <name>]
  aco pack uninstall [--global]
  aco pack status [--global]
  aco pack setup [--global] [--force]
  aco provider setup <name>`);
}

async function endWritable(stream: Writable): Promise<void> {
  if (stream.writableEnded || stream.destroyed) return;
  await new Promise<void>((resolve, reject) => {
    stream.end((err?: Error | null) => (err ? reject(err) : resolve()));
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(EXIT_ERROR);
});
