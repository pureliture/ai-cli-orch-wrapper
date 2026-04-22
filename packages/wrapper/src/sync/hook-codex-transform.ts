import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseHooks, toCodexHooks } from './hook-parse.js';
import { computeHash } from './hash.js';
import type { SyncSource, SyncOutput, SyncWarning } from './transform-interface.js';

export async function syncCodexHooks(
  sources: SyncSource[],
  repoRoot: string
): Promise<{ outputs: SyncOutput[]; warnings: SyncWarning[] }> {
  const outputs: SyncOutput[] = [];
  const warnings: SyncWarning[] = [];

  const hookSource = sources.find((s) => s.kind === 'settings');
  if (!hookSource) return { outputs, warnings };

  const hooks = parseHooks(hookSource.content);
  if (!hooks) return { outputs, warnings };

  const { hooks: codexHooks, warnings: hookWarnings } = toCodexHooks(hooks);

  for (const w of hookWarnings) {
    warnings.push({
      source: hookSource.path,
      message: w,
      severity: 'warning',
    });
  }

  if (codexHooks.length === 0) return { outputs, warnings };

  // Plan .codex/hooks.json
  const hooksPath = join(repoRoot, '.codex', 'hooks.json');
  const hooksContent = JSON.stringify(codexHooks, null, 2) + '\n';

  outputs.push({
    targetPath: hooksPath,
    kind: 'file',
    action: 'updated',
    content: hooksContent,
    hash: computeHash(hooksContent),
  });

  // Plan/merge .codex/config.toml with codex_hooks feature flag
  const configPath = join(repoRoot, '.codex', 'config.toml');
  let configContent = '';

  if (existsSync(configPath)) {
    try {
      configContent = await readFile(configPath, 'utf8');
    } catch {
      configContent = '';
    }
  }

  const managedBlock = '# BEGIN ACO GENERATED\n[features]\ncodex_hooks = true\n# END ACO GENERATED';

  if (configContent.includes('# BEGIN ACO GENERATED')) {
    // Replace existing managed block
    const beginIdx = configContent.indexOf('# BEGIN ACO GENERATED');
    const endIdx = configContent.indexOf('# END ACO GENERATED');
    if (endIdx !== -1) {
      configContent =
        configContent.slice(0, beginIdx) +
        managedBlock +
        configContent.slice(endIdx + '# END ACO GENERATED'.length);
    } else {
      configContent = configContent.trimEnd() + '\n\n' + managedBlock + '\n';
    }
  } else {
    configContent = configContent.trimEnd() + '\n\n' + managedBlock + '\n';
  }

  outputs.push({
    targetPath: configPath,
    kind: 'file',
    action: 'updated',
    content: configContent,
    hash: computeHash(configContent),
  });

  return { outputs, warnings };
}
