import { cp, rm, readdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { providerRegistry } from '@aco/wrapper';

const TEMPLATES_DIR = resolve(__dirname, '..', '..', '..', 'templates');

export interface PackInstallOptions {
  global?: boolean;
  force?: boolean;
  binaryName?: string;
}

export async function packInstall(options: PackInstallOptions = {}): Promise<void> {
  const targetBase = options.global ? join(homedir(), '.claude') : join(process.cwd(), '.claude');
  const commandsSrc = join(TEMPLATES_DIR, 'commands');
  const promptsSrc = join(TEMPLATES_DIR, 'prompts');
  const commandsDest = join(targetBase, 'commands');
  const promptsDest = join(targetBase, 'aco', 'prompts');

  console.log(`Installing aco command pack to ${targetBase} …\n`);

  await copyTree(commandsSrc, commandsDest, options.force ?? false, 'command');
  await copyTree(promptsSrc, promptsDest, options.force ?? false, 'prompt template');

  const binaryName = options.binaryName ?? 'aco';
  await placeWrapperBinary(targetBase, binaryName);

  console.log(`\n✓ Pack installed. Run 'aco pack setup' to verify provider readiness.`);
}

export async function packUninstall(options: { global?: boolean } = {}): Promise<void> {
  const targetBase = options.global ? join(homedir(), '.claude') : join(process.cwd(), '.claude');
  const commandsDest = join(targetBase, 'commands');
  const promptsDest = join(targetBase, 'aco', 'prompts');

  console.log('Uninstalling aco command pack …');

  for (const dir of [commandsDest, promptsDest]) {
    if (existsSync(dir)) {
      await rm(dir, { recursive: true, force: true });
      console.log(`  removed ${dir}`);
    }
  }

  console.log('✓ Pack uninstalled.');
}

export async function packStatus(options: { global?: boolean } = {}): Promise<void> {
  const targetBase = options.global ? join(homedir(), '.claude') : join(process.cwd(), '.claude');
  const commandsDest = join(targetBase, 'commands');

  console.log('aco pack status\n');
  console.log(`Target: ${targetBase}`);

  // List installed commands
  const installedFiles: string[] = [];
  if (existsSync(commandsDest)) {
    await collectFiles(commandsDest, installedFiles);
  }
  if (installedFiles.length === 0) {
    console.log('Commands: (none installed)');
  } else {
    console.log('Commands:');
    for (const f of installedFiles) {
      const rel = f.replace(commandsDest + '/', '');
      console.log(`  /${rel.replace(/\.md$/, '').replace('/', ':')}`);
    }
  }

  // Per-provider status
  console.log('\nProviders:');
  for (const key of providerRegistry.keys()) {
    const provider = providerRegistry.get(key)!;
    const available = provider.isAvailable();
    const auth = available ? await provider.checkAuth() : { ok: false, hint: provider.installHint };
    const avIcon = available ? '✓' : '✗';
    const authIcon = auth.ok ? '✓' : '✗';
    console.log(`  ${key}: installed ${avIcon}  auth ${authIcon}${auth.ok ? '' : `  → ${auth.hint}`}`);
  }
}

export async function packSetup(options: PackInstallOptions = {}): Promise<void> {
  await packInstall(options);
  console.log('\n--- Provider Status ---');
  for (const key of providerRegistry.keys()) {
    const provider = providerRegistry.get(key)!;
    const available = provider.isAvailable();
    if (!available) {
      console.log(`  ${key}: not installed  → run: aco provider setup ${key}`);
    } else {
      console.log(`  ${key}: installed ✓`);
    }
  }
  console.log('\nNext step: aco provider setup <gemini|copilot>');
}

export async function providerSetup(name: string): Promise<void> {
  const provider = providerRegistry.get(name);
  if (!provider) {
    console.error(`Unknown provider: ${name}`);
    console.error(`Available: ${providerRegistry.keys().join(', ')}`);
    process.exit(1);
  }

  const available = provider.isAvailable();
  if (!available) {
    console.error(`${name}: not installed ✗`);
    console.error(`  Install: ${provider.installHint}`);
    process.exit(1);
  }

  const auth = await provider.checkAuth();
  if (!auth.ok) {
    console.error(`${name}: installed ✓  auth ✗`);
    console.error(`  Fix: ${auth.hint}`);
    process.exit(1);
  }

  console.log(`${name}: installed ✓  auth: ok ✓`);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function copyTree(src: string, dest: string, force: boolean, kind: string): Promise<void> {
  if (!existsSync(src)) {
    console.warn(`  [warn] template source not found: ${src}`);
    return;
  }
  const files: string[] = [];
  await collectFiles(src, files);
  for (const srcFile of files) {
    const rel = srcFile.slice(src.length + 1);
    const destFile = join(dest, rel);
    if (!force && existsSync(destFile)) {
      console.warn(`  [skip] ${destFile} already exists (use --force to overwrite)`);
      continue;
    }
    await cp(srcFile, destFile, { recursive: false, force: true });
    console.log(`  copied ${kind}: ${destFile}`);
  }
}

async function collectFiles(dir: string, out: string[]): Promise<void> {
  if (!existsSync(dir)) return;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(full, out);
    } else {
      out.push(full);
    }
  }
}

async function placeWrapperBinary(targetBase: string, binaryName: string): Promise<void> {
  // The wrapper bin is handled via npm workspace linking; just inform the user.
  console.log(`  binary: '${binaryName}' available via npm workspace (run 'npm link packages/wrapper' if not in PATH)`);
}
