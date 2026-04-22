import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runSync } from '../src/sync/sync-engine.js';
import { computeHash } from '../src/sync/hash.js';
import type { SyncManifest } from '../src/sync/transform-interface.js';

async function setupConflictScenario(tmpDir: string, agentId: string = 'test-agent') {
  await mkdir(join(tmpDir, '.claude', 'agents'), { recursive: true });
  await writeFile(join(tmpDir, 'CLAUDE.md'), 'test');
  const agentContent = `---\nid: ${agentId}\n---`;
  await writeFile(join(tmpDir, '.claude', 'agents', `${agentId}.md`), agentContent);

  // Create existing target and manifest to simulate previous sync
  await mkdir(join(tmpDir, '.codex', 'agents'), { recursive: true });
  const targetPath = join(tmpDir, '.codex', 'agents', `${agentId}.toml`);
  const originalTargetContent = `name = "${agentId}"`;
  await writeFile(targetPath, originalTargetContent, 'utf-8');

  const manifestPath = join(tmpDir, '.aco');
  await mkdir(manifestPath, { recursive: true });
  const manifest: SyncManifest = {
    version: '1',
    generatedAt: new Date().toISOString(),
    sourceHashes: {},
    targetHashes: {
      [targetPath]: computeHash(originalTargetContent),
    },
    warnings: [],
  };
  await writeFile(join(manifestPath, 'sync-manifest.json'), JSON.stringify(manifest));

  // Manually edit the target to create drift
  const editedContent = `name = "edited-${agentId}"`;
  await writeFile(targetPath, editedContent, 'utf-8');

  return { targetPath, originalTargetContent, editedContent };
}

describe('runSync Conflict Detection & Resolution', () => {
  it('detects conflict and throws before overwriting (Task 1.1, 1.2)', async () => {
    const tmpDir = await realpath(await mkdtemp(join(tmpdir(), 'aco-test-sync-conflict-')));
    try {
      const { targetPath, editedContent } = await setupConflictScenario(tmpDir);

      // Assert normal runSync detects conflict and throws
      await assert.rejects(
        runSync(tmpDir, { dryRun: false }),
        /Sync conflicts detected:.*test-agent.toml/
      );

      // Verify the file was NOT overwritten
      const finalContent = await readFile(targetPath, 'utf-8');
      assert.equal(finalContent, editedContent);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('check mode detects same conflict and exits without writing (Task 1.3)', async () => {
    const tmpDir = await realpath(await mkdtemp(join(tmpdir(), 'aco-test-sync-check-conflict-')));
    try {
      const { targetPath, editedContent } = await setupConflictScenario(tmpDir);

      // Assert check mode detects conflict and throws
      await assert.rejects(
        runSync(tmpDir, { check: true }),
        /Sync check failed\.[\s\S]*Conflicts:.*test-agent.toml/
      );

      // Verify the file was NOT overwritten
      const finalContent = await readFile(targetPath, 'utf-8');
      assert.equal(finalContent, editedContent);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('resolves conflict when --force is used (New Requirement)', async () => {
    const tmpDir = await realpath(await mkdtemp(join(tmpdir(), 'aco-test-sync-force-conflict-')));
    try {
      const { targetPath, editedContent } = await setupConflictScenario(tmpDir);

      // Assert normal runSync detects conflict and throws
      await assert.rejects(runSync(tmpDir), /Sync conflicts detected/);

      // Run with force
      const result = await runSync(tmpDir, { force: true });
      
      assert.equal(result.conflicts, 1);

      // Verify the file WAS overwritten
      const finalContent = await readFile(targetPath, 'utf-8');
      assert.notEqual(finalContent, editedContent);
      assert.ok(finalContent.includes('name = "test-agent"'));

      // Verify manifest was updated with new hash
      const manifestPath = join(tmpDir, '.aco', 'sync-manifest.json');
      const manifestRaw = await readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestRaw) as SyncManifest;
      assert.equal(manifest.targetHashes[targetPath], computeHash(finalContent));
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('missing manifest-owned targets are recreated instead of marked as conflicts (Task 1.4)', async () => {
    const tmpDir = await realpath(await mkdtemp(join(tmpdir(), 'aco-test-sync-missing-')));
    try {
      await mkdir(join(tmpDir, '.claude', 'agents'), { recursive: true });
      await writeFile(join(tmpDir, 'CLAUDE.md'), 'test');
      const agentContent = `---\nid: test-agent\n---`;
      await writeFile(join(tmpDir, '.claude', 'agents', 'test-agent.md'), agentContent);

      const targetPath = join(tmpDir, '.codex', 'agents', 'test-agent.toml');

      const manifestPath = join(tmpDir, '.aco');
      await mkdir(manifestPath, { recursive: true });
      const manifest: SyncManifest = {
        version: '1',
        generatedAt: new Date().toISOString(),
        sourceHashes: {},
        targetHashes: {
          [targetPath]: 'some-hash-that-doesn-not-matter',
        },
        warnings: [],
      };
      await writeFile(join(manifestPath, 'sync-manifest.json'), JSON.stringify(manifest));

      // Note: we do NOT create the target file on disk, so it's missing.
      
      const result = await runSync(tmpDir, { dryRun: false });
      
      // Should not conflict, should create or update it
      assert.equal(result.conflicts, 0);
      assert.equal(result.outputs.some(o => o.action === 'created' || o.action === 'updated'), true);
      
      // Verify it was recreated
      const finalContent = await readFile(targetPath, 'utf-8');
      assert.ok(finalContent.includes('name = "test-agent"'));
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});
