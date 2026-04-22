import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface FormatterConfig {
  modelAliasMap: Record<string, { provider: string; model: string }>;
  providerModels: Record<string, string[]>;
  fallback: { provider: string; model: string };
}

export async function loadFormatterConfig(repoRoot: string): Promise<FormatterConfig | null> {
  const path = join(repoRoot, '.aco', 'formatter.yaml');
  try {
    const content = await readFile(path, 'utf-8');
    return parseFormatterYaml(content);
  } catch {
    return null;
  }
}

export function resolveModelForProvider(
  config: FormatterConfig | null,
  modelAlias: string,
  targetProvider: 'codex' | 'gemini_cli'
): string | undefined {
  if (!config) return undefined;

  if (modelAlias && config.modelAliasMap[modelAlias]) {
    const aliasEntry = config.modelAliasMap[modelAlias];
    if (aliasEntry.provider === targetProvider) {
      return aliasEntry.model;
    }
  }

  const providerModels = config.providerModels[targetProvider];
  if (providerModels && providerModels.length > 0) {
    return providerModels[0];
  }

  if (config.fallback.provider === targetProvider) {
    return config.fallback.model;
  }

  return undefined;
}

function parseFormatterYaml(content: string): FormatterConfig {
  const config: FormatterConfig = {
    modelAliasMap: {},
    providerModels: {},
    fallback: { provider: 'codex', model: '' },
  };

  const obj = parseYamlObject(content.split('\n'), { index: 0 }, 0);

  const aliasMap = obj['modelAliasMap'];
  if (aliasMap && typeof aliasMap === 'object' && !Array.isArray(aliasMap)) {
    for (const [alias, val] of Object.entries(aliasMap)) {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        const entry = val as Record<string, unknown>;
        const provider = String(entry['provider'] ?? '');
        const model = String(entry['model'] ?? '');
        if (provider && model) {
          config.modelAliasMap[alias] = { provider, model };
        }
      }
    }
  }

  const providerModels = obj['providerModels'];
  if (providerModels && typeof providerModels === 'object' && !Array.isArray(providerModels)) {
    for (const [provider, models] of Object.entries(providerModels)) {
      if (Array.isArray(models)) {
        config.providerModels[provider] = models.map(String);
      }
    }
  }

  const fallback = obj['fallback'];
  if (fallback && typeof fallback === 'object' && !Array.isArray(fallback)) {
    const fb = fallback as Record<string, unknown>;
    config.fallback.provider = String(fb['provider'] ?? 'codex');
    config.fallback.model = String(fb['model'] ?? '');
  }

  return config;
}

interface ParseState {
  index: number;
}

function getIndent(line: string): number {
  let i = 0;
  while (i < line.length && line[i] === ' ') i++;
  return i;
}

function parseYamlObject(
  lines: string[],
  state: ParseState,
  baseIndent: number
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  while (state.index < lines.length) {
    const line = lines[state.index];
    const trimmed = line.trimEnd();

    if (!trimmed || trimmed.trimStart().startsWith('#')) {
      state.index++;
      continue;
    }

    const indent = getIndent(trimmed);

    if (indent < baseIndent) break;

    const content = trimmed.trimStart();

    if (content.startsWith('- ')) {
      break;
    }

    const colonIdx = content.indexOf(':');
    if (colonIdx === -1) {
      state.index++;
      continue;
    }

    const key = content.slice(0, colonIdx).trim();
    const rest = content.slice(colonIdx + 1).trim();

    state.index++;

    if (rest === '' || rest === '|' || rest === '>') {
      if (state.index < lines.length) {
        const nextLine = lines[state.index];
        const nextTrimmed = nextLine?.trimEnd() ?? '';
        const nextContent = nextTrimmed.trimStart();
        const nextIndent = nextTrimmed ? getIndent(nextTrimmed) : 0;

        if (nextIndent > indent && nextContent.startsWith('- ')) {
          result[key] = parseYamlArray(lines, state, nextIndent);
        } else if (nextIndent > indent) {
          result[key] = parseYamlObject(lines, state, nextIndent);
        } else {
          result[key] = null;
        }
      } else {
        result[key] = null;
      }
    } else if (rest === '[]') {
      result[key] = [];
    } else {
      result[key] = rest;
    }
  }

  return result;
}

function parseYamlArray(lines: string[], state: ParseState, baseIndent: number): unknown[] {
  const result: unknown[] = [];

  while (state.index < lines.length) {
    const line = lines[state.index];
    const trimmed = line.trimEnd();

    if (!trimmed || trimmed.trimStart().startsWith('#')) {
      state.index++;
      continue;
    }

    const indent = getIndent(trimmed);
    if (indent < baseIndent) break;

    const content = trimmed.trimStart();
    if (!content.startsWith('- ')) break;

    const value = content.slice(2).trim();
    result.push(value);
    state.index++;
  }

  return result;
}
