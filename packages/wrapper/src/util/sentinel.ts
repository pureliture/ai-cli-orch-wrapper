/**
 * Sentinel parsing utilities for ACO_META lines.
 *
 * Go binary outputs: ACO_META_<rid>: {"agent":"...",...}
 * where <rid> is a 16 hex char random identifier.
 *
 * This module:
 * 1. Parses sentinel lines with regex ^ACO_META_[a-f0-9]{16}:
 * 2. Extracts metadata JSON payload
 * 3. Strips rid for backward compatibility (ACO_META:)
 */

export interface SentinelMeta {
  agent?: string;
  provider?: string;
  model?: string;
  exit_code?: number;
  duration_ms?: number;
  [key: string]: unknown;
}

// Regex to match sentinel lines: ACO_META_<16 hex chars>: <json>
const SENTINEL_REGEX = /^ACO_META_([a-f0-9]{16}):\s*(.+)$/;

// Regex to match old format for backward compatibility
const OLD_SENTINEL_REGEX = /^ACO_META:\s*(.+)$/;

/**
 * Parses a sentinel line and returns the random identifier and metadata.
 * Returns null if the line is not a valid sentinel.
 */
export function parseSentinel(line: string): { rid: string; meta: SentinelMeta } | null {
  const trimmed = line.trim();

  // Try new format: ACO_META_<rid>: {...}
  const match = SENTINEL_REGEX.exec(trimmed);
  if (match) {
    try {
      const rid = match[1];
      const jsonStr = match[2];
      const meta = JSON.parse(jsonStr) as SentinelMeta;
      return { rid, meta };
    } catch {
      // Invalid JSON - not a valid sentinel
      return null;
    }
  }

  // Try old format for backward compatibility: ACO_META: {...}
  const oldMatch = OLD_SENTINEL_REGEX.exec(trimmed);
  if (oldMatch) {
    try {
      const jsonStr = oldMatch[1];
      const meta = JSON.parse(jsonStr) as SentinelMeta;
      return { rid: '', meta };
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Strips the random identifier from a sentinel line.
 * Converts: ACO_META_<rid>: {...} -> ACO_META: {...}
 *
 * If the line is not a sentinel, returns it unchanged.
 */
export function stripRid(line: string): string {
  const match = SENTINEL_REGEX.exec(line);
  if (match) {
    const jsonStr = match[2];
    return `ACO_META: ${jsonStr}`;
  }
  return line;
}

/**
 * Checks if a line looks like a potential sentinel (for collision detection).
 * Provider might accidentally output lines starting with ACO_META_.
 * Returns true if the line could be confused with a sentinel.
 */
export function isPotentialSentinel(line: string): boolean {
  const trimmed = line.trim();
  // Check if line starts with ACO_META_ but doesn't have valid format
  if (!trimmed.startsWith('ACO_META_')) return false;

  // Valid sentinel format
  if (SENTINEL_REGEX.test(trimmed)) return false;

  // Line starts with ACO_META_ but isn't valid format
  return true;
}
