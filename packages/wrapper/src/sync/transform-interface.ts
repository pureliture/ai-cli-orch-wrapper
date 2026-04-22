/**
 * Represents a discovered source file intended for synchronization.
 */
export interface SyncSource {
  path: string;
  kind: 'config' | 'rule' | 'skill' | 'agent' | 'settings';
  content: string;
  hash: string;
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
}

/**
 * The manifest structure for tracking synchronization state.
 */
export interface SyncManifest {
  version: string;
  generatedAt: string;
  sourceHashes: Record<string, string>; // path -> hash
  targetHashes: Record<string, string>; // path -> hash
  warnings: SyncWarning[];
}
