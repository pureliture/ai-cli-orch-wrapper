import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseAgentSpec } from './agent-parse.js';
import { computeHash } from './hash.js';
import { loadFormatterConfig, resolveModelForProvider } from './formatter.js';
import type { SyncSource, SyncOutput, SyncWarning } from './transform-interface.js';

export interface GeminiAgent {
  name: string;
  description?: string;
  model?: string;
  kind: string;
  max_turns?: number;
  body: string;
}

export function toGeminiAgent(spec: ReturnType<typeof parseAgentSpec>): GeminiAgent {
  const agent: GeminiAgent = {
    name: spec.id,
    kind: 'local',
    body: spec.body || '',
  };

  const description = spec.when || spec.description;
  if (description) {
    agent.description = description;
  }

  if (spec.turnLimit > 0) {
    agent.max_turns = spec.turnLimit;
  }

  return agent;
}

export function serializeGeminiAgent(agent: GeminiAgent): string {
  const lines: string[] = [];
  lines.push('---');
  lines.push(`name: ${agent.name}`);
  if (agent.description) {
    lines.push(`description: ${agent.description}`);
  }
  if (agent.model) {
    lines.push(`model: ${agent.model}`);
  }
  lines.push(`kind: ${agent.kind}`);
  if (agent.max_turns) {
    lines.push(`max_turns: ${agent.max_turns}`);
  }
  lines.push('---');
  lines.push('');
  lines.push(agent.body);

  return lines.join('\n');
}

export async function syncGeminiAgents(
  sources: SyncSource[],
  repoRoot: string,
  dryRun: boolean
): Promise<{ outputs: SyncOutput[]; warnings: SyncWarning[] }> {
  const outputs: SyncOutput[] = [];
  const warnings: SyncWarning[] = [];
  const agentSources = sources.filter((s) => s.kind === 'agent');
  const targetDir = join(repoRoot, '.gemini', 'agents');
  const formatterConfig = await loadFormatterConfig(repoRoot);

  for (const source of agentSources) {
    const spec = parseAgentSpec(source.content);
    const agent = toGeminiAgent(spec);

    const resolvedModel = resolveModelForProvider(formatterConfig, spec.modelAlias, 'gemini_cli');
    agent.model = resolvedModel ?? 'gemini-2.5-pro';

    const fileName = `${spec.id || 'agent'}.md`;
    const targetPath = join(targetDir, fileName);

    if (!dryRun) {
      await mkdir(targetDir, { recursive: true });
      await writeFile(targetPath, serializeGeminiAgent(agent), 'utf8');
    }

    outputs.push({
      targetPath,
      kind: 'file',
      action: existsSync(targetPath) ? 'updated' : 'created',
      hash: computeHash(serializeGeminiAgent(agent)),
    });

    if (spec.reasoningEffort) {
      warnings.push({
        source: source.path,
        message: `reasoningEffort "${spec.reasoningEffort}" is not supported by Gemini CLI and was omitted`,
        severity: 'warning',
      });
    }

    if (spec.permissionProfile === 'restricted' || spec.workspaceMode === 'read-only') {
      warnings.push({
        source: source.path,
        message: 'Gemini read-only enforcement is best-effort; tool restrictions may not be fully equivalent',
        severity: 'warning',
      });
    }
  }

  return { outputs, warnings };
}
