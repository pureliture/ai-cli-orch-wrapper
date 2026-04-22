import { cp, rm, readdir, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname, relative, isAbsolute, sep } from 'node:path';
import { homedir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { providerRegistry } from '@pureliture/ai-cli-orch-wrapper';

const execFileAsync = promisify(execFile);

const BINARY_CHECK_TIMEOUT_MS = 5_000;
const NPM_INSTALL_TIMEOUT_MS = 60_000;
const EXIT_ERROR = 1;

const TEMPLATES_DIR = resolve(__dirname, '..', '..', '..', '..', 'templates');

export interface PackInstallOptions {
  global?: boolean;
  force?: boolean;
  binaryName?: string;
}

const MANIFEST_PATH = (targetBase: string) => join(targetBase, 'aco', 'aco-manifest.json');

export async function packInstall(options: PackInstallOptions = {}): Promise<void> {
  const targetBase = options.global ? join(homedir(), '.claude') : join(process.cwd(), '.claude');
  const commandsSrc = join(TEMPLATES_DIR, 'commands');
  const promptsSrc = join(TEMPLATES_DIR, 'prompts');
  const commandsDest = join(targetBase, 'commands');
  const promptsDest = join(targetBase, 'aco', 'prompts');

  console.log(`Installing aco command pack to ${targetBase} …\n`);

  const installedFiles: string[] = [];
  await copyTree(commandsSrc, commandsDest, options.force ?? false, 'command', installedFiles);
  await copyTree(
    promptsSrc,
    promptsDest,
    options.force ?? false,
    'prompt template',
    installedFiles
  );

  // Write manifest for selective uninstall
  const manifestPath = MANIFEST_PATH(targetBase);
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify({ files: installedFiles }, null, 2));

  const binaryName = options.binaryName ?? 'aco';
  await placeWrapperBinary(targetBase, binaryName);

  console.log(`\n✓ Pack installed. Run 'aco pack setup' to verify provider readiness.`);
}

export async function packUninstall(options: { global?: boolean } = {}): Promise<void> {
  const targetBase = options.global ? join(homedir(), '.claude') : join(process.cwd(), '.claude');
  const manifestPath = MANIFEST_PATH(targetBase);
  const resolvedTargetBase = resolve(targetBase);

  console.log('Uninstalling aco command pack …');

  if (existsSync(manifestPath)) {
    // Selective removal: only delete files recorded in the install manifest
    let manifest: { files?: string[] } = {};
    try {
      manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { files?: string[] };
    } catch (err) {
      console.warn(
        '  [warn] Could not read install manifest; falling back to directory removal.',
        err instanceof Error ? err.message : String(err)
      );
    }

    if (manifest.files && manifest.files.length > 0) {
      for (const file of manifest.files) {
        const resolvedFile = resolve(file);
        if (!isWithinDir(resolvedTargetBase, resolvedFile)) {
          console.warn(`  [warn] Skipping manifest entry outside target directory: ${file}`);
          continue;
        }
        if (existsSync(file)) {
          await rm(file, { force: true });
          console.log(`  removed ${file}`);
        }
      }
      await rm(manifestPath, { force: true });
    } else {
      // Fallback: remove tracked directories
      const commandsDest = join(targetBase, 'commands');
      const promptsDest = join(targetBase, 'aco', 'prompts');
      for (const dir of [commandsDest, promptsDest]) {
        if (existsSync(dir)) {
          await rm(dir, { recursive: true, force: true });
          console.log(`  removed ${dir}`);
        }
      }
    }
  } else {
    console.warn(
      '  [warn] No aco install manifest found. Pack may not have been installed via this tool.'
    );
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
      const rel = relative(commandsDest, f);
      const slashName = rel.replace(/\.md$/, '').split(sep).join(':');
      console.log(`  /${slashName}`);
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
    console.log(
      `  ${key}: installed ${avIcon}  auth ${authIcon}${auth.ok ? '' : `  → ${auth.hint}`}`
    );
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
  console.log('\nNext step: aco provider setup gemini');
}

export async function providerSetup(name: string): Promise<void> {
  const provider = providerRegistry.get(name);
  if (!provider) {
    console.error(`Unknown provider: ${name}`);
    console.error(`Available: ${providerRegistry.keys().join(', ')}`);
    process.exit(EXIT_ERROR);
  }

  const available = provider.isAvailable();
  if (!available) {
    console.error(`${name}: not installed ✗`);
    console.error(`  Install: ${provider.installHint}`);
    process.exit(EXIT_ERROR);
  }

  const auth = await provider.checkAuth();
  if (!auth.ok) {
    console.error(`${name}: installed ✓  auth ✗`);
    console.error(`  Fix: ${auth.hint}`);
    process.exit(EXIT_ERROR);
  }

  console.log(`${name}: installed ✓  auth: ok ✓`);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function copyTree(
  src: string,
  dest: string,
  force: boolean,
  kind: string,
  manifest: string[]
): Promise<void> {
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
    await mkdir(dirname(destFile), { recursive: true });
    await cp(srcFile, destFile, { recursive: false, force: true });
    manifest.push(destFile);
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

async function placeWrapperBinary(_targetBase: string, binaryName: string): Promise<void> {
  // Check if already in PATH and appears to be the expected public aco binary
  try {
    const { stdout } = await execFileAsync(binaryName, ['--version'], {
      timeout: BINARY_CHECK_TIMEOUT_MS,
    });
    const versionOutput = typeof stdout === 'string' ? stdout.trim().toLowerCase() : '';
    if (versionOutput.startsWith('aco ')) {
      console.log(`  binary: '${binaryName}' already in PATH ✓`);
      return;
    }
    console.warn(
      `  [warn] Found '${binaryName}' in PATH, but '--version' output did not look like @pureliture/ai-cli-orch-wrapper. Proceeding to install @pureliture/ai-cli-orch-wrapper globally.`
    );
  } catch {
    // Not found in PATH — proceed to global npm install
  }

  try {
    console.log(`  binary: installing @pureliture/ai-cli-orch-wrapper globally …`);
    await execFileAsync('npm', ['install', '-g', '@pureliture/ai-cli-orch-wrapper'], {
      timeout: NPM_INSTALL_TIMEOUT_MS,
    });
    console.log(`  binary: '${binaryName}' installed globally ✓`);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`  [warn] Could not install '${binaryName}' globally: ${reason}`);
    console.warn(`         Run manually: npm install -g @pureliture/ai-cli-orch-wrapper`);
  }
}

function isWithinDir(baseDir: string, targetPath: string): boolean {
  const rel = relative(baseDir, targetPath);
  return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}
