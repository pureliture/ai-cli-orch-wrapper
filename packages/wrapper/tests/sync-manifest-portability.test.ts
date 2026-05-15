import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverSources } from '../src/sync/source-discovery.js';
import { readManifest, writeManifest, calculateDrift } from '../src/sync/manifest.js';
import type { SyncManifest } from '../src/sync/transform-interface.js';

// ---------------------------------------------------------------------------
// 4.1  source-discovery: SyncSource.path is repo-relative
// ---------------------------------------------------------------------------

describe('source-discovery: repo-relative paths', () => {
  it('returns relative paths for discovered sources', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'aco-src-test-'));
    try {
      await writeFile(join(rootPath, 'CLAUDE.md'), '# test');
      await mkdir(join(rootPath, '.claude/rules'), { recursive: true });
      await writeFile(join(rootPath, '.claude/rules', 'core.md'), '## rule');

      const sources = await discoverSources(rootPath);
      for (const s of sources) {
        assert.ok(
          !s.path.startsWith('/'),
          `Expected repo-relative path, got absolute: "${s.path}"`
        );
        assert.ok(
          !s.path.startsWith(rootPath),
          `Expected repo-relative path, got absolute: "${s.path}"`
        );
      }

      const paths = sources.map((s) => s.path);
      assert.ok(paths.includes('CLAUDE.md'), `Expected "CLAUDE.md" in paths, got: ${JSON.stringify(paths)}`);
      assert.ok(
        paths.includes('.claude/rules/core.md'),
        `Expected ".claude/rules/core.md" in paths, got: ${JSON.stringify(paths)}`
      );
    } finally {
      await rm(rootPath, { recursive: true, force: true });
    }
  });

  it('path is stable regardless of rootPath location', async () => {
    const rootA = await mkdtemp(join(tmpdir(), 'aco-root-a-'));
    const rootB = await mkdtemp(join(tmpdir(), 'aco-root-b-'));
    try {
      await writeFile(join(rootA, 'CLAUDE.md'), '# shared');
      await writeFile(join(rootB, 'CLAUDE.md'), '# shared');

      const sourcesA = await discoverSources(rootA);
      const sourcesB = await discoverSources(rootB);

      const pathsA = sourcesA.map((s) => s.path).sort();
      const pathsB = sourcesB.map((s) => s.path).sort();
      assert.deepEqual(pathsA, pathsB, 'Source paths should be identical across different rootPaths');
    } finally {
      await rm(rootA, { recursive: true, force: true });
      await rm(rootB, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// 4.2  manifest: v2 absolute-path → v3 relative-path migration
// ---------------------------------------------------------------------------

describe('manifest migration: v2 absolute → v3 relative', () => {
  it('migrates absolute sourceHashes keys to relative on read', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'aco-mig-test-'));
    try {
      await mkdir(join(rootPath, '.aco'), { recursive: true });

      const v2Manifest = {
        version: '2',
        generatedAt: '2025-01-01T00:00:00.000Z',
        sourceHashes: {
          [`${rootPath}/CLAUDE.md`]: 'abc123',
          [`${rootPath}/.claude/rules/core.md`]: 'def456',
        },
        targetHashes: {},
        targets: { 'AGENTS.md': { hash: 'xyz', owner: 'aco', kind: 'config' } },
        skipped: [],
        warnings: [],
      };

      await writeFile(
        join(rootPath, '.aco', 'sync-manifest.json'),
        JSON.stringify(v2Manifest)
      );

      const manifest = await readManifest(rootPath);
      assert.ok(manifest, 'Expected manifest to be read');
      assert.equal(manifest.version, '3', 'Expected version "3" after migration');

      const keys = Object.keys(manifest.sourceHashes);
      for (const key of keys) {
        assert.ok(!key.startsWith('/'), `Expected relative key after migration, got: "${key}"`);
      }
      assert.ok(
        manifest.sourceHashes['CLAUDE.md'] === 'abc123',
        `Expected "CLAUDE.md" key, got: ${JSON.stringify(keys)}`
      );
      assert.ok(
        manifest.sourceHashes['.claude/rules/core.md'] === 'def456',
        `Expected ".claude/rules/core.md" key, got: ${JSON.stringify(keys)}`
      );
    } finally {
      await rm(rootPath, { recursive: true, force: true });
    }
  });

  it('already-relative keys pass through migration unchanged', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'aco-mig-rel-'));
    try {
      await mkdir(join(rootPath, '.aco'), { recursive: true });

      const v2Manifest = {
        version: '2',
        generatedAt: '2025-01-01T00:00:00.000Z',
        sourceHashes: {
          'CLAUDE.md': 'abc123',
        },
        targetHashes: {},
        targets: {},
        skipped: [],
        warnings: [],
      };

      await writeFile(
        join(rootPath, '.aco', 'sync-manifest.json'),
        JSON.stringify(v2Manifest)
      );

      const manifest = await readManifest(rootPath);
      assert.ok(manifest);
      assert.equal(manifest.version, '3');
      assert.equal(manifest.sourceHashes['CLAUDE.md'], 'abc123');
    } finally {
      await rm(rootPath, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// 4.3  manifest: path outside repo root → warning, not migrated
// ---------------------------------------------------------------------------

describe('manifest migration: outside-root path handling', () => {
  it('skips absolute keys outside repo root and adds warning', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'aco-outside-'));
    try {
      await mkdir(join(rootPath, '.aco'), { recursive: true });

      const outsidePath = '/etc/secret/credentials.json';
      const v2Manifest = {
        version: '2',
        generatedAt: '2025-01-01T00:00:00.000Z',
        sourceHashes: {
          [`${rootPath}/CLAUDE.md`]: 'abc123',
          [outsidePath]: 'danger',
        },
        targetHashes: {},
        targets: {},
        skipped: [],
        warnings: [],
      };

      await writeFile(
        join(rootPath, '.aco', 'sync-manifest.json'),
        JSON.stringify(v2Manifest)
      );

      const manifest = await readManifest(rootPath);
      assert.ok(manifest);
      assert.equal(manifest.version, '3');

      const keys = Object.keys(manifest.sourceHashes);
      assert.ok(
        !keys.includes(outsidePath),
        `Outside-root key should have been removed, but found: ${JSON.stringify(keys)}`
      );
      assert.ok(
        manifest.warnings.some((w) => w.message.includes(outsidePath)),
        `Expected warning mentioning outside path, warnings: ${JSON.stringify(manifest.warnings)}`
      );
    } finally {
      await rm(rootPath, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// 4.4  calculateDrift: relocated checkout produces no false drift
// ---------------------------------------------------------------------------

describe('calculateDrift: portable across relocated checkouts', () => {
  it('returns false drift when same files in different rootPath produce same relative manifest', async () => {
    const rootA = await mkdtemp(join(tmpdir(), 'aco-drift-a-'));
    const rootB = await mkdtemp(join(tmpdir(), 'aco-drift-b-'));
    try {
      const content = '# hello world';
      await writeFile(join(rootA, 'CLAUDE.md'), content);
      await writeFile(join(rootB, 'CLAUDE.md'), content);

      const sourcesA = await discoverSources(rootA);
      const sourcesB = await discoverSources(rootB);

      const hashesA: Record<string, string> = {};
      for (const s of sourcesA) hashesA[s.path] = s.hash;

      const hashesB: Record<string, string> = {};
      for (const s of sourcesB) hashesB[s.path] = s.hash;

      const manifestA: SyncManifest = {
        version: '3',
        generatedAt: new Date().toISOString(),
        sourceHashes: hashesA,
        targetHashes: {},
        targets: {},
        skipped: [],
        warnings: [],
      };
      const manifestB: SyncManifest = {
        version: '3',
        generatedAt: new Date().toISOString(),
        sourceHashes: hashesB,
        targetHashes: {},
        targets: {},
        skipped: [],
        warnings: [],
      };

      const drift = calculateDrift(manifestA, manifestB);
      assert.equal(drift, false, 'Same content in different checkouts should not drift');
    } finally {
      await rm(rootA, { recursive: true, force: true });
      await rm(rootB, { recursive: true, force: true });
    }
  });

  it('returns true drift when file content differs', async () => {
    const root = await mkdtemp(join(tmpdir(), 'aco-drift-diff-'));
    try {
      const manifestA: SyncManifest = {
        version: '3',
        generatedAt: new Date().toISOString(),
        sourceHashes: { 'CLAUDE.md': 'hash-v1' },
        targetHashes: {},
        targets: {},
        skipped: [],
        warnings: [],
      };
      const manifestB: SyncManifest = {
        version: '3',
        generatedAt: new Date().toISOString(),
        sourceHashes: { 'CLAUDE.md': 'hash-v2' },
        targetHashes: {},
        targets: {},
        skipped: [],
        warnings: [],
      };

      const drift = calculateDrift(manifestA, manifestB);
      assert.equal(drift, true, 'Different content hashes should trigger drift');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
