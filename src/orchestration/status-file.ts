/**
 * Review status file parser
 *
 * Strict parser for review.status.json — the machine-readable approval contract.
 * Only trusts structured status fields, never infers approval from prose.
 */

import { readFileSync, existsSync } from 'node:fs';

export interface ReviewStatusFile {
  schemaVersion: 1;
  status: 'approved' | 'changes_requested';
  summary: string;
}

const VALID_STATUSES = ['approved', 'changes_requested'] as const;

export function readReviewStatusFile(path: string): ReviewStatusFile {
  if (!existsSync(path)) {
    throw new Error(`Missing review status file: ${path}`);
  }

  let parsed: unknown;
  try {
    const raw = readFileSync(path, 'utf8');
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid review status JSON: ${path}`);
  }

  const obj = parsed as Record<string, unknown>;

  if (obj.schemaVersion !== 1) {
    throw new Error(`Invalid review status schema version: expected 1, got ${String(obj.schemaVersion)}`);
  }

  if (typeof obj.status !== 'string' || !VALID_STATUSES.includes(obj.status as typeof VALID_STATUSES[number])) {
    throw new Error(`Invalid review status: expected approved|changes_requested, got '${String(obj.status)}'`);
  }

  if (typeof obj.summary !== 'string') {
    throw new Error(`Invalid review status summary: expected string, got ${typeof obj.summary}`);
  }

  return {
    schemaVersion: 1,
    status: obj.status as 'approved' | 'changes_requested',
    summary: obj.summary,
  };
}
