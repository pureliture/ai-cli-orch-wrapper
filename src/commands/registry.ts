/**
 * Registry CLI Commands
 *
 * Implements: sync, search, install, lock
 */

import {
  fetchHubConfig,
  resolveHub,
  searchItems,
  findItem,
  cacheResolvedSources,
  loadCachedSources,
  getCommitSha,
} from '../registry/resolver.js';
import {
  readLockFile,
  writeLockFile,
  createLockFile,
  addLockedItem,
  generateLockFile,
  formatLockFile,
} from '../registry/lockfile.js';
import type { ResolvedSource, Channel } from '../registry/types.js';

// Default hub source
const DEFAULT_HUB = 'https://github.com/skillinterop/registry-hub';

/**
 * registry sync
 *
 * Fetch hub-config, resolve all leaf registries, and cache locally.
 */
export async function registrySync(options: {
  hub?: string;
  verbose?: boolean;
}): Promise<void> {
  const hubUrl = options.hub ?? DEFAULT_HUB;

  console.log(`Syncing from hub: ${hubUrl}`);

  // Fetch hub config
  const hubConfig = await fetchHubConfig(hubUrl);
  console.log(`Found ${hubConfig.sources.length} registry sources`);

  // Resolve all sources
  const resolved = await resolveHub(hubConfig);

  // Cache locally
  cacheResolvedSources(resolved);

  // Summary
  let totalItems = 0;
  for (const r of resolved) {
    const itemCount = r.manifest.items.length;
    totalItems += itemCount;
    console.log(`  ${r.manifest.registryType}: ${itemCount} items (${r.commitSha.slice(0, 7)})`);
  }

  console.log(`\nSync complete: ${totalItems} total items cached`);
}

/**
 * registry search
 *
 * Search for items across all registries.
 */
export async function registrySearch(
  query: string,
  options: {
    type?: string;
    channel?: Channel;
    refresh?: boolean;
  }
): Promise<void> {
  // Try to use cached sources first
  let resolved: ResolvedSource[] | null = null;

  if (!options.refresh) {
    resolved = loadCachedSources();
  }

  if (!resolved) {
    console.log('No cache found, syncing...');
    const hubConfig = await fetchHubConfig(DEFAULT_HUB);
    resolved = await resolveHub(hubConfig);
    cacheResolvedSources(resolved);
  }

  // Search
  const results = searchItems(resolved, query, {
    registryType: options.type,
    channel: options.channel,
  });

  if (results.length === 0) {
    console.log(`No results found for: ${query}`);
    return;
  }

  console.log(`Found ${results.length} results:\n`);

  for (const result of results) {
    const statusBadge = result.status === 'deprecated' ? ' [DEPRECATED]' : '';
    const channelBadge = result.channel === 'experimental' ? ' (experimental)' : '';

    console.log(`  ${result.canonicalId}${statusBadge}${channelBadge}`);
    console.log(`    ${result.description}`);
    console.log(``);
  }
}

/**
 * registry install
 *
 * Install an item by canonical ID or name.
 */
export async function registryInstall(
  idOrName: string,
  options: {
    dryRun?: boolean;
    force?: boolean;
  }
): Promise<void> {
  // Load or sync sources
  let resolved = loadCachedSources();

  if (!resolved) {
    console.log('No cache found, syncing...');
    const hubConfig = await fetchHubConfig(DEFAULT_HUB);
    resolved = await resolveHub(hubConfig);
    cacheResolvedSources(resolved);
  }

  // Find the item
  const item = findItem(resolved, idOrName);

  if (!item) {
    console.error(`Item not found: ${idOrName}`);
    console.error(`Try running: wrapper registry search ${idOrName}`);
    process.exit(1);
  }

  // Check if deprecated
  if (item.status === 'deprecated' && !options.force) {
    console.warn(`Warning: ${item.canonicalId} is deprecated`);
    console.warn(`Use --force to install anyway`);
    process.exit(1);
  }

  if (options.dryRun) {
    console.log(`Would install: ${item.canonicalId}`);
    console.log(`  From: ${item.sourceRepo}`);
    console.log(`  Version: ${item.version}`);
    return;
  }

  // Load or create lock file
  let lockFile = readLockFile() ?? createLockFile(DEFAULT_HUB);

  // Get commit SHA for the source
  const source = resolved.find(r => r.source.repoUrl === item.sourceRepo);
  const commitSha = source?.commitSha ?? getCommitSha(item.sourceRepo, 'main');

  // Add to lock file
  const lockedItem = addLockedItem(lockFile, item, commitSha);

  // Write lock file
  writeLockFile(lockFile);

  console.log(`Installed: ${item.canonicalId}`);
  console.log(`  Version: ${item.version}`);
  console.log(`  Locked at: ${commitSha.slice(0, 7)}`);
}

/**
 * registry lock
 *
 * Generate or display lock file.
 */
export async function registryLock(options: {
  generate?: boolean;
  show?: boolean;
}): Promise<void> {
  const lockFile = readLockFile();

  if (options.show || (!options.generate && lockFile)) {
    if (!lockFile) {
      console.log('No lock file found. Run `wrapper registry install` to create one.');
      return;
    }

    console.log(formatLockFile(lockFile));
    return;
  }

  if (options.generate) {
    // Generate fresh lock file from installed items
    const resolved = loadCachedSources();

    if (!resolved) {
      console.error('No cache found. Run `wrapper registry sync` first.');
      process.exit(1);
    }

    const existingLock = readLockFile();
    const installedIds = existingLock?.items.map(i => i.canonicalId) ?? [];

    if (installedIds.length === 0) {
      console.log('No items installed. Lock file not generated.');
      return;
    }

    const newLockFile = generateLockFile(DEFAULT_HUB, resolved, installedIds);
    writeLockFile(newLockFile);

    console.log(`Lock file generated with ${newLockFile.items.length} items`);
  }
}

/**
 * registry add
 *
 * Add a hub source (convenience alias).
 */
export async function registryAdd(source: string): Promise<void> {
  // Parse source format: github:org/repo or full URL
  let hubUrl: string;

  if (source.startsWith('github:')) {
    const repoPath = source.replace('github:', '');
    hubUrl = `https://github.com/${repoPath}`;
  } else {
    hubUrl = source;
  }

  console.log(`Adding hub source: ${hubUrl}`);
  await registrySync({ hub: hubUrl });
}
