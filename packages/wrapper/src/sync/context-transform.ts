import type { SyncSource } from './transform-interface.js';

export function aggregateContext(sources: SyncSource[]): string {
  const contextSources = sources.filter((s) => s.kind === 'config' || s.kind === 'rule');

  if (contextSources.length === 0) {
    return '';
  }

  const sections: string[] = [];
  for (const source of contextSources) {
    const relativePath = source.path.split('/').slice(-3).join('/');
    sections.push(`## ${relativePath}\n\n${source.content.trim()}`);
  }

  return sections.join('\n\n');
}
