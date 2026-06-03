import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { computeHash } from '../src/sync/hash.js';
import { describeBinaryRecovery, packSetup } from '../src/commands/pack-install.js';
import { resolveRunPromptTemplate } from '../src/runtime/run-prompt-template.js';
import { runSync } from '../src/sync/sync-engine.js';
import type { SyncManifest } from '../src/sync/transform-interface.js';

interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

const wrapperRoot = resolve(__dirname, '..');

async function withWorkspace(run: (workspace: string) => Promise<void>): Promise<void> {
  const workspace = await mkdtemp(join(tmpdir(), 'aco-pack-runtime-contract-'));
  const oldCwd = process.cwd();
  try {
    process.chdir(workspace);
    await run(workspace);
  } finally {
    process.chdir(oldCwd);
    await rm(workspace, { recursive: true, force: true });
  }
}

async function makeFakeAcoBinary(name = 'aco-test-local'): Promise<string> {
  const binDir = await mkdtemp(join(tmpdir(), 'aco-pack-runtime-bin-'));
  const binary = join(binDir, name);
  await writeFile(binary, '#!/usr/bin/env node\nprocess.stdout.write("aco 0.4.0\\n");\n');
  await chmod(binary, 0o755);
  return binDir;
}

async function setupPack(options: { force?: boolean } = {}): Promise<void> {
  await packSetup({
    binaryName: 'aco-test-local',
    force: options.force,
  });
}

async function runCli(
  args: string[],
  options: { cwd: string; env?: Record<string, string | undefined>; timeoutMs?: number }
): Promise<CliResult> {
  const cliPath = join(wrapperRoot, 'src', 'cli.ts');
  const tsxRegister = require.resolve('tsx/cjs');

  return new Promise((resolveResult) => {
    execFile(
      process.execPath,
      ['--require', tsxRegister, cliPath, ...args],
      {
        cwd: options.cwd,
        env: {
          ...process.env,
          NO_COLOR: '1',
          ...options.env,
        },
        timeout: options.timeoutMs ?? 8000,
      },
      (error, stdout, stderr) => {
        let code = 0;
        if (error) {
          code =
            typeof (error as { code?: unknown }).code === 'number'
              ? (error as { code: number }).code
              : 1;
        }
        resolveResult({ code, stdout, stderr });
      }
    );
  });
}

async function setupSyncConflictWorkspace(workspace: string): Promise<string> {
  const canonicalWorkspace = await realpath(workspace);
  await mkdir(join(workspace, '.claude', 'agents'), { recursive: true });
  await writeFile(join(workspace, 'CLAUDE.md'), 'test context\n');
  await writeFile(join(workspace, '.claude', 'agents', 'reviewer.md'), '---\nid: reviewer\n---\n');

  const targetPath = join(canonicalWorkspace, '.codex', 'agents', 'reviewer.toml');
  const originalTargetContent = 'name = "reviewer"\n';
  await mkdir(join(workspace, '.codex', 'agents'), { recursive: true });
  await writeFile(targetPath, originalTargetContent);

  const manifest: SyncManifest = {
    version: '1',
    generatedAt: new Date().toISOString(),
    sourceHashes: {},
    targetHashes: {
      [targetPath]: computeHash(originalTargetContent),
    },
    targets: {},
    skipped: [],
    warnings: [],
  };
  await mkdir(join(workspace, '.aco'), { recursive: true });
  await writeFile(join(workspace, '.aco', 'sync-manifest.json'), JSON.stringify(manifest));
  await writeFile(targetPath, 'name = "manually-edited-reviewer"\n');
  return targetPath;
}

async function listMarkdownFiles(root: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(dir: string, prefix = ''): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const rel = prefix ? join(prefix, entry.name) : entry.name;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, rel);
      } else if (entry.name.endsWith('.md')) {
        files.push(rel);
      }
    }
  }

  await walk(root);
  return files.sort();
}

function templateDisplayName(file: string, options: { command?: boolean } = {}): string {
  const name = file.replace(/\.md$/, '').split('/').join(':');
  return options.command ? `/${name}` : name;
}

function normalizeMarkdown(content: string): string {
  return content.replace(/\r\n/g, '\n');
}

describe('pack template runtime contract', () => {
  it('installs commands, prompt templates, and task presets while preserving existing presets', async () => {
    const binDir = await makeFakeAcoBinary();
    await withWorkspace(async (workspace) => {
      await mkdir(join(workspace, '.claude', 'aco', 'tasks'), { recursive: true });
      await writeFile(join(workspace, '.claude', 'aco', 'tasks', 'review.md'), 'user preset\n');

      process.env.PATH = `${binDir}${delimiter}${process.env.PATH ?? ''}`;
      await setupPack();

      await stat(join(workspace, '.claude', 'commands', 'aco.md'));
      await stat(join(workspace, '.claude', 'aco', 'prompts', 'antigravity', 'review.md'));
      await stat(join(workspace, '.claude', 'aco', 'prompts', 'codex', 'review.md'));
      await stat(join(workspace, '.claude', 'aco', 'tasks', 'spec-critique.md'));
      await stat(join(workspace, '.claude', 'aco', 'tasks', 'plan-critique.md'));
      await stat(join(workspace, '.claude', 'aco', 'tasks', 'tdd.md'));
      await stat(join(workspace, '.claude', 'aco', 'tasks', 'code-simplify.md'));
      await stat(join(workspace, '.claude', 'aco', 'tasks', 'default.md'));

      const reviewPreset = await readFile(
        join(workspace, '.claude', 'aco', 'tasks', 'review.md'),
        'utf8'
      );
      assert.equal(reviewPreset, 'user preset\n');
    });
  });

  it('force overwrites packaged task presets and keeps the manifest entry', async () => {
    const binDir = await makeFakeAcoBinary();
    await withWorkspace(async (workspace) => {
      await mkdir(join(workspace, '.claude', 'aco', 'tasks'), { recursive: true });
      const presetPath = join(workspace, '.claude', 'aco', 'tasks', 'review.md');
      await writeFile(presetPath, 'user preset\n');

      process.env.PATH = `${binDir}${delimiter}${process.env.PATH ?? ''}`;
      await setupPack({ force: true });

      const reviewPreset = await readFile(presetPath, 'utf8');
      assert.notEqual(reviewPreset, 'user preset\n');

      const manifest = JSON.parse(
        await readFile(join(workspace, '.claude', 'aco', 'aco-manifest.json'), 'utf8')
      ) as { files: string[] };
      assert.equal(
        manifest.files.some((file) => file.endsWith('/.claude/aco/tasks/review.md')),
        true
      );
    });
  });

  it('reports commands, prompt templates, and task presets in pack status', async () => {
    const binDir = await makeFakeAcoBinary();
    await withWorkspace(async (workspace) => {
      process.env.PATH = `${binDir}${delimiter}${process.env.PATH ?? ''}`;
      await setupPack();

      const result = await runCli(['pack', 'status'], {
        cwd: workspace,
        env: { PATH: process.env.PATH },
      });

      assert.equal(result.code, 0, result.stdout + result.stderr);
      const outputLines = new Set(result.stdout.split(/\r?\n/).map((line) => line.trim()));

      assert.equal(outputLines.has('Commands:'), true);
      assert.equal(outputLines.has('Prompt templates:'), true);
      assert.equal(outputLines.has('Task presets:'), true);

      const templatesRoot = resolve(wrapperRoot, '..', '..', 'templates');
      for (const command of await listMarkdownFiles(join(templatesRoot, 'commands'))) {
        assert.equal(outputLines.has(templateDisplayName(command, { command: true })), true);
      }
      for (const prompt of await listMarkdownFiles(join(templatesRoot, 'prompts'))) {
        assert.equal(outputLines.has(templateDisplayName(prompt)), true);
      }
      for (const task of await listMarkdownFiles(join(templatesRoot, 'tasks'))) {
        assert.equal(outputLines.has(templateDisplayName(task)), true);
      }
    });
  });

  it('keeps repo-local task presets byte-aligned with packaged task presets', async () => {
    const templatesTasks = resolve(wrapperRoot, '..', '..', 'templates', 'tasks');
    const repoLocalTasks = resolve(wrapperRoot, '..', '..', '.claude', 'aco', 'tasks');
    const packagedFiles = await listMarkdownFiles(templatesTasks);
    const repoLocalFiles = await listMarkdownFiles(repoLocalTasks);

    assert.notEqual(packagedFiles.length, 0);
    assert.deepEqual(repoLocalFiles, packagedFiles);

    for (const taskFile of packagedFiles) {
      const packaged = await readFile(join(templatesTasks, taskFile), 'utf8');
      const repoLocal = await readFile(join(repoLocalTasks, taskFile), 'utf8');
      assert.equal(normalizeMarkdown(repoLocal), normalizeMarkdown(packaged), taskFile);
    }
  });

  it('resolves documented review prompts and keeps unknown commands on generic fallback', async () => {
    const binDir = await makeFakeAcoBinary();
    await withWorkspace(async (workspace) => {
      process.env.PATH = `${binDir}${delimiter}${process.env.PATH ?? ''}`;
      await setupPack();

      const codexReview = await resolveRunPromptTemplate({
        cwd: workspace,
        home: workspace,
        providerKey: 'codex',
        command: 'review',
      });
      assert.equal(
        codexReview.promptTemplatePath,
        join(workspace, '.claude', 'aco', 'prompts', 'codex', 'review.md')
      );

      const nested = join(workspace, 'packages', 'app');
      await mkdir(nested, { recursive: true });
      const nestedCodexReview = await resolveRunPromptTemplate({
        cwd: nested,
        home: workspace,
        providerKey: 'codex',
        command: 'review',
      });
      assert.equal(
        nestedCodexReview.promptTemplatePath,
        join(workspace, '.claude', 'aco', 'prompts', 'codex', 'review.md')
      );

      // antigravity:review는 pack setup 후 .claude/aco/prompts/antigravity/review.md에서 해소된다.
      const antigravityReview = await resolveRunPromptTemplate({
        cwd: workspace,
        home: workspace,
        providerKey: 'antigravity',
        command: 'review',
      });
      assert.equal(
        antigravityReview.promptTemplatePath,
        join(workspace, '.claude', 'aco', 'prompts', 'antigravity', 'review.md')
      );

      const unknown = await resolveRunPromptTemplate({
        cwd: workspace,
        home: workspace,
        providerKey: 'codex',
        command: 'unknown-command',
      });
      assert.equal(unknown.promptTemplatePath, undefined);
      assert.match(unknown.prompt, /Perform a unknown-command/);
    });
  });

  it('fails documented review commands before provider invocation when the prompt template is missing', async () => {
    await assert.rejects(
      resolveRunPromptTemplate({
        cwd: await mkdtemp(join(tmpdir(), 'aco-missing-review-cwd-')),
        home: await mkdtemp(join(tmpdir(), 'aco-missing-review-home-')),
        providerKey: 'antigravity',
        command: 'review',
      }),
      /Missing prompt template.*antigravity.*review/
    );
  });

  it('rejects prompt template path segments that could escape the prompt root', async () => {
    await assert.rejects(
      resolveRunPromptTemplate({
        cwd: await mkdtemp(join(tmpdir(), 'aco-invalid-command-cwd-')),
        home: await mkdtemp(join(tmpdir(), 'aco-invalid-command-home-')),
        providerKey: 'antigravity',
        command: '../review',
      }),
      /Invalid command name/
    );

    await assert.rejects(
      resolveRunPromptTemplate({
        cwd: await mkdtemp(join(tmpdir(), 'aco-invalid-provider-cwd-')),
        home: await mkdtemp(join(tmpdir(), 'aco-invalid-provider-home-')),
        providerKey: '../antigravity',
        command: 'review',
      }),
      /Invalid provider key/
    );
  });

  it('loads documented presets after pack setup and keeps missing preset errors actionable', async () => {
    const binDir = await makeFakeAcoBinary();
    await withWorkspace(async (workspace) => {
      process.env.PATH = `${binDir}${delimiter}${process.env.PATH ?? ''}`;
      await setupPack();

      for (const preset of [
        'review',
        'spec-critique',
        'plan-critique',
        'tdd',
        'code-simplify',
        'default',
      ]) {
        const result = await runCli(['ask', '--preset', preset, '--dry-run'], {
          cwd: workspace,
          env: { PATH: process.env.PATH },
        });
        assert.equal(result.code, 0, `${preset}: ${result.stdout}${result.stderr}`);
        assert.match(result.stdout, new RegExp(`Preset: ${preset}`));
        assert.match(result.stdout, /Provider execution: skipped/);
      }

      const missing = await runCli(['ask', '--preset', 'missing-preset', '--dry-run'], {
        cwd: workspace,
        env: { PATH: process.env.PATH },
      });
      assert.equal(missing.code, 1);
      assert.match(missing.stdout + missing.stderr, /Preset not found: missing-preset/);
    });
  });

  it('does not auto-install the public package when binary verification fails', async () => {
    const message = describeBinaryRecovery({
      binaryName: 'missing-aco',
      reason: 'not found in PATH',
      packageRoot: wrapperRoot,
      publicPackageName: '@pureliture/ai-cli-orch-wrapper',
    });

    assert.doesNotMatch(message, /npm install -g @pureliture\/ai-cli-orch-wrapper/);
    assert.match(message, /missing-aco/);
    assert.match(message, /current package/i);
  });

  it('passes --binary-name through the pack setup CLI path', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'aco-pack-binary-name-'));
    const binDir = await makeFakeAcoBinary('aco-test-local');
    try {
      const result = await runCli(['pack', 'setup', '--binary-name', 'aco-test-local'], {
        cwd: workspace,
        env: {
          HOME: await mkdtemp(join(tmpdir(), 'aco-pack-binary-home-')),
          USERPROFILE: await mkdtemp(join(tmpdir(), 'aco-pack-binary-profile-')),
          PATH: binDir,
        },
      });

      assert.equal(result.code, 0, result.stdout + result.stderr);
      assert.match(result.stdout + result.stderr, /aco-test-local/);
      assert.doesNotMatch(
        result.stdout + result.stderr,
        /npm install -g @pureliture\/ai-cli-orch-wrapper/
      );
    } finally {
      await rm(workspace, { recursive: true, force: true });
      await rm(binDir, { recursive: true, force: true });
    }
  });

  it('does not print provider setup commands when the requested binary is not verified', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'aco-pack-missing-binary-'));
    const emptyBinDir = await mkdtemp(join(tmpdir(), 'aco-pack-empty-bin-'));
    try {
      const result = await runCli(['pack', 'setup', '--binary-name', 'definitely-missing-aco'], {
        cwd: workspace,
        env: {
          HOME: await mkdtemp(join(tmpdir(), 'aco-pack-missing-binary-home-')),
          USERPROFILE: await mkdtemp(join(tmpdir(), 'aco-pack-missing-binary-profile-')),
          PATH: emptyBinDir,
        },
      });

      assert.equal(result.code, 0, result.stdout + result.stderr);
      assert.match(result.stdout + result.stderr, /Binary 'definitely-missing-aco' was not verified/);
      assert.doesNotMatch(result.stdout + result.stderr, /\n  aco provider setup /);
      assert.match(
        result.stdout + result.stderr,
        /Provider setup commands require a verified 'definitely-missing-aco' binary/
      );
    } finally {
      await rm(workspace, { recursive: true, force: true });
      await rm(emptyBinDir, { recursive: true, force: true });
    }
  });

  it('reports pack uninstall recovery when post-install sync fails after template writes', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'aco-pack-post-sync-failure-'));
    const binDir = await makeFakeAcoBinary('aco');
    try {
      await writeFile(join(workspace, 'CLAUDE.md'), '# Source context\n');
      // Force a post-install sync WRITE failure deterministically — independent of
      // process privileges (root in CI/Docker bypasses directory permission bits).
      // A source agent drives a `.codex/agents/*.toml` write, and `.codex/agents` is
      // pre-created as a FILE so sync's `mkdir(.codex/agents)` always fails
      // (ENOTDIR/EEXIST) after pack templates have already been installed.
      await mkdir(join(workspace, '.claude', 'agents'), { recursive: true });
      await writeFile(
        join(workspace, '.claude', 'agents', 'reviewer.md'),
        '---\nid: reviewer\nwhen: Review code\n---\nYou are a reviewer.\n'
      );
      await mkdir(join(workspace, '.codex'), { recursive: true });
      await writeFile(join(workspace, '.codex', 'agents'), 'not a directory\n');

      const result = await runCli(['pack', 'setup'], {
        cwd: workspace,
        env: {
          HOME: await mkdtemp(join(tmpdir(), 'aco-pack-post-sync-home-')),
          USERPROFILE: await mkdtemp(join(tmpdir(), 'aco-pack-post-sync-profile-')),
          PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}`,
        },
      });

      assert.equal(result.code, 1);
      assert.equal(existsSync(join(workspace, '.claude', 'aco', 'tasks', 'review.md')), true);
      assert.match(result.stdout + result.stderr, /Pack files may already be installed/);
      assert.match(result.stdout + result.stderr, /\.claude[/\\]aco[/\\]aco-manifest\.json/);
      assert.match(result.stdout + result.stderr, /same entrypoint used for setup/);
      assert.match(result.stdout + result.stderr, /Recovery command: aco pack uninstall/);
    } finally {
      await rm(workspace, { recursive: true, force: true });
      await rm(binDir, { recursive: true, force: true });
    }
  });

  it('includes global scope and binary override in post-install sync recovery', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'aco-pack-global-sync-failure-'));
    const home = await mkdtemp(join(tmpdir(), 'aco-pack-global-home-'));
    const binDir = await makeFakeAcoBinary('aco-test-local');
    try {
      await writeFile(join(workspace, 'CLAUDE.md'), '# Source context\n');
      // Force a post-install sync WRITE failure deterministically — independent of
      // process privileges (root in CI/Docker bypasses directory permission bits).
      // A source agent drives a `.codex/agents/*.toml` write, and `.codex/agents` is
      // pre-created as a FILE so sync's `mkdir(.codex/agents)` always fails
      // (ENOTDIR/EEXIST) after pack templates have already been installed.
      await mkdir(join(workspace, '.claude', 'agents'), { recursive: true });
      await writeFile(
        join(workspace, '.claude', 'agents', 'reviewer.md'),
        '---\nid: reviewer\nwhen: Review code\n---\nYou are a reviewer.\n'
      );
      await mkdir(join(workspace, '.codex'), { recursive: true });
      await writeFile(join(workspace, '.codex', 'agents'), 'not a directory\n');

      const result = await runCli(
        ['pack', 'setup', '--global', '--binary-name', 'aco-test-local'],
        {
          cwd: workspace,
          env: {
            HOME: home,
            USERPROFILE: await mkdtemp(join(tmpdir(), 'aco-pack-global-profile-')),
            PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}`,
          },
        }
      );

      assert.equal(result.code, 1);
      assert.match(result.stdout + result.stderr, /Pack files may already be installed/);
      assert.match(
        result.stdout + result.stderr,
        new RegExp(`${home.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[/\\\\]\\.claude[/\\\\]aco[/\\\\]aco-manifest\\.json`)
      );
      assert.match(result.stdout + result.stderr, /Recovery command: aco-test-local pack uninstall --global/);
    } finally {
      await rm(workspace, { recursive: true, force: true });
      await rm(home, { recursive: true, force: true });
      await rm(binDir, { recursive: true, force: true });
    }
  });

  it('keeps post-install sync recovery entrypoint-neutral when binary is not verified', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'aco-pack-neutral-sync-failure-'));
    const emptyBinDir = await mkdtemp(join(tmpdir(), 'aco-pack-neutral-empty-bin-'));
    try {
      await writeFile(join(workspace, 'CLAUDE.md'), '# Source context\n');
      // Force a post-install sync WRITE failure deterministically — independent of
      // process privileges (root in CI/Docker bypasses directory permission bits).
      // A source agent drives a `.codex/agents/*.toml` write, and `.codex/agents` is
      // pre-created as a FILE so sync's `mkdir(.codex/agents)` always fails
      // (ENOTDIR/EEXIST) after pack templates have already been installed.
      await mkdir(join(workspace, '.claude', 'agents'), { recursive: true });
      await writeFile(
        join(workspace, '.claude', 'agents', 'reviewer.md'),
        '---\nid: reviewer\nwhen: Review code\n---\nYou are a reviewer.\n'
      );
      await mkdir(join(workspace, '.codex'), { recursive: true });
      await writeFile(join(workspace, '.codex', 'agents'), 'not a directory\n');

      const result = await runCli(['pack', 'setup', '--binary-name', 'missing-aco'], {
        cwd: workspace,
        env: {
          HOME: await mkdtemp(join(tmpdir(), 'aco-pack-neutral-home-')),
          USERPROFILE: await mkdtemp(join(tmpdir(), 'aco-pack-neutral-profile-')),
          PATH: emptyBinDir,
        },
      });

      assert.equal(result.code, 1);
      assert.match(result.stdout + result.stderr, /same entrypoint used for setup/);
      assert.match(result.stdout + result.stderr, /pack uninstall/);
      assert.doesNotMatch(result.stdout + result.stderr, /Recovery command: aco pack uninstall/);
      assert.doesNotMatch(result.stdout + result.stderr, /missing-aco pack uninstall/);
    } finally {
      await rm(workspace, { recursive: true, force: true });
      await rm(emptyBinDir, { recursive: true, force: true });
    }
  });

  it('stops pack setup before template writes when sync preflight finds a fatal conflict', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'aco-pack-sync-conflict-'));
    const binDir = await makeFakeAcoBinary('aco');
    try {
      await setupSyncConflictWorkspace(workspace);

      const result = await runCli(['pack', 'setup'], {
        cwd: workspace,
        env: {
          HOME: await mkdtemp(join(tmpdir(), 'aco-pack-sync-home-')),
          USERPROFILE: await mkdtemp(join(tmpdir(), 'aco-pack-sync-profile-')),
          PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}`,
        },
      });

      assert.equal(result.code, 1);
      assert.match(result.stdout + result.stderr, /Sync conflict|Sync check failed/);
      assert.equal(existsSync(join(workspace, '.claude', 'commands', 'aco.md')), false);
      assert.equal(existsSync(join(workspace, '.claude', 'aco', 'prompts')), false);
      assert.equal(existsSync(join(workspace, '.claude', 'aco', 'tasks')), false);
    } finally {
      await rm(workspace, { recursive: true, force: true });
      await rm(binDir, { recursive: true, force: true });
    }
  });

  it('continues pack setup for no-source workspaces and update-only drift', async () => {
    const binDir = await makeFakeAcoBinary('aco');
    const noSourceWorkspace = await mkdtemp(join(tmpdir(), 'aco-pack-no-source-'));
    const driftWorkspace = await mkdtemp(join(tmpdir(), 'aco-pack-stale-sync-'));
    try {
      const noSource = await runCli(['pack', 'setup'], {
        cwd: noSourceWorkspace,
        env: {
          HOME: await mkdtemp(join(tmpdir(), 'aco-pack-no-source-home-')),
          USERPROFILE: await mkdtemp(join(tmpdir(), 'aco-pack-no-source-profile-')),
          PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}`,
        },
      });
      assert.equal(noSource.code, 0, noSource.stdout + noSource.stderr);
      assert.equal(
        existsSync(join(noSourceWorkspace, '.claude', 'aco', 'tasks', 'review.md')),
        true
      );

      await writeFile(join(driftWorkspace, 'CLAUDE.md'), '# Original\n');
      await runSync(driftWorkspace, { dryRun: false });
      await writeFile(join(driftWorkspace, 'CLAUDE.md'), '# Updated\n');

      const drift = await runCli(['pack', 'setup'], {
        cwd: driftWorkspace,
        env: {
          HOME: await mkdtemp(join(tmpdir(), 'aco-pack-drift-home-')),
          USERPROFILE: await mkdtemp(join(tmpdir(), 'aco-pack-drift-profile-')),
          PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}`,
        },
      });
      assert.equal(drift.code, 0, drift.stdout + drift.stderr);
      assert.equal(existsSync(join(driftWorkspace, '.claude', 'aco', 'tasks', 'review.md')), true);
      assert.doesNotMatch(drift.stdout + drift.stderr, /Sync conflict/);
    } finally {
      await rm(noSourceWorkspace, { recursive: true, force: true });
      await rm(driftWorkspace, { recursive: true, force: true });
      await rm(binDir, { recursive: true, force: true });
    }
  });

  it('installs skills only under --global into the user-level skills dir', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'aco-pack-skill-global-'));
    const home = await mkdtemp(join(tmpdir(), 'aco-pack-skill-global-home-'));
    const profile = await mkdtemp(join(tmpdir(), 'aco-pack-skill-global-profile-'));
    const binDir = await makeFakeAcoBinary('aco-test-local');
    try {
      const result = await runCli(
        ['pack', 'install', '--global', '--binary-name', 'aco-test-local'],
        {
          cwd: workspace,
          env: {
            HOME: home,
            USERPROFILE: profile,
            PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}`,
          },
        }
      );
      assert.equal(result.code, 0, result.stdout + result.stderr);
      assert.equal(
        existsSync(join(home, '.claude', 'skills', 'aco-delegation', 'SKILL.md')),
        true,
        'expected aco-delegation skill installed to user-level ~/.claude/skills'
      );
      const manifest = JSON.parse(
        await readFile(join(home, '.claude', 'aco', 'aco-manifest.json'), 'utf8')
      ) as { files?: string[] };
      assert.ok(
        (manifest.files ?? []).some((f) => f.includes(join('skills', 'aco-delegation'))),
        'manifest must record installed skill files'
      );
    } finally {
      await rm(workspace, { recursive: true, force: true });
      await rm(home, { recursive: true, force: true });
      await rm(profile, { recursive: true, force: true });
      await rm(binDir, { recursive: true, force: true });
    }
  });

  it('does not write skills into the sync source on non-global install', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'aco-pack-skill-local-'));
    const home = await mkdtemp(join(tmpdir(), 'aco-pack-skill-local-home-'));
    const profile = await mkdtemp(join(tmpdir(), 'aco-pack-skill-local-profile-'));
    const binDir = await makeFakeAcoBinary('aco-test-local');
    try {
      const result = await runCli(['pack', 'install', '--binary-name', 'aco-test-local'], {
        cwd: workspace,
        env: {
          HOME: home,
          USERPROFILE: profile,
          PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}`,
        },
      });
      assert.equal(result.code, 0, result.stdout + result.stderr);
      // Commands still install non-globally; skills must not (sync source guard).
      assert.equal(existsSync(join(workspace, '.claude', 'commands', 'aco.md')), true);
      assert.equal(existsSync(join(workspace, '.claude', 'skills')), false);
    } finally {
      await rm(workspace, { recursive: true, force: true });
      await rm(home, { recursive: true, force: true });
      await rm(profile, { recursive: true, force: true });
      await rm(binDir, { recursive: true, force: true });
    }
  });

  it('keeps the sync source skills dir intact across non-global pack setup', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'aco-pack-skill-sync-'));
    const home = await mkdtemp(join(tmpdir(), 'aco-pack-skill-sync-home-'));
    const profile = await mkdtemp(join(tmpdir(), 'aco-pack-skill-sync-profile-'));
    const binDir = await makeFakeAcoBinary('aco-test-local');
    const sentinelBody = '---\nname: local-only\n---\nlocal sentinel\n';
    try {
      await writeFile(join(workspace, 'CLAUDE.md'), '# Source context\n');
      await mkdir(join(workspace, '.claude', 'skills', 'local-only'), { recursive: true });
      const sentinel = join(workspace, '.claude', 'skills', 'local-only', 'SKILL.md');
      await writeFile(sentinel, sentinelBody);

      const result = await runCli(['pack', 'setup', '--binary-name', 'aco-test-local'], {
        cwd: workspace,
        env: {
          HOME: home,
          USERPROFILE: profile,
          PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}`,
        },
      });
      assert.equal(result.code, 0, result.stdout + result.stderr);
      // The local sync source skill must be byte-for-byte untouched.
      assert.equal(await readFile(sentinel, 'utf8'), sentinelBody);
      // No template skill may be injected into the sync source.
      assert.equal(existsSync(join(workspace, '.claude', 'skills', 'aco-delegation')), false);
    } finally {
      await rm(workspace, { recursive: true, force: true });
      await rm(home, { recursive: true, force: true });
      await rm(profile, { recursive: true, force: true });
      await rm(binDir, { recursive: true, force: true });
    }
  });

  it('removes installed skills on global uninstall via manifest', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'aco-pack-skill-uninstall-'));
    const home = await mkdtemp(join(tmpdir(), 'aco-pack-skill-uninstall-home-'));
    const profile = await mkdtemp(join(tmpdir(), 'aco-pack-skill-uninstall-profile-'));
    const binDir = await makeFakeAcoBinary('aco-test-local');
    try {
      const env = {
        HOME: home,
        USERPROFILE: profile,
        PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}`,
      };
      const install = await runCli(
        ['pack', 'install', '--global', '--binary-name', 'aco-test-local'],
        { cwd: workspace, env }
      );
      assert.equal(install.code, 0, install.stdout + install.stderr);
      assert.equal(existsSync(join(home, '.claude', 'skills', 'aco-delegation')), true);

      const uninstall = await runCli(['pack', 'uninstall', '--global'], { cwd: workspace, env });
      assert.equal(uninstall.code, 0, uninstall.stdout + uninstall.stderr);
      assert.equal(
        existsSync(join(home, '.claude', 'skills', 'aco-delegation', 'SKILL.md')),
        false,
        'global uninstall must remove manifest-tracked skill files'
      );
    } finally {
      await rm(workspace, { recursive: true, force: true });
      await rm(home, { recursive: true, force: true });
      await rm(profile, { recursive: true, force: true });
      await rm(binDir, { recursive: true, force: true });
    }
  });

  // U1 회귀 테스트: pack install로 배포되는 위임 진입점이 /aco 하나뿐이어야 한다.
  // 제거 대상 커맨드(/antigravity:review, /antigravity:adversarial, /antigravity:rescue,
  // /review, /execute, /research)는 templates/commands/ 에 존재해서는 안 된다.
  // antigravity:setup 은 프로비저닝 전용이라 삭제 대상에서 제외한다.
  it('distributes only /aco as delegation entrypoint — removed commands must not exist in templates', async () => {
    const templatesRoot = resolve(wrapperRoot, '..', '..', 'templates');
    const commandFiles = await listMarkdownFiles(join(templatesRoot, 'commands'));

    const FORBIDDEN_COMMANDS = [
      join('antigravity', 'review.md'),
      join('antigravity', 'adversarial.md'),
      join('antigravity', 'rescue.md'),
      'review.md',
      'execute.md',
      'research.md',
    ];
    const REQUIRED_COMMANDS = ['aco.md'];

    for (const forbidden of FORBIDDEN_COMMANDS) {
      assert.equal(
        commandFiles.includes(forbidden),
        false,
        `templates/commands/${forbidden} must be removed (delegation entrypoint is /aco only)`
      );
    }

    for (const required of REQUIRED_COMMANDS) {
      assert.equal(
        commandFiles.includes(required),
        true,
        `templates/commands/${required} must remain (single delegation entrypoint)`
      );
    }

    // antigravity:setup 은 프로비저닝 커맨드이므로 유지되어야 한다.
    assert.equal(
      commandFiles.includes(join('antigravity', 'setup.md')),
      true,
      'templates/commands/antigravity/setup.md must be kept (provisioning, not delegation)'
    );
  });

  // U2 패리티 테스트: .claude/commands/aco.md와 templates/commands/aco.md는
  // byte-for-byte 일치해야 한다 (CLAUDE.md Maintenance Rules: "byte-for-byte aligned").
  it('templates/commands/aco.md is byte-for-byte identical to .claude/commands/aco.md', async () => {
    const repoRoot = resolve(wrapperRoot, '..', '..');
    const source = await readFile(join(repoRoot, '.claude', 'commands', 'aco.md'), 'utf8');
    const template = await readFile(join(repoRoot, 'templates', 'commands', 'aco.md'), 'utf8');
    assert.equal(
      template,
      source,
      'templates/commands/aco.md must be byte-for-byte identical to .claude/commands/aco.md'
    );
  });
});
