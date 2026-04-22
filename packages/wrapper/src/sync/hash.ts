import { createHash } from 'node:crypto';

/**
 * Computes a SHA-256 hash of the given content.
 * @param content The string content to hash.
 * @returns The hex digest of the hash.
 */
export function computeHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}
