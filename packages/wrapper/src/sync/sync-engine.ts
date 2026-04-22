import { discoverSources } from './source-discovery.js';
import { aggregateContext } from './context-transform.js';
import { updateManagedBlock } from './managed-block.js';
import { syncSkills } from './skill-transform.js';
import { syncCodexAgents } from './agent-codex-transform.js';
import { syncGeminiAgents } from './agent-gemini-transform.js';
import { syncCodexHooks } from './hook-codex-transform.js';
import { syncGeminiHooks } from './hook-gemini-transform.js';
import { readManifest, writeManifest, calculateDrift } from './manifest.js';
import { computeHash } from './hash.js';
import type {
  SyncOptions,
  SyncResult,
  SyncOutput,
  SyncWarning,
  SyncManifest,
  TransformPlan,
} from './transform-interface.js';

export async function runSync(
  repoRoot: string,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const { dryRun = false, check = false, force = false } = options;

  // 1. Discover sources
  const sources = await discoverSources(repoRoot);

  if (sources.length === 0) {
    throw new Error('No sync sources found. Ensure CLAUDE.md, .claude/agents/, or .claude/settings.json exists.');
  }

  // 2. Read existing manifest
  const existingManifest = await readManifest(repoRoot);

  // 3. Compute transform plan
  const plan = await computeTransformPlan(sources, repoRoot, existingManifest, dryRun);

  // 4. Check mode: verify without writing
  if (check) {
    const isDrift = calculateDrift(existingManifest, plan.manifest);
    if (isDrift) {
      const staleOutputs = plan.outputs.filter((o) => o.action === 'updated');
      const conflicts = plan.outputs.filter((o) => o.action === 'conflict');
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

  // 5. Handle conflicts unless --force
  const conflicts = plan.outputs.filter((o) => o.action === 'conflict');
  if (conflicts.length > 0 && !force) {
    const conflictPaths = conflicts.map((c) => c.targetPath).join(', ');
    throw new Error(
      `Sync conflicts detected: ${conflictPaths}\n` +
      `Run 'aco sync --check' for details, or 'aco sync --force' to overwrite.`
    );
  }

  // 6. Write outputs (unless dry-run)
  if (!dryRun) {
    await writeManifest(repoRoot, plan.manifest);
  }

  // 7. Compute result
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
  existingManifest: SyncManifest | null,
  dryRun: boolean
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

    if (!dryRun) {
      await updateManagedBlock(agentsMdPath, contextContent);
      await updateManagedBlock(geminiMdPath, contextContent);
    }

    outputs.push({
      targetPath: agentsMdPath,
      kind: 'managed-block',
      action: 'updated',
      hash: computeHash(contextContent),
    });
    targetHashes[agentsMdPath] = computeHash(contextContent);

    outputs.push({
      targetPath: geminiMdPath,
      kind: 'managed-block',
      action: 'updated',
      hash: computeHash(contextContent),
    });
    targetHashes[geminiMdPath] = computeHash(contextContent);
  }

  // 2. Skills
  const skillResult = await syncSkills(sources, repoRoot, existingManifest, dryRun);
  outputs.push(...skillResult.outputs);
  warnings.push(...skillResult.warnings);
  for (const o of skillResult.outputs) {
    if (o.hash) targetHashes[o.targetPath] = o.hash;
  }

  // 3. Codex agents
  const codexAgentResult = await syncCodexAgents(sources, repoRoot, dryRun);
  outputs.push(...codexAgentResult.outputs);
  warnings.push(...codexAgentResult.warnings);
  for (const o of codexAgentResult.outputs) {
    if (o.hash) targetHashes[o.targetPath] = o.hash;
  }

  // 4. Gemini agents
  const geminiAgentResult = await syncGeminiAgents(sources, repoRoot, dryRun);
  outputs.push(...geminiAgentResult.outputs);
  warnings.push(...geminiAgentResult.warnings);
  for (const o of geminiAgentResult.outputs) {
    if (o.hash) targetHashes[o.targetPath] = o.hash;
  }

  // 5. Codex hooks
  const codexHookResult = await syncCodexHooks(sources, repoRoot, dryRun);
  outputs.push(...codexHookResult.outputs);
  warnings.push(...codexHookResult.warnings);
  for (const o of codexHookResult.outputs) {
    if (o.hash) targetHashes[o.targetPath] = o.hash;
  }

  // 6. Gemini hooks
  const geminiHookResult = await syncGeminiHooks(sources, repoRoot, dryRun);
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
