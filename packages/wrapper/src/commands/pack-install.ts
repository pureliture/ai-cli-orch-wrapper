import { cp, rm, readdir, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname, relative, isAbsolute, sep } from 'node:path';
import { homedir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { providerRegistry } from '../providers/registry.js';
import { runSync } from '../sync/sync-engine.js';
import { formatAuthStatus } from '../runtime/auth-display.js';
import { getCachedProviderAuth } from '../providers/auth-cache.js';

const execFileAsync = promisify(execFile);

const BINARY_CHECK_TIMEOUT_MS = 5_000;
const EXIT_ERROR = 1;
const PUBLIC_PACKAGE_NAME = '@pureliture/ai-cli-orch-wrapper';

function findPackageRoot(startDir: string): string {
  return resolve(startDir, '..', '..');
}

function findTemplatesDir(startDir: string): string {
  const packageRoot = findPackageRoot(startDir);
  const monorepoRoot = resolve(packageRoot, '..', '..');
  const devPath = join(monorepoRoot, 'templates');
  const prodPath = join(packageRoot, 'templates');

  // In development (not inside node_modules), prioritize the monorepo root templates
  const isDev = !startDir.split(sep).includes('node_modules');
  if (isDev && existsSync(devPath)) {
    return devPath;
  }

  return prodPath;
}

const PACKAGE_ROOT = findPackageRoot(__dirname);
const TEMPLATES_DIR = findTemplatesDir(__dirname);

export interface PackInstallOptions {
  global?: boolean;
  force?: boolean;
  binaryName?: string;
  skipSuccessMessage?: boolean;
}

export interface PackInstallResult {
  binaryName: string;
  binaryVerified: boolean;
}

interface PackRecoveryOptions extends PackInstallResult {
  global?: boolean;
}

const MANIFEST_PATH = (targetBase: string) => join(targetBase, 'aco', 'aco-manifest.json');

function resolveTargetBase(options: Pick<PackInstallOptions, 'global'>): string {
  return options.global ? join(homedir(), '.claude') : join(process.cwd(), '.claude');
}

export async function packInstall(options: PackInstallOptions = {}): Promise<PackInstallResult> {
  if (!existsSync(TEMPLATES_DIR)) {
    throw new Error(`Template source not found at ${TEMPLATES_DIR}`);
  }

  const targetBase = resolveTargetBase(options);
  const commandsSrc = join(TEMPLATES_DIR, 'commands');
  const promptsSrc = join(TEMPLATES_DIR, 'prompts');
  const tasksSrc = join(TEMPLATES_DIR, 'tasks');
  const commandsDest = join(targetBase, 'commands');
  const promptsDest = join(targetBase, 'aco', 'prompts');
  const tasksDest = join(targetBase, 'aco', 'tasks');

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
  await copyTree(tasksSrc, tasksDest, options.force ?? false, 'task preset', installedFiles);

  const manifestPath = MANIFEST_PATH(targetBase);
  let existingFiles: string[] = [];
  if (existsSync(manifestPath)) {
    try {
      const existing = JSON.parse(await readFile(manifestPath, 'utf8')) as { files?: string[] };
      existingFiles = existing.files || [];
    } catch {
      // Ignore parse errors, just overwrite
    }
  }

  const allFiles = Array.from(new Set([...existingFiles, ...installedFiles]));
  if (allFiles.length > 0) {
    await mkdir(dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, JSON.stringify({ files: allFiles }, null, 2));
  } else {
    console.log('  no files were copied (already up to date or empty source)');
  }

  const binaryName = options.binaryName ?? 'aco';
  const binaryVerified = await placeWrapperBinary(binaryName);

  if (!options.skipSuccessMessage) {
    if (binaryVerified) {
      console.log(`\n✓ Pack installed. Run '${binaryName} pack setup' to verify provider readiness.`);
    } else {
      console.log(`\n✓ Pack installed. Verify '${binaryName}' before running provider setup.`);
    }
  }

  return { binaryName, binaryVerified };
}

export async function packUninstall(options: { global?: boolean } = {}): Promise<void> {
  const targetBase = resolveTargetBase(options);
  const manifestPath = MANIFEST_PATH(targetBase);
  const resolvedTargetBase = resolve(targetBase);

  console.log('Uninstalling aco command pack …');

  if (existsSync(manifestPath)) {
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
      console.warn('  [warn] Manifest is empty; removing stale manifest.');
      await rm(manifestPath, { force: true });
      console.log(`  removed ${manifestPath}`);
    }
  } else {
    console.warn(
      '  [warn] No aco install manifest found. Pack may not have been installed via this tool.'
    );
  }

  console.log('✓ Pack uninstalled.');
}

export async function packStatus(options: { global?: boolean } = {}): Promise<void> {
  const targetBase = resolveTargetBase(options);
  const commandsDest = join(targetBase, 'commands');
  const promptsDest = join(targetBase, 'aco', 'prompts');
  const tasksDest = join(targetBase, 'aco', 'tasks');
  const repoRoot = process.cwd();

  console.log('aco pack status\n');
  console.log(`Target: ${targetBase}`);

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

  const promptFiles: string[] = [];
  if (existsSync(promptsDest)) {
    await collectFiles(promptsDest, promptFiles);
  }
  if (promptFiles.length === 0) {
    console.log('Prompt templates: (none installed)');
  } else {
    console.log('Prompt templates:');
    for (const f of promptFiles) {
      const rel = relative(promptsDest, f);
      console.log(`  ${rel.replace(/\.md$/, '').split(sep).join(':')}`);
    }
  }

  const taskFiles: string[] = [];
  if (existsSync(tasksDest)) {
    await collectFiles(tasksDest, taskFiles);
  }
  if (taskFiles.length === 0) {
    console.log('Task presets: (none installed)');
  } else {
    console.log('Task presets:');
    for (const f of taskFiles) {
      const rel = relative(tasksDest, f);
      console.log(`  ${rel.replace(/\.md$/, '').split(sep).join(':')}`);
    }
  }

  console.log('\nProviders:');
  for (const key of providerRegistry.keys()) {
    const provider = providerRegistry.get(key)!;
    const available = provider.isAvailable();
    const auth = available
      ? await getCachedProviderAuth(provider, { skipCache: true })
      : { ok: false, hint: provider.installHint };
    const avIcon = available ? '✓' : '✗';
    console.log(`  ${key}: installed ${avIcon}  auth ${formatAuthStatus(auth)}`);
  }

  // Report external integration observations separately
  const externalObservations: string[] = [];
  const geminiOpsxDir = join(repoRoot, '.gemini', 'commands', 'opsx');
  if (existsSync(geminiOpsxDir)) {
    externalObservations.push(`Gemini opsx commands at ${geminiOpsxDir}`);
  }
  const codexOpenspecDir = join(repoRoot, '.codex', 'skills');
  if (existsSync(codexOpenspecDir)) {
    try {
      const entries = await readdir(codexOpenspecDir, { withFileTypes: true });
      const openspecSkills = entries
        .filter((e) => e.isDirectory() && e.name.startsWith('openspec-'))
        .map((e) => e.name);
      if (openspecSkills.length > 0) {
        externalObservations.push(`Codex OpenSpec skills: ${openspecSkills.join(', ')}`);
      }
    } catch {
      // ignore
    }
  }
  const agentsOpenspecDir = join(repoRoot, '.agents', 'skills');
  if (existsSync(agentsOpenspecDir)) {
    try {
      const entries = await readdir(agentsOpenspecDir, { withFileTypes: true });
      const externalSkills = entries
        .filter(
          (e) =>
            e.isDirectory() &&
            (e.name.startsWith('openspec-') ||
              e.name.startsWith('superpowers-') ||
              e.name.startsWith('gh-'))
        )
        .map((e) => e.name);
      if (externalSkills.length > 0) {
        externalObservations.push(`Shared external skills: ${externalSkills.join(', ')}`);
      }
    } catch {
      // ignore
    }
  }

  if (externalObservations.length > 0) {
    console.log('\nExternal integrations (not ACO-owned):');
    for (const obs of externalObservations) {
      console.log(`  ${obs}`);
    }
  }
}

export async function packSetup(options: PackInstallOptions = {}): Promise<void> {
  const repoRoot = process.cwd();
  const targetBase = resolveTargetBase(options);
  try {
    await runPackSetupSyncPreflight(repoRoot);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  [error] ${msg}`);
    process.exit(1);
  }
  const installResult = await packInstall({ ...options, skipSuccessMessage: true });

  console.log('\n--- Provider Status ---');
  for (const key of providerRegistry.keys()) {
    const provider = providerRegistry.get(key)!;
    const available = provider.isAvailable();
    if (!available) {
      const setupHint = installResult.binaryVerified
        ? `run: ${installResult.binaryName} provider setup ${key}`
        : `verify '${installResult.binaryName}' before provider setup for ${key}`;
      console.log(`  ${key}: not installed  → ${setupHint}`);
    } else {
      console.log(`  ${key}: installed ✓`);
    }
  }

  console.log('\n--- Context Sync ---');
  try {
    const result = await runSync(repoRoot, {
      dryRun: false,
      check: false,
      force: false,
    });
    const { created, updated, removed, skipped, warnings, conflicts } = result;
    const manifestPath = join(repoRoot, '.aco', 'sync-manifest.json');

    console.log(
      `  created: ${created}  updated: ${updated}  removed: ${removed}  skipped: ${skipped}`
    );
    if (warnings > 0) {
      console.log(`  warnings: ${warnings} — see manifest for details: ${manifestPath}`);
    }
    if (conflicts > 0) {
      console.log(`  conflicts: ${conflicts} — run 'aco sync --check' for details`);
    }
    console.log(`  manifest: ${manifestPath}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('conflict') || msg.includes('Conflict')) {
      console.error(`  [error] Sync conflict: ${msg}`);
      console.error(`  Run 'aco sync --check' for details, or 'aco sync --force' to overwrite.`);
      printPackInstallRecovery(targetBase, { ...installResult, global: options.global });
      process.exit(1);
    } else if (msg.includes('no sync sources') || msg.includes('No sync sources')) {
      console.log(`  (skipped — no Claude context sources found)`);
    } else {
      console.error(`  [error] Sync failed after pack install: ${msg}`);
      printPackInstallRecovery(targetBase, { ...installResult, global: options.global });
      process.exit(1);
    }
  }

  console.log('\nNext steps:');
  if (installResult.binaryVerified) {
    for (const key of providerRegistry.keys()) {
      console.log(`  ${installResult.binaryName} provider setup ${key}`);
    }
  } else {
    console.log(
      `  Provider setup commands require a verified '${installResult.binaryName}' binary.`
    );
    console.log(
      `  Verify the current checkout/package first, then run provider setup for: ${providerRegistry.keys().join(', ')}`
    );
  }
}

function printPackInstallRecovery(targetBase: string, options: PackRecoveryOptions): void {
  const uninstallArgs = `pack uninstall${options.global ? ' --global' : ''}`;
  console.error(`  Pack files may already be installed. Manifest: ${MANIFEST_PATH(targetBase)}.`);
  console.error(`  Recovery: run '${uninstallArgs}' through the same entrypoint used for setup.`);
  if (options.binaryVerified) {
    console.error(`  Recovery command: ${options.binaryName} ${uninstallArgs}`);
  }
}

async function runPackSetupSyncPreflight(repoRoot: string): Promise<void> {
  try {
    await runSync(repoRoot, {
      dryRun: false,
      check: true,
      force: false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('No sync sources')) {
      return;
    }
    if (msg.includes('Conflicts:') || msg.includes('Sync conflicts detected')) {
      throw new Error(
        `Sync conflict preflight failed before pack template writes.\n${msg}\nRun 'aco sync --check' for details, or 'aco sync --force' to overwrite.`
      );
    }
    if (msg.includes('Stale outputs:') || msg.includes('Sync check failed')) {
      console.warn(
        `  [warn] Sync preflight found stale outputs; setup will install pack files and refresh sync afterwards.`
      );
      return;
    }
    throw new Error(`Sync check failed before pack template writes.\n${msg}`);
  }
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

export function describeBinaryRecovery(input: {
  binaryName: string;
  reason: string;
  packageRoot: string;
  publicPackageName: string;
}): string {
  return [
    `Binary '${input.binaryName}' was not verified: ${input.reason}.`,
    `Current package: ${input.packageRoot}`,
    'Manual recovery: run this CLI through the current checkout or install/link this local package artifact explicitly.',
    `Do not rely on an unrelated published ${input.publicPackageName} version for this local setup.`,
  ].join('\n  ');
}

async function placeWrapperBinary(binaryName: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(binaryName, ['--version'], {
      timeout: BINARY_CHECK_TIMEOUT_MS,
    });
    const versionOutput = typeof stdout === 'string' ? stdout.trim().toLowerCase() : '';
    if (versionOutput.startsWith('aco ')) {
      console.log(`  binary: '${binaryName}' already in PATH ✓`);
      return true;
    }
    console.warn(
      `  [warn] ${describeBinaryRecovery({
        binaryName,
        reason: `--version returned '${versionOutput || '(empty)'}'`,
        packageRoot: PACKAGE_ROOT,
        publicPackageName: PUBLIC_PACKAGE_NAME,
      })}`
    );
    return false;
  } catch (err) {
    console.warn(
      `  [warn] ${describeBinaryRecovery({
        binaryName,
        reason: err instanceof Error ? err.message : String(err),
        packageRoot: PACKAGE_ROOT,
        publicPackageName: PUBLIC_PACKAGE_NAME,
      })}`
    );
    return false;
  }
}

function isWithinDir(baseDir: string, targetPath: string): boolean {
  const rel = relative(baseDir, targetPath);
  return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}
