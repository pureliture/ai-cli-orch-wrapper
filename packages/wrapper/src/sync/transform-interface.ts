/**
 * Ownership classification for discovered assets.
 */
export type AssetOwner = 'aco' | 'external' | 'provider-specific' | 'unknown';

/**
 * Kind classification for discovered assets.
 */
export type AssetKind =
  | 'shared-skill'
  | 'command-alias-skill'
  | 'external-skill'
  | 'provider-command'
  | 'config'
  | 'rule'
  | 'agent'
  | 'settings';

/**
 * Represents a discovered source file intended for synchronization.
 */
export interface SyncSource {
  path: string;
  kind: 'config' | 'rule' | 'skill' | 'agent' | 'settings';
  content: string;
  hash: string;
  /** Parsed ownership metadata from frontmatter or config. */
  owner?: AssetOwner;
  /** Parsed kind metadata from frontmatter or config. */
  assetKind?: AssetKind;
  /** Parsed target provider surfaces from frontmatter. */
  targets?: string[];
}

/**
 * The complete plan for a synchronization operation.
 */
export interface TransformPlan {
  sources: SyncSource[];
  outputs: SyncOutput[];
  warnings: SyncWarning[];
  manifest: SyncManifest;
}

/**
 * Options for running a sync operation.
 */
export interface SyncOptions {
  dryRun?: boolean;
  check?: boolean;
  force?: boolean;
  strict?: boolean;
  cleanDuplicates?: boolean;
  forceClean?: boolean;
}

/**
 * The result of a sync operation.
 */
export interface SyncResult {
  created: number;
  updated: number;
  removed: number;
  skipped: number;
  conflicts: number;
  warnings: number;
  outputs: SyncOutput[];
}

/**
 * A warning about lossy conversion during synchronization.
 */
export interface SyncWarning {
  source: string;
  message: string;
  severity: 'warning' | 'error';
  /** Structured cleanup targets, populated by duplicate-detector for use by sync-engine. */
  cleanupTargets?: string[];
}

/**
 * A generated output file or directory.
 */
export interface SyncOutput {
  targetPath: string;
  kind: 'managed-block' | 'file' | 'directory';
  action: 'created' | 'updated' | 'removed' | 'skipped' | 'conflict';
  hash?: string;
  sourceHash?: string;
  targetHash?: string;
  content?: string; // Content to write for files or managed blocks
  sourcePath?: string; // Source path for directory copies
  /** Ownership for this output target. */
  owner?: AssetOwner;
  /** Kind for this output target. */
  assetKind?: AssetKind;
  /** Provider surface when relevant. */
  provider?: string;
}

/**
 * Per-target manifest record with ownership metadata.
 */
export interface ManifestTargetRecord {
  hash: string;
  owner: AssetOwner;
  kind: AssetKind;
  hashFormat?: 'legacy-v1' | 'directory' | 'content';
  source?: string;
  provider?: string;
  action?: 'created' | 'updated' | 'removed' | 'skipped' | 'ignored';
  warnings?: SyncWarning[];
}

/**
 * Record for skipped or external assets in the manifest.
 */
export interface ManifestSkippedRecord {
  path: string;
  owner: AssetOwner;
  kind: AssetKind;
  provider?: string;
  reason: string;
}

/**
 * The manifest structure for tracking synchronization state.
 */
export interface SyncManifest {
  version: string;
  generatedAt: string;
  sourceHashes: Record<string, string>; // path -> hash
  targetHashes: Record<string, string>; // path -> hash (legacy, kept for compatibility)
  targets: Record<string, ManifestTargetRecord>; // path -> record
  skipped: ManifestSkippedRecord[];
  warnings: SyncWarning[];
}

/**
 * Parsed sync configuration from .aco/sync.yaml.
 */
export interface SyncConfig {
  skills?: {
    include?: string[];
    exclude?: string[];
  };
  /**
   * Agent (`.claude/agents/*.md`) sync controls. Default (absent) syncs all
   * discovered agents to `.codex/agents/`. `exclude` glob-matches agent ids to
   * skip; e.g. `["*"]` opts a repo out of agent sync entirely.
   */
  agents?: {
    exclude?: string[];
  };
}
