import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { load as loadYaml } from 'js-yaml';

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

  const parsedYaml = loadYaml(content);
  const obj = isRecord(parsedYaml) ? parsedYaml : {};

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
