import { readFile } from 'node:fs/promises';
import { load as loadYaml } from 'js-yaml';

export interface AgentSpec {
  id: string;
  name: string;
  description: string;
  when: string;
  modelAlias: string;
  roleHint: string;
  permissionProfile: string;
  turnLimit: number;
  executionMode: string;
  workspaceMode: string;
  isolationMode: string;
  promptSeedFile: string;
  reasoningEffort: string;
  skillRefs: string[];
  memoryRefs: string[];
  body: string;
}

export function parseAgentSpec(content: string): AgentSpec {
  const spec: AgentSpec = {
    id: '',
    name: '',
    description: '',
    when: '',
    modelAlias: '',
    roleHint: '',
    permissionProfile: 'default',
    turnLimit: 0,
    executionMode: 'blocking',
    workspaceMode: 'read-only',
    isolationMode: 'none',
    promptSeedFile: '',
    reasoningEffort: '',
    skillRefs: [],
    memoryRefs: [],
    body: '',
  };

  const lines = content.split('\n');
  if (lines[0]?.trim() !== '---') {
    spec.body = content.trim();
    return spec;
  }

  let i = 1;
  const yamlLines: string[] = [];
  for (; i < lines.length; i++) {
    if (lines[i]?.trim() === '---') {
      i++;
      break;
    }
    yamlLines.push(lines[i]);
  }

  const parsedYaml = loadYaml(yamlLines.join('\n'));
  const yaml = isRecord(parsedYaml) ? parsedYaml : {};

  if (yaml.id) spec.id = String(yaml.id);
  if (yaml.name) spec.name = String(yaml.name);
  if (yaml.description) spec.description = String(yaml.description);
  if (yaml.when) spec.when = String(yaml.when);
  if (yaml.modelAlias) spec.modelAlias = String(yaml.modelAlias);
  if (yaml.roleHint) spec.roleHint = String(yaml.roleHint);
  if (yaml.permissionProfile) spec.permissionProfile = String(yaml.permissionProfile);
  if (yaml.turnLimit) spec.turnLimit = Number(yaml.turnLimit);
  if (yaml.executionMode) spec.executionMode = String(yaml.executionMode);
  if (yaml.workspaceMode) spec.workspaceMode = String(yaml.workspaceMode);
  if (yaml.isolationMode) spec.isolationMode = String(yaml.isolationMode);
  if (yaml.promptSeedFile) spec.promptSeedFile = String(yaml.promptSeedFile);
  if (yaml.reasoningEffort) spec.reasoningEffort = String(yaml.reasoningEffort);
  if (yaml.skillRefs)
    spec.skillRefs = Array.isArray(yaml.skillRefs)
      ? yaml.skillRefs.map(String)
      : [String(yaml.skillRefs)];
  if (yaml.memoryRefs)
    spec.memoryRefs = Array.isArray(yaml.memoryRefs)
      ? yaml.memoryRefs.map(String)
      : [String(yaml.memoryRefs)];

  // Fallback: name -> id
  if (!spec.id && spec.name) spec.id = spec.name;

  spec.body = lines.slice(i).join('\n').trim();
  return spec;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
