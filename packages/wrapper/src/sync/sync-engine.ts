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
import { readFile, mkdir, writeFile, cp, rm, readdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type {
  SyncOptions,
  SyncResult,
  SyncOutput,
  SyncWarning,
  SyncManifest,
  TransformPlan,
} from './transform-interface.js';

interface ErrorWithCode extends Error {
  code?: string;
}

function isErrorWithCode(err: unknown): err is ErrorWithCode {
  return err instanceof Error && 'code' in err;
}

export async function runSync(repoRoot: string, options: SyncOptions = {}): Promise<SyncResult> {
  const { dryRun = false, check = false, force = false } = options;

  // 1. Discover sources
  const sources = await discoverSources(repoRoot);

  if (sources.length === 0) {
    throw new Error(
      'No sync sources found. Ensure CLAUDE.md, .claude/agents/, or .claude/settings.json exists.'
    );
  }

  // 2. Read existing manifest
  const existingManifest = await readManifest(repoRoot);

  // 3. Compute transform plan (pure planning pass)
  const plan = await computeTransformPlan(sources, repoRoot, existingManifest);

  // 4. Detect conflicts for planned outputs against existing manifest
  if (existingManifest) {
    for (const output of plan.outputs) {
      const existingHash = existingManifest.targetHashes[output.targetPath];
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

    const existingHash = existingManifest?.targetHashes[output.targetPath];
    if (!existingHash) {
      output.action = 'created';
    } else if (existingHash === output.hash) {
      output.action = 'skipped';
    } else {
      output.action = 'updated';
    }
  }

  // 5. Check mode: verify without writing
  const conflicts = plan.outputs.filter((o) => o.action === 'conflict');
  if (check) {
    const isDrift = calculateDrift(existingManifest, plan.manifest);
    if (isDrift || conflicts.length > 0) {
      const staleOutputs = plan.outputs.filter((o) => o.action === 'updated');
      const messages: string[] = [];
      if (staleOutputs.length > 0) {
        messages.push(`Stale outputs: ${staleOutputs.map((o) => o.targetPath).join(', ')}`);
      }
      if (conflicts.length > 0) {
        messages.push(`Conflicts: ${conflicts.map((o) => o.targetPath).join(', ')}`);
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

  // 6. Handle conflicts unless --force
  if (conflicts.length > 0 && !force) {
    const conflictPaths = conflicts.map((c) => c.targetPath).join(', ');
    throw new Error(
      `Sync conflicts detected: ${conflictPaths}\n` +
        `Run 'aco sync --check' for details, or 'aco sync --force' to overwrite.`
    );
  }

  // 7. Write outputs (execution pass)
  if (!dryRun) {
    for (const output of plan.outputs) {
      if (output.action === 'skipped') continue;

      if (output.action === 'removed') {
        if (output.kind === 'directory') {
          try {
            const entries = await readdir(output.targetPath);
            if (entries.length === 0) {
              await rm(output.targetPath, { recursive: true, force: true });
            }
          } catch {
            /* Ignore */
          }
        } else {
          await rm(output.targetPath, { force: true });
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

  // 8. Compute result
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
  sources: ReturnType<typeof discoverSources> extends Promise<infer T> ? T : never,
  repoRoot: string,
  existingManifest: SyncManifest | null
): Promise<TransformPlan> {
  const outputs: SyncOutput[] = [];
  const warnings: SyncWarning[] = [];
  const sourceHashes: Record<string, string> = {};
  const targetHashes: Record<string, string> = {};

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
    outputs.push({
      targetPath: agentsMdPath,
      kind: 'managed-block',
      action: 'updated',
      content: updatedAgents,
      hash: computeHash(updatedAgents),
    });
    targetHashes[agentsMdPath] = computeHash(updatedAgents);

    const updatedGemini = await getManagedBlockUpdate(geminiMdPath, contextContent);
    outputs.push({
      targetPath: geminiMdPath,
      kind: 'managed-block',
      action: 'updated',
      content: updatedGemini,
      hash: computeHash(updatedGemini),
    });
    targetHashes[geminiMdPath] = computeHash(updatedGemini);
  }

  // 2. Skills
  const skillResult = await syncSkills(sources, repoRoot, existingManifest);
  outputs.push(...skillResult.outputs);
  warnings.push(...skillResult.warnings);
  for (const o of skillResult.outputs) {
    if (o.hash) targetHashes[o.targetPath] = o.hash;
  }

  // 3. Codex agents
  const codexAgentResult = await syncCodexAgents(sources, repoRoot);
  outputs.push(...codexAgentResult.outputs);
  warnings.push(...codexAgentResult.warnings);
  for (const o of codexAgentResult.outputs) {
    if (o.hash) targetHashes[o.targetPath] = o.hash;
  }

  // 4. Gemini agents
  const geminiAgentResult = await syncGeminiAgents(sources, repoRoot);
  outputs.push(...geminiAgentResult.outputs);
  warnings.push(...geminiAgentResult.warnings);
  for (const o of geminiAgentResult.outputs) {
    if (o.hash) targetHashes[o.targetPath] = o.hash;
  }

  // 5. Codex hooks
  const codexHookResult = await syncCodexHooks(sources, repoRoot);
  outputs.push(...codexHookResult.outputs);
  warnings.push(...codexHookResult.warnings);
  for (const o of codexHookResult.outputs) {
    if (o.hash) targetHashes[o.targetPath] = o.hash;
  }

  // 6. Gemini hooks
  const geminiHookResult = await syncGeminiHooks(sources, repoRoot);
  outputs.push(...geminiHookResult.outputs);
  warnings.push(...geminiHookResult.warnings);
  for (const o of geminiHookResult.outputs) {
    if (o.hash) targetHashes[o.targetPath] = o.hash;
  }

  const manifest: SyncManifest = {
    version: '1',
    generatedAt: new Date().toISOString(),
    sourceHashes,
    targetHashes,
    warnings,
  };

  return {
    sources,
    outputs,
    warnings,
    manifest,
  };
}
