import type { SyncSource, AssetOwner, AssetKind, SyncConfig } from './transform-interface.js';
import { isExcluded, isIncluded } from './sync-config.js';

// Hardcoded external skill prefixes
const EXTERNAL_PREFIXES = ['openspec-', 'superpowers-'];
const EXTERNAL_NAMES = new Set([
  'using-superpowers',
  'brainstorming',
  'writing-plans',
  'executing-plans',
]);

// Hardcoded command-alias prefixes
const COMMAND_ALIAS_PREFIXES = ['gh-'];

// Default ACO-owned shared policy/reference skills
const ACO_OWNED_SKILLS = new Set(['github-kanban-ops']);

/**
 * Parsed frontmatter from a skill file.
 */
interface SkillFrontmatter {
  'x-aco-owned'?: boolean;
  'x-aco-kind'?: AssetKind;
  'x-aco-targets'?: string[];
}

/**
 * Extract frontmatter key-value pairs from markdown YAML frontmatter.
 */
function parseFrontmatter(content: string): SkillFrontmatter {
  const result: SkillFrontmatter = {};
  if (!content.startsWith('---')) return result;

  const end = content.indexOf('---', 3);
  if (end === -1) return result;

  const frontmatter = content.slice(3, end).trim();
  for (const line of frontmatter.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;

    const key = trimmed.slice(0, colonIndex).trim();
    const value = trimmed.slice(colonIndex + 1).trim();

    if (key === 'x-aco-owned') {
      result['x-aco-owned'] = value === 'true' || value === 'yes';
    } else if (key === 'x-aco-kind') {
      const v = value.replace(/['"]/g, '');
      if (
        v === 'shared-skill' ||
        v === 'command-alias-skill' ||
        v === 'external-skill' ||
        v === 'provider-command'
      ) {
        result['x-aco-kind'] = v;
      }
    } else if (key === 'x-aco-targets') {
      // Simple comma-separated or YAML list format
      result['x-aco-targets'] = value
        .split(/,\s*/)
        .map((s) => s.trim().replace(/['"\[\]]/g, ''))
        .filter(Boolean);
    }
  }

  return result;
}

/**
 * Classify a discovered skill source into owner and kind.
 */
export function classifySkill(
  source: SyncSource,
  config: SyncConfig
): { owner: AssetOwner; kind: AssetKind; targets?: string[] } {
  const skillName = source.path
    .split('/')
    .filter(Boolean)
    .slice(-2, -1)[0] ?? '';

  const frontmatter = parseFrontmatter(source.content);

  // 1. Check explicit exclude (highest precedence)
  if (isExcluded(skillName, config)) {
    // Determine why it was excluded for better classification
    if (EXTERNAL_PREFIXES.some((p) => skillName.startsWith(p))) {
      return { owner: 'external', kind: 'external-skill' };
    }
    if (EXTERNAL_NAMES.has(skillName)) {
      return { owner: 'external', kind: 'external-skill' };
    }
    if (COMMAND_ALIAS_PREFIXES.some((p) => skillName.startsWith(p))) {
      return { owner: 'provider-specific', kind: 'command-alias-skill' };
    }
    return { owner: 'unknown', kind: 'external-skill' };
  }

  // 2. Check explicit include (overrides default deny)
  if (isIncluded(skillName, config)) {
    return {
      owner: frontmatter['x-aco-owned'] ? 'aco' : 'aco',
      kind: frontmatter['x-aco-kind'] ?? 'shared-skill',
      targets: frontmatter['x-aco-targets'],
    };
  }

  // 3. Check frontmatter x-aco-owned
  if (frontmatter['x-aco-owned']) {
    return {
      owner: 'aco',
      kind: frontmatter['x-aco-kind'] ?? 'shared-skill',
      targets: frontmatter['x-aco-targets'],
    };
  }

  // 4. Check hardcoded ACO-owned skills
  if (ACO_OWNED_SKILLS.has(skillName)) {
    return {
      owner: 'aco',
      kind: 'shared-skill',
      targets: frontmatter['x-aco-targets'],
    };
  }

  // 5. Check external by naming convention
  if (EXTERNAL_PREFIXES.some((p) => skillName.startsWith(p))) {
    return { owner: 'external', kind: 'external-skill' };
  }
  if (EXTERNAL_NAMES.has(skillName)) {
    return { owner: 'external', kind: 'external-skill' };
  }

  // 6. Check command-alias by naming convention
  if (COMMAND_ALIAS_PREFIXES.some((p) => skillName.startsWith(p))) {
    return { owner: 'provider-specific', kind: 'command-alias-skill' };
  }

  // 7. Default deny
  return { owner: 'unknown', kind: 'external-skill' };
}

/**
 * Determine if a skill is eligible for shared sync output.
 */
export function isSyncEligible(source: SyncSource, config: SyncConfig): boolean {
  const { owner } = classifySkill(source, config);
  return owner === 'aco';
}
