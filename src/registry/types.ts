/**
 * Registry Types
 *
 * Type definitions for the registry resolver system.
 * Aligns with the manifest.json and hub-config.json schemas.
 */

// ============================================================================
// Leaf Registry Types
// ============================================================================

export type RegistryType = 'skill' | 'cao-profile' | 'reprogate';
export type Channel = 'stable' | 'experimental';
export type ItemStatus = 'active' | 'deprecated' | 'archived';

/**
 * Individual item in a leaf registry manifest
 */
export interface ManifestItem {
  canonicalId: string;
  name: string;
  version: string;
  description: string;
  path: string;
  channel: Channel;
  status: ItemStatus;
  deprecatedBy: string | null;
  metadata: Record<string, unknown>;
}

/**
 * Leaf registry manifest structure (manifest.json)
 */
export interface LeafManifest {
  registryType: RegistryType;
  namespace: string;
  version: string;
  channel: Channel;
  generatedAt: string;
  items: ManifestItem[];
}

// ============================================================================
// Hub Types
// ============================================================================

/**
 * Source reference in hub-config.json
 */
export interface SourceRef {
  registryType: RegistryType;
  repoUrl: string;
  manifestPath: string;
  branch: string;
  channel: 'stable' | 'all';
}

/**
 * Hub configuration (hub-config.json)
 */
export interface HubConfig {
  hubVersion: string;
  sources: SourceRef[];
}

/**
 * Registry summary in hub-index.json
 */
export interface RegistrySummary {
  registryType: RegistryType;
  repoUrl: string;
  itemCount: number;
  lastUpdated: string;
}

/**
 * Indexed item in hub-index.json
 */
export interface IndexedItem {
  canonicalId: string;
  registryType: RegistryType;
  name: string;
  version: string;
  description: string;
  sourceRepo: string;
}

/**
 * Hub index (hub-index.json)
 */
export interface HubIndex {
  hubVersion: string;
  generatedAt: string;
  totalItems: number;
  registries: RegistrySummary[];
  items: IndexedItem[];
}

// ============================================================================
// Lock File Types
// ============================================================================

/**
 * Individual locked item
 */
export interface LockedItem {
  canonicalId: string;
  registryType: RegistryType;
  name: string;
  version: string;
  sourceRepo: string;
  sourceRef: string;  // git commit SHA
  installedAt: string;
  integrity?: string; // future: content hash
}

/**
 * Lock file structure (wrapper.lock)
 */
export interface LockFile {
  lockVersion: string;
  generatedAt: string;
  hubSource: string;
  items: LockedItem[];
}

// ============================================================================
// Resolver Types
// ============================================================================

/**
 * Resolved registry source with fetched manifest
 */
export interface ResolvedSource {
  source: SourceRef;
  manifest: LeafManifest;
  commitSha: string;
}

/**
 * Search result
 */
export interface SearchResult {
  canonicalId: string;
  registryType: RegistryType;
  name: string;
  version: string;
  description: string;
  sourceRepo: string;
  channel: Channel;
  status: ItemStatus;
}

/**
 * Installation result
 */
export interface InstallResult {
  canonicalId: string;
  success: boolean;
  message: string;
  lockedItem?: LockedItem;
}

// ============================================================================
// Canonical ID Utilities
// ============================================================================

/**
 * Parse a canonical ID into its components
 * Format: <registryType>/<namespace>/<name>@<version>
 */
export interface ParsedCanonicalId {
  registryType: RegistryType;
  namespace: string;
  name: string;
  version: string;
}

export function parseCanonicalId(canonicalId: string): ParsedCanonicalId | null {
  const match = canonicalId.match(/^(skill|cao-profile|reprogate)\/([^/]+)\/([^@]+)@(.+)$/);
  if (!match) return null;

  return {
    registryType: match[1] as RegistryType,
    namespace: match[2],
    name: match[3],
    version: match[4],
  };
}

export function buildCanonicalId(
  registryType: RegistryType,
  namespace: string,
  name: string,
  version: string
): string {
  return `${registryType}/${namespace}/${name}@${version}`;
}
