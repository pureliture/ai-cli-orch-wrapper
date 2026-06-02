import { discoverSources } from './source-discovery.js';
import { aggregateContext } from './context-transform.js';
import { getManagedBlockUpdate } from './managed-block.js';
import { syncSkills } from './skill-transform.js';
import { syncCodexAgents } from './agent-codex-transform.js';
import {
  readManifest,
  readManifestForLegacyCleanup,
  writeManifest,
  calculateDrift,
  isLegacyGeminiTarget,
} from './manifest.js';
import { computeHash } from './hash.js';
import { loadSyncConfig } from './sync-config.js';
import { detectDuplicates } from './duplicate-detector.js';
import { readFile, mkdir, writeFile, cp, rm } from 'node:fs/promises';
import { dirname, join, normalize, relative, isAbsolute } from 'node:path';
import type {
  SyncSource,
  SyncOptions,
  SyncResult,
  SyncOutput,
  SyncWarning,
  SyncManifest,
  TransformPlan,
  ManifestTargetRecord,
  SyncConfig,
} from './transform-interface.js';

interface ErrorWithCode extends Error {
  code?: string;
}

const LEGACY_HOOK_TARGETS = new Set([
  '.codex/hooks.json',
  '.codex/config.toml',
  '.gemini/settings.json',
]);

function isErrorWithCode(err: unknown): err is ErrorWithCode {
  return err instanceof Error && 'code' in err;
}

function isPathWithinRepo(root: string, target: string, allowed: string[]): boolean {
  const normalized = normalize(target);
  for (const prefix of allowed) {
    const normalizedPrefix = normalize(join(root, prefix));
    const rel = relative(normalizedPrefix, normalized);
    if (
      (rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)) ||
      normalized === normalizedPrefix
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Convert an absolute target path to a repo-relative manifest key.
 * Manifest keys are always stored as repo-relative paths (no leading slash).
 */
function toManifestKey(repoRoot: string, absolutePath: string): string {
  return relative(repoRoot, absolutePath);
}

function isLegacyHookTarget(manifestKey: string): boolean {
  return LEGACY_HOOK_TARGETS.has(manifestKey);
}

async function legacyHookCleanupReady(
  targetKey: string,
  targetPath: string,
  expectedHash: string,
  warnings: SyncWarning[]
): Promise<boolean> {
  let diskContent: string;
  try {
    diskContent = await readFile(targetPath, 'utf8');
  } catch (err: unknown) {
    if (isErrorWithCode(err) && err.code === 'ENOENT') return true;
    throw err;
  }

  if (computeHash(diskContent) !== expectedHash) {
    warnings.push({
      source: targetKey,
      message:
        'Stale hook target hash does not match manifest; skipping auto-removal. Review user-level hook setup before deleting.',
      severity: 'warning',
    });
    return false;
  }

  if (targetKey === '.codex/config.toml' && stripCodexManagedHookBlock(diskContent) === null) {
    warnings.push({
      source: targetKey,
      message:
        'Stale Codex hook config does not contain an ACO managed block; skipping auto-removal.',
      severity: 'warning',
    });
    return false;
  }

  if (targetKey === '.gemini/settings.json') {
    try {
      const parsed = JSON.parse(diskContent) as unknown;
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('settings JSON must be an object');
      }
    } catch (err: unknown) {
      const e = err as Error;
      warnings.push({
        source: targetKey,
        message: `Stale Gemini hook settings are not safely editable JSON; skipping auto-removal. ${e.message}`,
        severity: 'warning',
      });
      return false;
    }
  }

  return true;
}

async function planLegacyHookCleanup(
  repoRoot: string,
  existingManifest: SyncManifest | null,
  outputs: SyncOutput[],
  warnings: SyncWarning[]
): Promise<void> {
  if (!existingManifest) return;

  const seen = new Set<string>();
  const records = new Map<string, ManifestTargetRecord>();
  for (const [targetKey, record] of Object.entries(existingManifest.targets ?? {})) {
    records.set(targetKey, record);
  }

  for (const [targetKey, hash] of Object.entries(existingManifest.targetHashes ?? {})) {
    if (!records.has(targetKey)) {
      records.set(targetKey, {
        hash,
        owner: 'aco',
        kind: 'provider-command',
      });
    }
  }

  for (const [targetKey, record] of records) {
    if (seen.has(targetKey) || !isLegacyHookTarget(targetKey)) continue;
    seen.add(targetKey);

    if (record.owner !== 'aco') continue;

    const expectedHash = record.hash ?? existingManifest.targetHashes?.[targetKey];
    if (!expectedHash) continue;

    const targetPath = join(repoRoot, targetKey);
    const canClean = await legacyHookCleanupReady(targetKey, targetPath, expectedHash, warnings);
    if (!canClean) continue;

    outputs.push({
      targetPath,
      kind: 'file',
      action: 'removed',
      hash: expectedHash,
      owner: 'aco',
      assetKind: 'provider-command',
    });
  }
}

/**
 * Plan removal of aco-owned legacy Gemini targets (GEMINI.md and .gemini/agents/*)
 * that were emitted by older sync versions but are no longer produced in v5.
 * Only removes entries where owner is 'aco'; external/unknown-owned entries are left alone.
 */
async function planLegacyGeminiCleanup(
  repoRoot: string,
  existingManifest: SyncManifest | null,
  outputs: SyncOutput[],
  warnings: SyncWarning[]
): Promise<void> {
  if (!existingManifest) return;

  const seen = new Set<string>();
  const records = new Map<string, ManifestTargetRecord>();

  for (const [targetKey, record] of Object.entries(existingManifest.targets ?? {})) {
    records.set(targetKey, record);
  }
  // Fall back to targetHashes for old manifests that pre-date targets
  for (const [targetKey, hash] of Object.entries(existingManifest.targetHashes ?? {})) {
    if (!records.has(targetKey)) {
      records.set(targetKey, { hash, owner: 'aco', kind: 'agent' });
    }
  }

  for (const [targetKey, record] of records) {
    if (seen.has(targetKey) || !isLegacyGeminiTarget(targetKey)) continue;
    seen.add(targetKey);

    // Only auto-remove aco-owned entries
    if (record.owner !== 'aco') continue;

    const targetPath = join(repoRoot, targetKey);

    // Normalize-and-re-derive defense: ensure the manifest key did not contain
    // any `..` traversal that resolves outside its declared repo-relative form.
    // We re-derive the repo-relative key from the joined path and require it to
    // match the original key exactly. This keeps the path-safety check in one
    // place (plan stage) so the execution stage does not depend on a separate
    // isPathWithinRepo guard for legacy Gemini removals.
    if (toManifestKey(repoRoot, targetPath) !== targetKey) {
      warnings.push({
        source: targetKey,
        message:
          'Legacy Gemini target key does not round-trip through repo-relative ' +
          `normalization (possible path traversal); skipping auto-removal: "${targetKey}".`,
        severity: 'warning',
      });
      continue;
    }

    let diskContent: string | undefined;
    try {
      diskContent = await readFile(targetPath, 'utf8');
    } catch (err: unknown) {
      if (isErrorWithCode(err) && err.code === 'ENOENT') {
        // File already gone — still plan a remove so the manifest entry gets cleared
      } else {
        throw err;
      }
    }

    if (diskContent !== undefined) {
      const expectedHash = record.hash ?? existingManifest.targetHashes?.[targetKey];
      if (expectedHash && computeHash(diskContent) !== expectedHash) {
        warnings.push({
          source: targetKey,
          message:
            'Stale Gemini target hash does not match manifest; skipping auto-removal. ' +
            `Review ${targetKey} before deleting.`,
          severity: 'warning',
        });
        continue;
      }
    }

    outputs.push({
      targetPath,
      kind: 'file',
      action: 'removed',
      hash: record.hash,
      owner: 'aco',
      assetKind: 'config',
    });
  }
}

function stripCodexManagedHookBlock(content: string): string | null {
  const begin = '# BEGIN ACO GENERATED';
  const end = '# END ACO GENERATED';
  const beginIdx = content.indexOf(begin);
  const endIdx = content.indexOf(end);
  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) return null;

  const afterEnd = endIdx + end.length;
  const updated = `${content.slice(0, beginIdx)}${content.slice(afterEnd)}`
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
  return updated ? `${updated}\n` : '';
}

async function removeLegacyHookTarget(repoRoot: string, targetPath: string): Promise<boolean> {
  const targetKey = toManifestKey(repoRoot, targetPath);

  if (targetKey === '.codex/config.toml') {
    const content = await readFile(targetPath, 'utf8');
    const updated = stripCodexManagedHookBlock(content);
    if (updated === null) return false;
    if (updated === '') {
      await rm(targetPath, { recursive: true, force: true });
    } else {
      await writeFile(targetPath, updated, 'utf8');
    }
    return true;
  }

  if (targetKey === '.gemini/settings.json') {
    const content = await readFile(targetPath, 'utf8');
    const settings = JSON.parse(content) as Record<string, unknown>;
    delete settings.hooks;
    if (Object.keys(settings).length === 0) {
      await rm(targetPath, { recursive: true, force: true });
    } else {
      await writeFile(targetPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
    }
    return true;
  }

  if (targetKey === '.codex/hooks.json') {
    await rm(targetPath, { recursive: true, force: true });
    return true;
  }

  return false;
}

/**
 * Run the context sync engine.
 *
 * @param repoRoot - The repository root path.
 * @param options - Sync options.
 * @param options.check - When true, performs read-only validation without
 *   writing any files to disk. Throws on drift/conflicts but never mutates.
 * @param options.dryRun - When true, prints what would change without writing.
 * @param options.force - When true, overwrites managed targets even if drift.
 * @param options.strict - When true, fails on duplicate provider warnings.
 * @param options.cleanDuplicates - When true, cleans manifest-owned duplicates.
 * @param options.forceClean - When true, cleans non-manifest-owned duplicates.
 */
export async function runSync(repoRoot: string, options: SyncOptions = {}): Promise<SyncResult> {
  const {
    dryRun = false,
    check = false,
    force = false,
    strict = false,
    cleanDuplicates = false,
    forceClean = false,
  } = options;

  // 1. Load sync config
  const config = await loadSyncConfig(repoRoot);

  // 2. Discover sources
  const sources = await discoverSources(repoRoot);

  if (sources.length === 0) {
    throw new Error(
      'No sync sources found. Ensure CLAUDE.md, .claude/rules/, .claude/agents/, or .claude/skills/ exists.'
    );
  }

  // 3. Read existing manifest (fully migrated) plus a pre-v5 view used only to plan
  //    on-disk cleanup of legacy aco-owned Gemini targets that the v5 migration drops.
  const existingManifest = await readManifest(repoRoot);
  const legacyCleanupManifest = await readManifestForLegacyCleanup(repoRoot);

  // 4. Compute transform plan (pure planning pass)
  const plan = await computeTransformPlan(
    sources,
    repoRoot,
    existingManifest,
    config,
    legacyCleanupManifest
  );

  // 5. Detect duplicates
  const duplicateWarnings = await detectDuplicates(repoRoot, plan.outputs);
  plan.warnings.push(...duplicateWarnings);

  // 6. Detect conflicts for planned outputs against existing manifest
  if (existingManifest) {
    for (const output of plan.outputs) {
      const manifestKey = toManifestKey(repoRoot, output.targetPath);
      const existingRecord = existingManifest.targets[manifestKey];
      const existingHash = existingRecord?.hash ?? existingManifest.targetHashes[manifestKey];
      if (existingHash && (output.kind === 'file' || output.kind === 'managed-block')) {
        try {
          const diskContent = await readFile(output.targetPath, 'utf8');
          const diskHash = computeHash(diskContent);
          if (diskHash !== existingHash) {
            output.action = 'conflict';
          }
        } catch (err: unknown) {
          if (!isErrorWithCode(err) || err.code !== 'ENOENT') {
            throw err;
          }
        }
      }
    }
  }

  // Determine actual actions (created vs updated) for non-conflicts
  for (const output of plan.outputs) {
    if (output.action === 'conflict') continue;
    if (output.action === 'removed') continue;

    const manifestKey = toManifestKey(repoRoot, output.targetPath);
    const existingRecord = existingManifest?.targets[manifestKey];
    const existingHash = existingRecord?.hash ?? existingManifest?.targetHashes[manifestKey];
    if (!existingHash) {
      output.action = 'created';
    } else if (existingHash === output.hash) {
      output.action = 'skipped';
    } else {
      output.action = 'updated';
    }
  }

  // 7. Check mode: verify without writing
  const conflicts = plan.outputs.filter((o) => o.action === 'conflict');
  if (check) {
    const isDrift = calculateDrift(existingManifest, plan.manifest);
    const removedOutputs = plan.outputs.filter((o) => o.action === 'removed');
    const hasDuplicates = duplicateWarnings.length > 0;
    if (isDrift || conflicts.length > 0 || removedOutputs.length > 0 || (strict && hasDuplicates)) {
      const staleOutputs = plan.outputs.filter((o) => o.action === 'updated');
      const messages: string[] = [];
      if (staleOutputs.length > 0) {
        messages.push(`Stale outputs: ${staleOutputs.map((o) => o.targetPath).join(', ')}`);
      }
      if (removedOutputs.length > 0) {
        messages.push(
          `Pending removals (legacy cleanup): ${removedOutputs.map((o) => o.targetPath).join(', ')}`
        );
      }
      if (conflicts.length > 0) {
        messages.push(`Conflicts: ${conflicts.map((o) => o.targetPath).join(', ')}`);
      }
      if (hasDuplicates) {
        messages.push(`Duplicate warnings: ${duplicateWarnings.length}`);
        for (const w of duplicateWarnings) {
          messages.push(`  [${w.severity}] ${w.source}: ${w.message}`);
        }
      }
      if (strict && hasDuplicates) {
        throw new Error(
          `Sync check failed (strict mode promoted duplicates to errors).\n${messages.join('\n')}\nRun 'aco sync' to refresh, or review duplicate warnings above.`
        );
      }
      throw new Error(`Sync check failed.\n${messages.join('\n')}\nRun 'aco sync' to refresh.`);
    }
    return {
      created: 0,
      updated: 0,
      removed: 0,
      skipped: plan.outputs.length,
      conflicts: 0,
      warnings: plan.warnings.length,
      outputs: plan.outputs,
    };
  }

  // 8. Handle conflicts unless --force
  if (conflicts.length > 0 && !force) {
    const conflictPaths = conflicts.map((c) => c.targetPath).join(', ');
    throw new Error(
      `Sync conflicts detected: ${conflictPaths}\n` +
        `Run 'aco sync --check' for details, or 'aco sync --force' to overwrite.`
    );
  }

  // 9. Handle duplicate cleanup if requested
  if (cleanDuplicates) {
    const cleanable = duplicateWarnings.filter((w) => w.severity === 'warning');
    const cleanedOwned: string[] = [];
    const cleanedForced: string[] = [];
    const cleanedPaths = new Set<string>();
    for (const warning of cleanable) {
      const targets = warning.cleanupTargets;
      if (targets && targets.length > 0) {
        for (const targetPath of targets) {
          const targetKey = toManifestKey(repoRoot, targetPath);
          const isOwned = existingManifest?.targets?.[targetKey]?.owner === 'aco';
          if (!dryRun && (isOwned || forceClean)) {
            const allowedDirs = ['.agents/skills', '.codex/skills'];
            if (!isPathWithinRepo(repoRoot, targetPath, allowedDirs)) {
              plan.warnings.push({
                source: relative(repoRoot, targetPath) || targetPath,
                message: `Refusing to delete outside allowed directories: ${targetPath}`,
                severity: 'warning',
              });
              continue;
            }
            try {
              await rm(targetPath, { recursive: true, force: true });
              cleanedPaths.add(normalize(targetPath));
              if (isOwned) {
                cleanedOwned.push(targetPath);
              } else {
                cleanedForced.push(targetPath);
              }
            } catch (err: unknown) {
              const e = err as Error & { code?: string };
              plan.warnings.push({
                source: relative(repoRoot, targetPath) || targetPath,
                message: `Failed to remove ${targetPath}: ${e.message}`,
                severity: 'warning',
              });
            }
          } else if (!dryRun && !isOwned && !forceClean) {
            plan.warnings.push({
              source: relative(repoRoot, targetPath) || targetPath,
              message: `Refused to clean duplicate ${targetPath}: not manifest-owned. Pass --force-clean to override.`,
              severity: 'warning',
            });
          }
        }
      }
    }

    // Remove cleaned paths from plan.manifest.targets
    for (const path of cleanedOwned) {
      const key = toManifestKey(repoRoot, path);
      delete plan.manifest.targetHashes[key];
      delete plan.manifest.targets[key];
    }
    for (const path of cleanedForced) {
      const key = toManifestKey(repoRoot, path);
      delete plan.manifest.targetHashes[key];
      delete plan.manifest.targets[key];
    }
    if (cleanedPaths.size > 0) {
      plan.outputs = plan.outputs.filter(
        (output) => !cleanedPaths.has(normalize(output.targetPath))
      );
    }

    // Record removals in manifest
    if (cleanedOwned.length > 0) {
      plan.warnings.push({
        source: 'sync-engine',
        message: `Cleaned ${cleanedOwned.length} manifest-owned duplicate(s): ${cleanedOwned.join(', ')}`,
        severity: 'warning',
      });
    }
    if (cleanedForced.length > 0) {
      plan.warnings.push({
        source: 'sync-engine',
        message: `Force-cleaned ${cleanedForced.length} non-manifest-owned duplicate(s): ${cleanedForced.join(', ')}`,
        severity: 'warning',
      });
    }
  }

  // 10. Write outputs (execution pass)
  if (!dryRun) {
    for (const output of plan.outputs) {
      if (output.action === 'skipped') continue;

      if (output.action === 'removed') {
        if (isLegacyHookTarget(toManifestKey(repoRoot, output.targetPath))) {
          try {
            const handled = await removeLegacyHookTarget(repoRoot, output.targetPath);
            if (!handled) {
              plan.warnings.push({
                source: relative(repoRoot, output.targetPath) || output.targetPath,
                message: `Failed to remove legacy hook target safely: ${output.targetPath}`,
                severity: 'warning',
              });
            }
          } catch (err: unknown) {
            const e = err as Error & { code?: string };
            if (e.code !== 'ENOENT') {
              plan.warnings.push({
                source: relative(repoRoot, output.targetPath) || output.targetPath,
                message: `Failed to remove legacy hook target ${output.targetPath}: ${e.message}`,
                severity: 'warning',
              });
            }
          }
          continue;
        }

        // Legacy Gemini removals are already path-validated in planLegacyGeminiCleanup
        // (normalize-and-re-derive round-trip check), so they bypass the
        // .agents/skills-only guard below without re-deriving the defense here.
        if (!isLegacyGeminiTarget(toManifestKey(repoRoot, output.targetPath))) {
          const allowedDirs = ['.agents/skills'];
          if (!isPathWithinRepo(repoRoot, output.targetPath, allowedDirs)) {
            plan.warnings.push({
              source: relative(repoRoot, output.targetPath) || output.targetPath,
              message: `Refusing to delete outside allowed directories: ${output.targetPath}`,
              severity: 'warning',
            });
            continue;
          }
        }
        try {
          await rm(output.targetPath, { recursive: true, force: true });
        } catch (err: unknown) {
          const e = err as Error & { code?: string };
          plan.warnings.push({
            source: relative(repoRoot, output.targetPath) || output.targetPath,
            message: `Failed to remove ${output.targetPath}: ${e.message}`,
            severity: 'warning',
          });
        }
        continue;
      }

      // Write/Copy
      if (output.kind === 'file' || output.kind === 'managed-block') {
        if (output.content !== undefined) {
          await mkdir(dirname(output.targetPath), { recursive: true });
          await writeFile(output.targetPath, output.content, 'utf8');
        }
      } else if (output.kind === 'directory' && output.sourcePath) {
        await mkdir(dirname(output.targetPath), { recursive: true });
        if (output.action === 'updated') {
          await rm(output.targetPath, { recursive: true, force: true });
        }
        await cp(output.sourcePath, output.targetPath, { recursive: true, force: true });
      }
    }
    await writeManifest(repoRoot, plan.manifest);
  }

  // 11. Compute result
  return {
    created: plan.outputs.filter((o) => o.action === 'created').length,
    updated: plan.outputs.filter((o) => o.action === 'updated').length,
    removed: plan.outputs.filter((o) => o.action === 'removed').length,
    skipped: plan.outputs.filter((o) => o.action === 'skipped').length,
    conflicts: conflicts.length,
    warnings: plan.warnings.length,
    outputs: plan.outputs,
  };
}

async function computeTransformPlan(
  sources: SyncSource[],
  repoRoot: string,
  existingManifest: SyncManifest | null,
  config: SyncConfig,
  legacyCleanupManifest: SyncManifest | null = existingManifest
): Promise<TransformPlan> {
  const outputs: SyncOutput[] = [];
  const warnings: SyncWarning[] = [];
  const sourceHashes: Record<string, string> = {};
  const targetHashes: Record<string, string> = {};
  const targets: Record<string, ManifestTargetRecord> = {};
  const skipped: SyncManifest['skipped'] = [];

  // Record source hashes
  for (const source of sources) {
    sourceHashes[source.path] = source.hash;
  }

  await planLegacyHookCleanup(repoRoot, existingManifest, outputs, warnings);
  // Use the pre-v5 manifest view: the v5 migration strips legacy aco-owned Gemini
  // entries, so the fully-migrated existingManifest no longer lists the on-disk
  // GEMINI.md / .gemini/agents/* files that still need removal.
  await planLegacyGeminiCleanup(repoRoot, legacyCleanupManifest, outputs, warnings);

  // 1. Context -> AGENTS.md (only; GEMINI.md is retired in Phase 2)
  const contextContent = aggregateContext(sources);
  if (contextContent) {
    const agentsMdPath = `${repoRoot}/AGENTS.md`;

    const updatedAgents = await getManagedBlockUpdate(agentsMdPath, contextContent);
    const agentsHash = computeHash(updatedAgents);
    outputs.push({
      targetPath: agentsMdPath,
      kind: 'managed-block',
      action: 'updated',
      content: updatedAgents,
      hash: agentsHash,
      owner: 'aco',
      assetKind: 'config',
    });
    const agentsMdKey = toManifestKey(repoRoot, agentsMdPath);
    targetHashes[agentsMdKey] = agentsHash;
    targets[agentsMdKey] = { hash: agentsHash, owner: 'aco', kind: 'config' };
  }

  // 2. Skills
  const skillResult = await syncSkills(sources, repoRoot, existingManifest, config);
  outputs.push(...skillResult.outputs);
  warnings.push(...skillResult.warnings);
  skipped.push(...skillResult.skipped);
  for (const o of skillResult.outputs) {
    if (o.hash) {
      const key = toManifestKey(repoRoot, o.targetPath);
      targetHashes[key] = o.hash;
      targets[key] = {
        hash: o.hash,
        owner: o.owner ?? 'aco',
        kind: o.assetKind ?? 'shared-skill',
        source: o.sourcePath,
        hashFormat: o.kind === 'directory' ? 'directory' : undefined,
      };
    }
  }

  // 3. Codex agents
  const codexAgentResult = await syncCodexAgents(sources, repoRoot);
  outputs.push(...codexAgentResult.outputs);
  warnings.push(...codexAgentResult.warnings);
  for (const o of codexAgentResult.outputs) {
    if (o.hash) {
      const key = toManifestKey(repoRoot, o.targetPath);
      targetHashes[key] = o.hash;
      targets[key] = {
        hash: o.hash,
        owner: 'aco',
        kind: o.assetKind ?? 'agent',
      };
    }
  }

  const manifest: SyncManifest = {
    version: '5',
    generatedAt: new Date().toISOString(),
    sourceHashes,
    targetHashes,
    targets,
    skipped,
    warnings,
  };

  return {
    sources,
    outputs,
    warnings,
    manifest,
  };
}
