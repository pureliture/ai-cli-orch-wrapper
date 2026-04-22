import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseHooks, toGeminiHooks } from './hook-parse.js';
import { computeHash } from './hash.js';
import type { SyncSource, SyncOutput, SyncWarning } from './transform-interface.js';

export async function syncGeminiHooks(
  sources: SyncSource[],
  repoRoot: string,
  dryRun: boolean
): Promise<{ outputs: SyncOutput[]; warnings: SyncWarning[] }> {
  const outputs: SyncOutput[] = [];
  const warnings: SyncWarning[] = [];

  const hookSource = sources.find((s) => s.kind === 'settings');
  if (!hookSource) return { outputs, warnings };

  const hooks = parseHooks(hookSource.content);
  if (!hooks) return { outputs, warnings };

  const { hooks: geminiHooks, warnings: hookWarnings } = toGeminiHooks(hooks);

  for (const w of hookWarnings) {
    warnings.push({
      source: hookSource.path,
      message: w,
      severity: 'warning',
    });
  }

  if (Object.keys(geminiHooks).length === 0) return { outputs, warnings };

  // Write .gemini/settings.json
  const settingsPath = join(repoRoot, '.gemini', 'settings.json');

  // Merge with existing settings if present
  let existingSettings: Record<string, unknown> = {};
  if (existsSync(settingsPath)) {
    try {
      const existing = await readFile(settingsPath, 'utf8');
      existingSettings = JSON.parse(existing) as Record<string, unknown>;
    } catch {
      // Invalid existing file, overwrite
    }
  }

  const newSettings = {
    ...existingSettings,
    hooks: geminiHooks,
  };

  const content = JSON.stringify(newSettings, null, 2) + '\n';

  if (!dryRun) {
    await mkdir(join(repoRoot, '.gemini'), { recursive: true });
    await writeFile(settingsPath, content, 'utf8');
  }

  outputs.push({
    targetPath: settingsPath,
    kind: 'file',
    action: existsSync(settingsPath) ? 'updated' : 'created',
    hash: computeHash(content),
  });

  return { outputs, warnings };
}
