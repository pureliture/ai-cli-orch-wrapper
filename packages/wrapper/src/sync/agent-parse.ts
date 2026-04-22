import { readFile } from 'node:fs/promises';

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

  // Simple YAML parser for scalar and string-array fields
  const yaml = parseSimpleYaml(yamlLines.join('\n'));

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
  if (yaml.skillRefs) spec.skillRefs = Array.isArray(yaml.skillRefs) ? yaml.skillRefs.map(String) : [String(yaml.skillRefs)];
  if (yaml.memoryRefs) spec.memoryRefs = Array.isArray(yaml.memoryRefs) ? yaml.memoryRefs.map(String) : [String(yaml.memoryRefs)];

  // Fallback: name -> id
  if (!spec.id && spec.name) spec.id = spec.name;

  spec.body = lines.slice(i).join('\n').trim();
  return spec;
}

function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split('\n');
  let currentKey = '';
  let currentArray: string[] = [];
  let inArray = false;

  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (trimmed.length === 0) continue;

    const match = trimmed.match(/^(\s*)([\w-]+):\s*(.*)$/);
    if (match) {
      const indent = match[1].length;
      const key = match[2];
      const value = match[3].trim();

      if (indent === 0) {
        // Top-level key
        if (inArray) {
          result[currentKey] = currentArray;
          inArray = false;
          currentArray = [];
        }
        currentKey = key;

        if (value === '' || value === '[]') {
          // Could be empty value or start of array
          if (value === '[]') {
            result[key] = [];
          } else {
            inArray = true;
            currentArray = [];
          }
        } else if (value.startsWith('[') && value.endsWith(']')) {
          // Inline array: [a, b, c]
          result[key] = value.slice(1, -1).split(',').map((s) => unquoteYamlScalar(s.trim())).filter(Boolean);
        } else {
          result[key] = unquoteYamlScalar(value);
        }
      } else if (indent > 0 && inArray) {
        // Array element
        const item = trimmed.trim();
        if (item.startsWith('- ')) {
          currentArray.push(unquoteYamlScalar(item.slice(2).trim()));
        }
      }
    } else if (trimmed.trim().startsWith('- ') && inArray) {
      currentArray.push(unquoteYamlScalar(trimmed.trim().slice(2).trim()));
    }
  }

  if (inArray && currentKey) {
    result[currentKey] = currentArray;
  }

  return result;
}

function unquoteYamlScalar(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
