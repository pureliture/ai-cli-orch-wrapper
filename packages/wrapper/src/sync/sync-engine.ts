import { discoverSources } from './source-discovery.js';
import { aggregateContext } from './context-transform.js';
import { getManagedBlockUpdate } from './managed-block.js';
import { syncSkills } from './skill-transform.js';
import { syncCodexAgents } from './agent-codex-transform.js';
import { syncGeminiAgents } from './agent-gemini-transform.js';
import { syncCodexHooks } from './hook-codex-transform.js';
import { syncGeminiHooks } from './hook-gemini-transform.js';
import { readManifest, writeManifest, calculateDrift } from './manifest.js';
import { computeHash } from './hash.js';
import { loadSyncConfig } from './sync-config.js';
import { detectDuplicates } from './duplicate-detector.js';
import { readFile, mkdir, writeFile, cp, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
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

function isErrorWithCode(err: unknown): err is ErrorWithCode {
  return err instanceof Error && 'code' in err;
}

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
      'No sync sources found. Ensure CLAUDE.md, .claude/agents/, or .claude/settings.json exists.'
    );
  }

  // 3. Read existing manifest
  const existingManifest = await readManifest(repoRoot);

  // 4. Compute transform plan (pure planning pass)
  const plan = await computeTransformPlan(sources, repoRoot, existingManifest, config);

  // 5. Detect duplicates
  const duplicateWarnings = await detectDuplicates(repoRoot, plan.outputs);
  plan.warnings.push(...duplicateWarnings);

  // 6. Detect conflicts for planned outputs against existing manifest
  if (existingManifest) {
    for (const output of plan.outputs) {
      const existingRecord = existingManifest.targets[output.targetPath];
      const existingHash = existingRecord?.hash ?? existingManifest.targetHashes[output.targetPath];
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

    const existingRecord = existingManifest?.targets[output.targetPath];
    const existingHash = existingRecord?.hash ?? existingManifest?.targetHashes[output.targetPath];
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
    const hasDuplicates = duplicateWarnings.length > 0;
    if (isDrift || conflicts.length > 0 || (strict && hasDuplicates)) {
      const staleOutputs = plan.outputs.filter((o) => o.action === 'updated');
      const messages: string[] = [];
      if (staleOutputs.length > 0) {
        messages.push(`Stale outputs: ${staleOutputs.map((o) => o.targetPath).join(', ')}`);
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
    for (const warning of cleanable) {
      const targets = warning.cleanupTargets;
      if (targets && targets.length > 0) {
        for (const targetPath of targets) {
          const isOwned = existingManifest?.targets?.[targetPath]?.owner === 'aco';
          if (!dryRun && (isOwned || forceClean)) {
            try {
              await rm(targetPath, { recursive: true, force: true });
            } catch {
              /* Ignore */
            }
          } else if (!dryRun && !isOwned && !forceClean) {
            plan.warnings.push({
              source: targetPath,
              message: `Refused to clean duplicate ${targetPath}: not manifest-owned. Pass --force-clean to override.`,
              severity: 'warning',
            });
          }
        }
      }
    }
  }

  // 10. Write outputs (execution pass)
  if (!dryRun) {
    for (const output of plan.outputs) {
      if (output.action === 'skipped') continue;

      if (output.action === 'removed') {
        try {
          await rm(output.targetPath, { recursive: true, force: true });
        } catch {
          /* Ignore */
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
  config: SyncConfig
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

  // 1. Context -> AGENTS.md and GEMINI.md
  const contextContent = aggregateContext(sources);
  if (contextContent) {
    const agentsMdPath = `${repoRoot}/AGENTS.md`;
    const geminiMdPath = `${repoRoot}/GEMINI.md`;

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
    targetHashes[agentsMdPath] = agentsHash;
    targets[agentsMdPath] = { hash: agentsHash, owner: 'aco', kind: 'config' };

    const updatedGemini = await getManagedBlockUpdate(geminiMdPath, contextContent);
    const geminiHash = computeHash(updatedGemini);
    outputs.push({
      targetPath: geminiMdPath,
      kind: 'managed-block',
      action: 'updated',
      content: updatedGemini,
      hash: geminiHash,
      owner: 'aco',
      assetKind: 'config',
    });
    targetHashes[geminiMdPath] = geminiHash;
    targets[geminiMdPath] = { hash: geminiHash, owner: 'aco', kind: 'config' };
  }

  // 2. Skills
  const skillResult = await syncSkills(sources, repoRoot, existingManifest, config);
  outputs.push(...skillResult.outputs);
  warnings.push(...skillResult.warnings);
  skipped.push(...skillResult.skipped);
  for (const o of skillResult.outputs) {
    if (o.hash) {
      targetHashes[o.targetPath] = o.hash;
      targets[o.targetPath] = {
        hash: o.hash,
        owner: o.owner ?? 'aco',
        kind: o.assetKind ?? 'shared-skill',
        source: o.sourcePath,
      };
    }
  }

  // 3. Codex agents
  const codexAgentResult = await syncCodexAgents(sources, repoRoot);
  outputs.push(...codexAgentResult.outputs);
  warnings.push(...codexAgentResult.warnings);
  for (const o of codexAgentResult.outputs) {
    if (o.hash) {
      targetHashes[o.targetPath] = o.hash;
      targets[o.targetPath] = {
        hash: o.hash,
        owner: 'aco',
        kind: o.assetKind ?? 'agent',
      };
    }
  }

  // 4. Gemini agents
  const geminiAgentResult = await syncGeminiAgents(sources, repoRoot);
  outputs.push(...geminiAgentResult.outputs);
  warnings.push(...geminiAgentResult.warnings);
  for (const o of geminiAgentResult.outputs) {
    if (o.hash) {
      targetHashes[o.targetPath] = o.hash;
      targets[o.targetPath] = {
        hash: o.hash,
        owner: 'aco',
        kind: o.assetKind ?? 'agent',
      };
    }
  }

  // 5. Codex hooks
  const codexHookResult = await syncCodexHooks(sources, repoRoot);
  outputs.push(...codexHookResult.outputs);
  warnings.push(...codexHookResult.warnings);
  for (const o of codexHookResult.outputs) {
    if (o.hash) {
      targetHashes[o.targetPath] = o.hash;
      targets[o.targetPath] = {
        hash: o.hash,
        owner: 'aco',
        kind: o.assetKind ?? 'provider-command',
      };
    }
  }

  // 6. Gemini hooks
  const geminiHookResult = await syncGeminiHooks(sources, repoRoot);
  outputs.push(...geminiHookResult.outputs);
  warnings.push(...geminiHookResult.warnings);
  for (const o of geminiHookResult.outputs) {
    if (o.hash) {
      targetHashes[o.targetPath] = o.hash;
      targets[o.targetPath] = {
        hash: o.hash,
        owner: 'aco',
        kind: o.assetKind ?? 'provider-command',
      };
    }
  }

  const manifest: SyncManifest = {
    version: '2',
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
