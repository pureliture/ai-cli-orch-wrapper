import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverSources } from '../src/sync/source-discovery.js';
import { readManifest, writeManifest, calculateDrift } from '../src/sync/manifest.js';
import { runSync } from '../src/sync/sync-engine.js';
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
      assert.equal(manifest.version, '4', 'Expected version "4" after migration');

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
      assert.equal(manifest.version, '4');
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
      assert.equal(manifest.version, '4');

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

// ---------------------------------------------------------------------------
// 4.5  manifest: targetHashes/targets key migration — absolute → relative
// ---------------------------------------------------------------------------

describe('manifest migration: targetHashes/targets absolute → relative', () => {
  it('migrates absolute targetHashes keys to relative on read', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'aco-tgt-mig-'));
    try {
      await mkdir(join(rootPath, '.aco'), { recursive: true });

      const absoluteAgentsMd = `${rootPath}/AGENTS.md`;
      const absoluteGeminiMd = `${rootPath}/GEMINI.md`;

      const legacyManifest = {
        version: '3',
        generatedAt: '2025-01-01T00:00:00.000Z',
        sourceHashes: { 'CLAUDE.md': 'abc123' },
        targetHashes: {
          [absoluteAgentsMd]: 'hash-agents',
          [absoluteGeminiMd]: 'hash-gemini',
        },
        targets: {
          [absoluteAgentsMd]: { hash: 'hash-agents', owner: 'aco', kind: 'config' },
          [absoluteGeminiMd]: { hash: 'hash-gemini', owner: 'aco', kind: 'config' },
        },
        skipped: [],
        warnings: [],
      };

      await writeFile(
        join(rootPath, '.aco', 'sync-manifest.json'),
        JSON.stringify(legacyManifest)
      );

      const manifest = await readManifest(rootPath);
      assert.ok(manifest, 'Expected manifest to be read');

      // All targetHashes keys must be relative (no leading /)
      for (const key of Object.keys(manifest.targetHashes)) {
        assert.ok(!key.startsWith('/'), `targetHashes key must be relative, got: "${key}"`);
      }
      // All targets keys must be relative
      for (const key of Object.keys(manifest.targets)) {
        assert.ok(!key.startsWith('/'), `targets key must be relative, got: "${key}"`);
      }

      assert.equal(
        manifest.targetHashes['AGENTS.md'],
        'hash-agents',
        'Expected AGENTS.md relative key in targetHashes'
      );
      assert.equal(
        manifest.targetHashes['GEMINI.md'],
        'hash-gemini',
        'Expected GEMINI.md relative key in targetHashes'
      );
      assert.ok(manifest.targets['AGENTS.md'], 'Expected AGENTS.md relative key in targets');
      assert.ok(manifest.targets['GEMINI.md'], 'Expected GEMINI.md relative key in targets');
      assert.equal(manifest.targets['AGENTS.md'].hash, 'hash-agents');
    } finally {
      await rm(rootPath, { recursive: true, force: true });
    }
  });

  it('already-relative targetHashes/targets keys pass through unchanged', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'aco-tgt-rel-'));
    try {
      await mkdir(join(rootPath, '.aco'), { recursive: true });

      const legacyManifest = {
        version: '3',
        generatedAt: '2025-01-01T00:00:00.000Z',
        sourceHashes: { 'CLAUDE.md': 'abc123' },
        targetHashes: {
          'AGENTS.md': 'hash-agents',
        },
        targets: {
          'AGENTS.md': { hash: 'hash-agents', owner: 'aco', kind: 'config' },
        },
        skipped: [],
        warnings: [],
      };

      await writeFile(
        join(rootPath, '.aco', 'sync-manifest.json'),
        JSON.stringify(legacyManifest)
      );

      const manifest = await readManifest(rootPath);
      assert.ok(manifest);
      assert.equal(manifest.targetHashes['AGENTS.md'], 'hash-agents');
      assert.ok(manifest.targets['AGENTS.md']);
    } finally {
      await rm(rootPath, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// 4.6  sync-engine: cross-checkout -- no false drift in aco sync --check
// ---------------------------------------------------------------------------

describe('runSync: portable target keys across checkout locations', () => {
  it('aco sync --check returns no drift when the manifest is written in one checkout and checked in another', async () => {
    // Two independent checkout locations with identical source content.
    const rootA = await realpath(await mkdtemp(join(tmpdir(), 'aco-xchk-a-')));
    const rootB = await realpath(await mkdtemp(join(tmpdir(), 'aco-xchk-b-')));
    try {
      // 1. Set up the same source tree in both checkouts.
      const claudeContent = '# shared context\n\nSome shared rules.';
      for (const root of [rootA, rootB]) {
        await writeFile(join(root, 'CLAUDE.md'), claudeContent);
      }

      // 2. Run a full sync in rootA: produces sync outputs (AGENTS.md/GEMINI.md)
      //    and a manifest with repo-relative target keys.
      await runSync(rootA, { dryRun: false });

      const manifestRaw = await readFile(join(rootA, '.aco', 'sync-manifest.json'), 'utf-8');
      const manifestObj = JSON.parse(manifestRaw) as SyncManifest;

      // Sanity check: the manifest rootA wrote uses relative target keys (spec scenario 1).
      for (const key of Object.keys(manifestObj.targetHashes)) {
        assert.ok(!key.startsWith('/'), `targetHashes key must be relative after sync, got: "${key}"`);
      }
      for (const key of Object.keys(manifestObj.targets)) {
        assert.ok(!key.startsWith('/'), `targets key must be relative after sync, got: "${key}"`);
      }

      // 3. Run a full sync in rootB too, so rootB has the same generated output
      //    files (AGENTS.md/GEMINI.md) on disk, then replace rootB's manifest with
      //    the one rootA wrote. This is the actual cross-checkout scenario: a
      //    manifest produced at one absolute path is consumed at a different one.
      await runSync(rootB, { dryRun: false });
      await writeFile(join(rootB, '.aco', 'sync-manifest.json'), manifestRaw);

      // 4. aco sync --check in rootB against rootA's manifest.
      //    runSync throws on drift/conflict in check mode and resolves otherwise,
      //    so a non-rejecting call means "no drift" (exit 0 equivalent).
      //    With absolute target keys this would mismatch rootB's disk paths and
      //    report false-positive drift.
      await assert.doesNotReject(
        runSync(rootB, { check: true }),
        'aco sync --check must not detect drift for a manifest written in a different checkout'
      );
    } finally {
      await rm(rootA, { recursive: true, force: true });
      await rm(rootB, { recursive: true, force: true });
    }
  });
});
