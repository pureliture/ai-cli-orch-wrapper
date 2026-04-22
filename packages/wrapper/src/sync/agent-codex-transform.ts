import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseAgentSpec } from './agent-parse.js';
import { computeHash } from './hash.js';
import { loadFormatterConfig, resolveModelForProvider } from './formatter.js';
import type { SyncSource, SyncOutput, SyncWarning } from './transform-interface.js';

export interface CodexAgent {
  name: string;
  description?: string;
  model?: string;
  developer_instructions?: string;
  sandbox_mode?: string;
  model_reasoning_effort?: string;
}

export function toCodexAgent(spec: ReturnType<typeof parseAgentSpec>): CodexAgent {
  const agent: CodexAgent = {
    name: spec.id,
  };

  if (spec.when) {
    agent.description = spec.when;
  }

  // Model is set by caller after formatter resolution
  if (spec.body) {
    agent.developer_instructions = spec.body;
  }

  if (spec.permissionProfile === 'restricted' || spec.workspaceMode === 'read-only') {
    agent.sandbox_mode = 'read-only';
  } else if (spec.workspaceMode === 'edit') {
    agent.sandbox_mode = 'workspace-write';
  }

  // reasoningEffort: only include if the target supports it
  // For Codex, model_reasoning_effort is supported in custom-agent config
  if (spec.reasoningEffort) {
    agent.model_reasoning_effort = spec.reasoningEffort;
  }

  return agent;
}

export function serializeCodexAgent(agent: CodexAgent): string {
  const lines: string[] = [];
  lines.push(`name = "${escapeTomlString(agent.name)}"`);

  if (agent.description) {
    lines.push(`description = "${escapeTomlString(agent.description)}"`);
  }
  if (agent.model) {
    lines.push(`model = "${escapeTomlString(agent.model)}"`);
  }
  if (agent.developer_instructions) {
    lines.push(`developer_instructions = """${agent.developer_instructions}"""`);
  }
  if (agent.sandbox_mode) {
    lines.push(`sandbox_mode = "${escapeTomlString(agent.sandbox_mode)}"`);
  }
  if (agent.model_reasoning_effort) {
    lines.push(`model_reasoning_effort = "${escapeTomlString(agent.model_reasoning_effort)}"`);
  }

  return lines.join('\n');
}

function escapeTomlString(s: string): string {
  return s.replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

export async function syncCodexAgents(
  sources: SyncSource[],
  repoRoot: string,
  dryRun: boolean
): Promise<{ outputs: SyncOutput[]; warnings: SyncWarning[] }> {
  const outputs: SyncOutput[] = [];
  const warnings: SyncWarning[] = [];
  const agentSources = sources.filter((s) => s.kind === 'agent');
  const targetDir = join(repoRoot, '.codex', 'agents');
  const formatterConfig = await loadFormatterConfig(repoRoot);

  for (const source of agentSources) {
    const spec = parseAgentSpec(source.content);
    const agent = toCodexAgent(spec);

    const resolvedModel = resolveModelForProvider(formatterConfig, spec.modelAlias, 'codex');
    agent.model = resolvedModel ?? 'gpt-5.4';

    const fileName = `${spec.id || 'agent'}.toml`;
    const targetPath = join(targetDir, fileName);

    if (!dryRun) {
      await mkdir(targetDir, { recursive: true });
      await writeFile(targetPath, serializeCodexAgent(agent), 'utf8');
    }

    outputs.push({
      targetPath,
      kind: 'file',
      action: existsSync(targetPath) ? 'updated' : 'created',
      hash: computeHash(serializeCodexAgent(agent)),
    });

    if (spec.reasoningEffort && !agent.model_reasoning_effort) {
      warnings.push({
        source: source.path,
        message: `reasoningEffort "${spec.reasoningEffort}" not supported by Codex custom-agent config`,
        severity: 'warning',
      });
    }
  }

  return { outputs, warnings };
}
