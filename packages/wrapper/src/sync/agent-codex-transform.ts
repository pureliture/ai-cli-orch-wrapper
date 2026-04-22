import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseAgentSpec } from './agent-parse.js';
import { computeHash } from './hash.js';
import { loadFormatterConfig, resolveModelForProvider } from './formatter.js';
import { DEFAULT_CODEX_MODEL } from './model-defaults.js';
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

  const description = spec.when || spec.description;
  if (description) {
    agent.description = description;
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
    // Escape """ sequences to prevent breaking TOML multiline string syntax
    const escaped = agent.developer_instructions.replace(/"""/g, '\\"\\"\\"');
    lines.push(`developer_instructions = """${escaped}"""`);
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
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

export async function syncCodexAgents(
  sources: SyncSource[],
  repoRoot: string
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
    agent.model = resolvedModel ?? DEFAULT_CODEX_MODEL;

    const fileName = `${spec.id || 'agent'}.toml`;
    const targetPath = join(targetDir, fileName);
    const content = serializeCodexAgent(agent);

    outputs.push({
      targetPath,
      kind: 'file',
      action: 'updated', // Default, refined by sync-engine
      content,
      hash: computeHash(content),
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
