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
 * Classify a discovered skill source into owner and kind.
 *
 * Ownership policy precedence (highest to lowest):
 *  1. .aco/sync.yaml skills.exclude
 *  2. .aco/sync.yaml skills.include
 *  3. Built-in classifier defaults (hardcoded ACO-owned skills)
 *  4. SKILL.md x-aco-* frontmatter (advisory metadata only)
 *  5. Naming convention heuristics
 *  6. Default deny (owner = unknown)
 *
 * NOTE: x-aco-* frontmatter is advisory. It does NOT override .aco/sync.yaml.
 * The primary policy mechanism is .aco/sync.yaml.
 */
export function classifySkill(
  source: SyncSource,
  config: SyncConfig
): { owner: AssetOwner; kind: AssetKind; targets?: string[] } {
  const skillName = source.path
    .split('/')
    .filter(Boolean)
    .slice(-2, -1)[0] ?? '';

  // 1. .aco/sync.yaml exclude (highest precedence)
  if (isExcluded(skillName, config)) {
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

  // 2. .aco/sync.yaml include (overrides default deny)
  if (isIncluded(skillName, config)) {
    return {
      owner: 'aco',
      kind: source.assetKind ?? 'shared-skill',
      targets: source.targets,
    };
  }

  // 3. Built-in ACO-owned defaults
  if (ACO_OWNED_SKILLS.has(skillName)) {
    return {
      owner: 'aco',
      kind: 'shared-skill',
      targets: source.targets,
    };
  }

  // 4. Advisory frontmatter (lowest precedence among eligibility checks)
  if (source.owner === 'aco') {
    return {
      owner: 'aco',
      kind: source.assetKind ?? 'shared-skill',
      targets: source.targets,
    };
  }

  // 5. Naming convention heuristics
  if (EXTERNAL_PREFIXES.some((p) => skillName.startsWith(p))) {
    return { owner: 'external', kind: 'external-skill' };
  }
  if (EXTERNAL_NAMES.has(skillName)) {
    return { owner: 'external', kind: 'external-skill' };
  }
  if (COMMAND_ALIAS_PREFIXES.some((p) => skillName.startsWith(p))) {
    return { owner: 'provider-specific', kind: 'command-alias-skill' };
  }

  // 6. Default deny
  return { owner: 'unknown', kind: 'external-skill' };
}

/**
 * Determine if a skill is eligible for shared sync output.
 */
export function isSyncEligible(source: SyncSource, config: SyncConfig): boolean {
  const { owner } = classifySkill(source, config);
  return owner === 'aco';
}
