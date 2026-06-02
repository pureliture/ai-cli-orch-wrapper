import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverSources } from '../src/sync/source-discovery.js';
import {
  readManifest,
  readManifestForLegacyCleanup,
  writeManifest,
  calculateDrift,
  migrateManifest,
} from '../src/sync/manifest.js';
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
      assert.equal(manifest.version, '5', 'Expected version "5" after migration');

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
      assert.equal(manifest.version, '5');
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
      assert.equal(manifest.version, '5');

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
      // GEMINI.md is dropped in the v4→v5 migration step (aco-owned)
      assert.equal(
        manifest.targetHashes['GEMINI.md'],
        undefined,
        'GEMINI.md must be removed during v4→v5 migration'
      );
      assert.ok(manifest.targets['AGENTS.md'], 'Expected AGENTS.md relative key in targets');
      assert.equal(manifest.targets['GEMINI.md'], undefined, 'GEMINI.md must be removed from targets');
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

      // 2. Run a full sync in rootA: produces sync outputs (AGENTS.md only, no GEMINI.md)
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

      // Sanity check: GEMINI.md should not be in targets (Phase 2 requirement)
      assert.equal('GEMINI.md' in manifestObj.targets, false, 'GEMINI.md must not be in manifest targets');

      // 3. Run a full sync in rootB too, so rootB has the same generated output
      //    files (AGENTS.md only) on disk, then replace rootB's manifest with
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

// ---------------------------------------------------------------------------
// Phase 2 (Task 3): v4 → v5 manifest migration
// ---------------------------------------------------------------------------

describe('manifest migration: v4 → v5 (drop GEMINI.md and .gemini/agents/*)', () => {
  it('migrateManifest drops GEMINI.md and .gemini/agents/* from targets/targetHashes', () => {
    const rootPath = '/fake/root';
    const v4Manifest = {
      version: '4',
      generatedAt: '2025-01-01T00:00:00.000Z',
      sourceHashes: { 'CLAUDE.md': 'abc123' },
      targetHashes: {
        'AGENTS.md': 'hash-agents',
        'GEMINI.md': 'hash-gemini',
        '.gemini/agents/helper.md': 'hash-gemini-agent',
        '.codex/agents/helper.toml': 'hash-codex-agent',
      },
      targets: {
        'AGENTS.md': { hash: 'hash-agents', owner: 'aco', kind: 'config' },
        'GEMINI.md': { hash: 'hash-gemini', owner: 'aco', kind: 'config' },
        '.gemini/agents/helper.md': { hash: 'hash-gemini-agent', owner: 'aco', kind: 'agent' },
        '.codex/agents/helper.toml': { hash: 'hash-codex-agent', owner: 'aco', kind: 'agent' },
      },
      skipped: [],
      warnings: [],
    };

    const migrated = migrateManifest(v4Manifest, rootPath);

    // Version must be '5'
    assert.equal(migrated.version, '5', 'migrated manifest version must be "5"');

    // GEMINI.md must be removed from targets and targetHashes
    assert.equal('GEMINI.md' in migrated.targets, false, 'GEMINI.md must be dropped from targets');
    assert.equal('GEMINI.md' in migrated.targetHashes, false, 'GEMINI.md must be dropped from targetHashes');

    // .gemini/agents/* must be removed from targets and targetHashes
    assert.equal('.gemini/agents/helper.md' in migrated.targets, false, '.gemini/agents/helper.md must be dropped from targets');
    assert.equal('.gemini/agents/helper.md' in migrated.targetHashes, false, '.gemini/agents/helper.md must be dropped from targetHashes');

    // AGENTS.md and codex surfaces must be preserved
    assert.ok('AGENTS.md' in migrated.targets, 'AGENTS.md must be preserved in targets');
    assert.ok('.codex/agents/helper.toml' in migrated.targets, '.codex/agents/helper.toml must be preserved');

    // sourceHashes must be preserved
    assert.equal(migrated.sourceHashes['CLAUDE.md'], 'abc123', 'sourceHashes must be preserved');
  });

  it('migrateManifest v4→v5 only removes aco-owned gemini targets (not external)', () => {
    const rootPath = '/fake/root';
    const v4Manifest = {
      version: '4',
      generatedAt: '2025-01-01T00:00:00.000Z',
      sourceHashes: {},
      targetHashes: {
        'GEMINI.md': 'hash-gemini-aco',
        '.gemini/agents/external.md': 'hash-ext',
      },
      targets: {
        'GEMINI.md': { hash: 'hash-gemini-aco', owner: 'aco', kind: 'config' },
        '.gemini/agents/external.md': { hash: 'hash-ext', owner: 'external', kind: 'agent' },
      },
      skipped: [],
      warnings: [],
    };

    const migrated = migrateManifest(v4Manifest, rootPath);

    // aco-owned GEMINI.md must be removed
    assert.equal('GEMINI.md' in migrated.targets, false, 'aco-owned GEMINI.md must be dropped');

    // external-owned .gemini/agents/* must be preserved (not aco's to remove)
    assert.ok('.gemini/agents/external.md' in migrated.targets, 'external-owned .gemini/agents/* must be preserved');
  });

  it('readManifest returns version "5" after reading a v4 manifest file', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'aco-v4tov5-'));
    try {
      await mkdir(join(rootPath, '.aco'), { recursive: true });

      const v4ManifestOnDisk = {
        version: '4',
        generatedAt: '2025-01-01T00:00:00.000Z',
        sourceHashes: { 'CLAUDE.md': 'abc123' },
        targetHashes: {
          'AGENTS.md': 'hash-agents',
          'GEMINI.md': 'hash-gemini',
          '.gemini/agents/helper.md': 'hash-helper',
        },
        targets: {
          'AGENTS.md': { hash: 'hash-agents', owner: 'aco', kind: 'config' },
          'GEMINI.md': { hash: 'hash-gemini', owner: 'aco', kind: 'config' },
          '.gemini/agents/helper.md': { hash: 'hash-helper', owner: 'aco', kind: 'agent' },
        },
        skipped: [],
        warnings: [],
      };

      await writeFile(
        join(rootPath, '.aco', 'sync-manifest.json'),
        JSON.stringify(v4ManifestOnDisk)
      );

      const manifest = await readManifest(rootPath);
      assert.ok(manifest, 'manifest must be read');
      assert.equal(manifest.version, '5', 'readManifest must return version "5" after migration');
      assert.equal('GEMINI.md' in manifest.targets, false, 'GEMINI.md must be removed after migration');
      assert.equal('.gemini/agents/helper.md' in manifest.targets, false, '.gemini/agents/*.md must be removed');
      assert.ok('AGENTS.md' in manifest.targets, 'AGENTS.md must be preserved');
    } finally {
      await rm(rootPath, { recursive: true, force: true });
    }
  });

  it('readManifestForLegacyCleanup preserves legacy Gemini targets (pre-v5 view)', async () => {
    const rootPath = await mkdtemp(join(tmpdir(), 'aco-pre-v5-'));
    try {
      await mkdir(join(rootPath, '.aco'), { recursive: true });

      const v4ManifestOnDisk = {
        version: '4',
        generatedAt: '2025-01-01T00:00:00.000Z',
        sourceHashes: { 'CLAUDE.md': 'abc123' },
        targetHashes: {
          'AGENTS.md': 'hash-agents',
          'GEMINI.md': 'hash-gemini',
          '.gemini/agents/helper.md': 'hash-helper',
        },
        targets: {
          'AGENTS.md': { hash: 'hash-agents', owner: 'aco', kind: 'config' },
          'GEMINI.md': { hash: 'hash-gemini', owner: 'aco', kind: 'config' },
          '.gemini/agents/helper.md': { hash: 'hash-helper', owner: 'aco', kind: 'agent' },
        },
        skipped: [],
        warnings: [],
      };

      await writeFile(
        join(rootPath, '.aco', 'sync-manifest.json'),
        JSON.stringify(v4ManifestOnDisk)
      );

      const manifest = await readManifestForLegacyCleanup(rootPath);
      assert.ok(manifest, 'manifest must be read');
      // Pre-v5 view: legacy Gemini entries are still present so the engine can plan
      // their on-disk removal before the v5 migration strips them.
      assert.equal(manifest.version, '4', 'pre-v5 view must report version "4"');
      assert.ok('GEMINI.md' in manifest.targets, 'GEMINI.md must be preserved in pre-v5 view');
      assert.ok(
        '.gemini/agents/helper.md' in manifest.targets,
        '.gemini/agents/*.md must be preserved in pre-v5 view'
      );
      assert.ok('AGENTS.md' in manifest.targets, 'AGENTS.md must be preserved');
    } finally {
      await rm(rootPath, { recursive: true, force: true });
    }
  });
});
