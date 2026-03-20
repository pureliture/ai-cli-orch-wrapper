/**
 * Registry Resolver
 *
 * Resolves hub configuration and fetches leaf registry manifests.
 * Implements the hub-to-leaf resolution flow.
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type {
  HubConfig,
  LeafManifest,
  SourceRef,
  ResolvedSource,
  SearchResult,
  Channel,
} from './types.js';

const CACHE_DIR = '.wrapper/cache';

/**
 * Fetch hub-config.json from a GitHub repo
 */
export async function fetchHubConfig(repoUrl: string, branch = 'main'): Promise<HubConfig> {
  const rawUrl = githubRawUrl(repoUrl, branch, 'hub-config.json');
  const response = await fetch(rawUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch hub-config.json from ${rawUrl}: ${response.statusText}`);
  }

  return response.json() as Promise<HubConfig>;
}

/**
 * Fetch a leaf registry manifest
 */
export async function fetchLeafManifest(source: SourceRef): Promise<LeafManifest> {
  const rawUrl = githubRawUrl(source.repoUrl, source.branch, source.manifestPath);
  const response = await fetch(rawUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch manifest from ${rawUrl}: ${response.statusText}`);
  }

  return response.json() as Promise<LeafManifest>;
}

/**
 * Get the current commit SHA for a GitHub repo/branch
 */
export function getCommitSha(repoUrl: string, branch: string): string {
  try {
    const result = execSync(
      `git ls-remote ${repoUrl} refs/heads/${branch}`,
      { encoding: 'utf-8' }
    );
    const sha = result.split('\t')[0];
    return sha || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Resolve all sources from a hub config
 */
export async function resolveHub(hubConfig: HubConfig): Promise<ResolvedSource[]> {
  const resolved: ResolvedSource[] = [];

  for (const source of hubConfig.sources) {
    try {
      const manifest = await fetchLeafManifest(source);
      const commitSha = getCommitSha(source.repoUrl, source.branch);

      resolved.push({
        source,
        manifest,
        commitSha,
      });
    } catch (error) {
      console.error(`Warning: Failed to resolve ${source.registryType} registry:`, error);
    }
  }

  return resolved;
}

/**
 * Search across all resolved sources
 */
export function searchItems(
  resolvedSources: ResolvedSource[],
  query: string,
  options: {
    registryType?: string;
    channel?: Channel;
  } = {}
): SearchResult[] {
  const results: SearchResult[] = [];
  const queryLower = query.toLowerCase();

  for (const resolved of resolvedSources) {
    const { source, manifest } = resolved;

    // Filter by registry type if specified
    if (options.registryType && manifest.registryType !== options.registryType) {
      continue;
    }

    for (const item of manifest.items) {
      // Filter by channel if specified
      if (options.channel && item.channel !== options.channel) {
        continue;
      }

      // Apply source-level channel filter
      if (source.channel === 'stable' && item.channel !== 'stable') {
        continue;
      }

      // Search in name, description, and canonicalId
      const searchable = `${item.name} ${item.description} ${item.canonicalId}`.toLowerCase();

      if (searchable.includes(queryLower)) {
        results.push({
          canonicalId: item.canonicalId,
          registryType: manifest.registryType,
          name: item.name,
          version: item.version,
          description: item.description,
          sourceRepo: source.repoUrl,
          channel: item.channel,
          status: item.status,
        });
      }
    }
  }

  return results;
}

/**
 * Find an item by canonical ID or partial match
 */
export function findItem(
  resolvedSources: ResolvedSource[],
  idOrName: string
): SearchResult | null {
  for (const resolved of resolvedSources) {
    const { source, manifest } = resolved;

    for (const item of manifest.items) {
      // Exact canonical ID match
      if (item.canonicalId === idOrName) {
        return {
          canonicalId: item.canonicalId,
          registryType: manifest.registryType,
          name: item.name,
          version: item.version,
          description: item.description,
          sourceRepo: source.repoUrl,
          channel: item.channel,
          status: item.status,
        };
      }

      // Partial match: registryType/name (without namespace and version)
      const shortId = `${manifest.registryType}/${item.name}`;
      if (idOrName === shortId || idOrName === item.name) {
        return {
          canonicalId: item.canonicalId,
          registryType: manifest.registryType,
          name: item.name,
          version: item.version,
          description: item.description,
          sourceRepo: source.repoUrl,
          channel: item.channel,
          status: item.status,
        };
      }
    }
  }

  return null;
}

/**
 * Cache resolved sources to local filesystem
 */
export function cacheResolvedSources(
  resolvedSources: ResolvedSource[],
  cacheDir = CACHE_DIR
): void {
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true });
  }

  for (const resolved of resolvedSources) {
    const filename = `${resolved.manifest.registryType}-manifest.json`;
    const filepath = join(cacheDir, filename);
    writeFileSync(filepath, JSON.stringify(resolved.manifest, null, 2));
  }

  // Write cache metadata
  const metadata = {
    cachedAt: new Date().toISOString(),
    sources: resolvedSources.map(r => ({
      registryType: r.manifest.registryType,
      repoUrl: r.source.repoUrl,
      commitSha: r.commitSha,
    })),
  };
  writeFileSync(join(cacheDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
}

/**
 * Load cached sources from local filesystem
 */
export function loadCachedSources(cacheDir = CACHE_DIR): ResolvedSource[] | null {
  const metadataPath = join(cacheDir, 'metadata.json');

  if (!existsSync(metadataPath)) {
    return null;
  }

  try {
    const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
    const resolved: ResolvedSource[] = [];

    for (const sourceMeta of metadata.sources) {
      const manifestPath = join(cacheDir, `${sourceMeta.registryType}-manifest.json`);
      if (!existsSync(manifestPath)) continue;

      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as LeafManifest;

      resolved.push({
        source: {
          registryType: manifest.registryType,
          repoUrl: sourceMeta.repoUrl,
          manifestPath: 'manifest.json',
          branch: 'main',
          channel: 'stable',
        },
        manifest,
        commitSha: sourceMeta.commitSha,
      });
    }

    return resolved;
  } catch {
    return null;
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert a GitHub repo URL to a raw content URL
 */
function githubRawUrl(repoUrl: string, branch: string, path: string): string {
  // Handle both https://github.com/org/repo and https://github.com/org/repo.git
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
  if (!match) {
    throw new Error(`Invalid GitHub URL: ${repoUrl}`);
  }

  const [, owner, repo] = match;
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
}
