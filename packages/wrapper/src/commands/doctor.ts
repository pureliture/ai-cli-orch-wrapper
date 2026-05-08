import { existsSync, readFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, isAbsolute, join, relative } from 'node:path';
import process from 'node:process';
import { providerRegistry } from '../providers/registry.js';
import { runSync } from '../sync/sync-engine.js';

const execFileAsync = promisify(execFile);

export async function cmdDoctor(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    printDoctorUsage();
    return;
  }

  const cwd = process.cwd();
  const repoRoot = await findRepoRoot(cwd);
  const harnessRoot = repoRoot ?? cwd;

  console.log('aco doctor');
  console.log('');
  console.log(`Node: ${process.version}`);
  console.log(`aco version: ${loadVersion()}`);
  console.log(`Git repository: ${repoRoot ? repoRoot : 'missing'}`);
  console.log(
    `.claude harness: ${existsSync(join(harnessRoot, '.claude')) ? 'present' : 'missing'}`
  );
  console.log(
    `/aco command: ${
      existsSync(join(harnessRoot, '.claude', 'commands', 'aco.md')) ? 'present' : 'missing'
    }`
  );
  console.log(
    `aco-delegation skill: ${
      existsSync(join(harnessRoot, '.claude', 'skills', 'aco-delegation', 'SKILL.md'))
        ? 'present'
        : 'missing'
    }`
  );

  console.log('');
  console.log('Providers:');
  for (const key of ['mock', 'codex', 'gemini']) {
    const provider = providerRegistry.get(key);
    if (!provider) {
      console.log(`  ${key}: missing (not registered)`);
      continue;
    }

    if (!provider.isAvailable()) {
      console.log(`  ${key}: missing (${provider.installHint})`);
      continue;
    }

    console.log(`  ${key}: ${formatLocalProviderReadiness(key)}`);
  }

  console.log('');
  console.log('Security:');
  console.log('  remote auth verification: not performed');
  console.log('  provider invocation: not performed');
  console.log('  secrets: not printed');

  console.log('');
  console.log(`Sync drift: ${await checkSync(repoRoot)}`);
}

function formatLocalProviderReadiness(key: string): string {
  if (key === 'mock') return 'ready (built-in, no external credentials)';
  if (key === 'codex') return formatCodexReadiness();
  if (key === 'gemini') return formatGeminiReadiness();
  return 'available (credential heuristic unavailable)';
}

function formatCodexReadiness(): string {
  return formatCredentialReadiness({
    envKeys: ['OPENAI_API_KEY'],
    credPath: ['.codex', 'auth.json'],
    missingMsg: 'codex login OR export OPENAI_API_KEY',
    loginCmd: 'run codex login',
    validateCred: (parsed) => {
      const p = parsed as { expires_at?: number };
      if (typeof p.expires_at === 'number') {
        const now = Math.floor(Date.now() / 1000);
        if (p.expires_at < now) {
          return 'available; local auth heuristic expired (run codex login)';
        }
      }
      return null;
    },
  });
}

function formatGeminiReadiness(): string {
  return formatCredentialReadiness({
    envKeys: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    credPath: ['.gemini', 'oauth_creds.json'],
    missingMsg: 'gemini auth login OR export GEMINI_API_KEY',
    loginCmd: 'run gemini auth login',
  });
}

interface CredentialReadinessOptions {
  envKeys: string[];
  credPath: string[];
  missingMsg: string;
  loginCmd: string;
  validateCred?: (parsed: unknown) => string | null;
}

function formatCredentialReadiness(options: CredentialReadinessOptions): string {
  for (const key of options.envKeys) {
    if (process.env[key]) return `available; local auth heuristic ready (${key})`;
  }

  const homeDir = process.env.HOME ?? process.env.USERPROFILE;
  if (!homeDir) {
    return `available; local auth heuristic missing (no HOME or USERPROFILE set; ${options.missingMsg})`;
  }

  const fullPath = join(homeDir, ...options.credPath);
  if (!existsSync(fullPath)) {
    return `available; local auth heuristic missing (${options.missingMsg})`;
  }

  try {
    const parsed = JSON.parse(readFileSync(fullPath, 'utf8'));
    if (options.validateCred) {
      const result = options.validateCred(parsed);
      if (result) return result;
    }
    return 'available; local auth heuristic ready (oauth file)';
  } catch {
    return `available; local auth heuristic unreadable (${options.loginCmd})`;
  }
}

async function checkSync(repoRoot: string | null): Promise<string> {
  if (!repoRoot) return 'skipped (not in a git repository)';
  if (!existsSync(join(repoRoot, 'CLAUDE.md'))) return 'skipped (CLAUDE.md not found)';
  const manifestPath = join(repoRoot, '.aco', 'sync-manifest.json');
  if (!existsSync(manifestPath)) {
    return 'not configured (sync manifest missing)';
  }
  if (manifestPointsAtAnotherCheckout(manifestPath, repoRoot)) {
    return 'needs attention (sync manifest points at another checkout)';
  }

  try {
    await runSync(repoRoot, { check: true });
    return 'ok';
  } catch (err) {
    const message = err instanceof Error ? err.message.split('\n')[0] : String(err);
    return `needs attention (${message})`;
  }
}

function manifestPointsAtAnotherCheckout(manifestPath: string, repoRoot: string): boolean {
  try {
    const raw = readFileSync(manifestPath, 'utf8');
    const parsed = JSON.parse(raw) as {
      sourceHashes?: Record<string, unknown>;
      targetHashes?: Record<string, unknown>;
      targets?: Record<string, unknown>;
    };
    const paths = [
      ...Object.keys(parsed.sourceHashes ?? {}),
      ...Object.keys(parsed.targetHashes ?? {}),
      ...Object.keys(parsed.targets ?? {}),
    ];
    return paths.some((path) => isAbsolute(path) && !isPathWithin(repoRoot, path));
  } catch {
    return false;
  }
}

function isPathWithin(baseDir: string, targetPath: string): boolean {
  const rel = relative(baseDir, targetPath);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

async function findRepoRoot(startDir: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--show-toplevel'], {
      cwd: startDir,
      timeout: 2000,
    });
    return stdout.trim();
  } catch {
    return findGitDirAncestor(startDir);
  }
}

function findGitDirAncestor(startDir: string): string | null {
  let current = startDir;
  while (true) {
    if (existsSync(join(current, '.git'))) return current;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function loadVersion(): string {
  try {
    const pkgPath =
      typeof __dirname !== 'undefined'
        ? join(__dirname, '..', '..', 'package.json')
        : new URL('../../package.json', (0, eval)('import.meta.url') as string).pathname;
    const raw = readFileSync(pkgPath, 'utf8');
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function printDoctorUsage(): void {
  console.log(`Usage: aco doctor

Runs local, non-network diagnostics for the aco wrapper, harness files, provider
availability, local credential readiness heuristics, and sync drift status.`);
}
