import { mkdirSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { readLockFile, writeLockFile, addLockedItem } from '../registry/lockfile.js';
import type { LockedItem } from '../registry/types.js';

export async function downloadCommand(url: string): Promise<void> {
  console.log(`Downloading: ${url}...`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }

    const content = await response.text();
    const filename = basename(new URL(url).pathname) || 'downloaded-file';
    const downloadDir = '.wrapper/downloads';
    const localPath = join(downloadDir, filename);

    // Ensure download directory exists
    mkdirSync(downloadDir, { recursive: true });

    // Save content
    writeFileSync(localPath, content);
    console.log(`Saved to: ${localPath}`);

    // Update lockfile
    const lockFile = readLockFile();
    const lockedItem: LockedItem = {
      url,
      localPath,
      downloadedAt: new Date().toISOString(),
    };
    addLockedItem(lockFile, lockedItem);
    writeLockFile(lockFile);
    console.log(`Updated wrapper.lock`);
  } catch (error) {
    console.error(`Error downloading ${url}:`, error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
