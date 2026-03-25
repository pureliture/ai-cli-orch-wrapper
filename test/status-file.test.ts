/**
 * Review status file tests
 *
 * Wave 0 tests for ORCH-04: strict review.status.json parsing and validation.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'wrapper-status-file-test-'));
}

// Test 1: readReviewStatusFile parses valid "approved" status
test('readReviewStatusFile parses valid approved status', async () => {
  const { readReviewStatusFile } = await import('../dist/orchestration/status-file.js');

  const dir = makeTempDir();
  const statusPath = join(dir, 'review.status.json');
  writeFileSync(statusPath, JSON.stringify({
    schemaVersion: 1,
    status: 'approved',
    summary: 'Looks good, ship it.',
  }), 'utf8');

  const result = readReviewStatusFile(statusPath);
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.status, 'approved');
  assert.equal(result.summary, 'Looks good, ship it.');
});

// Test 2: readReviewStatusFile parses valid "changes_requested" status
test('readReviewStatusFile parses valid changes_requested status', async () => {
  const { readReviewStatusFile } = await import('../dist/orchestration/status-file.js');

  const dir = makeTempDir();
  const statusPath = join(dir, 'review.status.json');
  writeFileSync(statusPath, JSON.stringify({
    schemaVersion: 1,
    status: 'changes_requested',
    summary: 'Needs refactoring in module X.',
  }), 'utf8');

  const result = readReviewStatusFile(statusPath);
  assert.equal(result.status, 'changes_requested');
  assert.equal(result.summary, 'Needs refactoring in module X.');
});

// Test 3: missing file throws with "Missing review status file:" prefix
test('readReviewStatusFile throws for missing file', async () => {
  const { readReviewStatusFile } = await import('../dist/orchestration/status-file.js');

  assert.throws(
    () => readReviewStatusFile('/nonexistent/path/review.status.json'),
    (err: Error) => err.message.startsWith('Missing review status file:'),
  );
});

// Test 4: malformed JSON throws with "Invalid review status JSON:" prefix
test('readReviewStatusFile throws for malformed JSON', async () => {
  const { readReviewStatusFile } = await import('../dist/orchestration/status-file.js');

  const dir = makeTempDir();
  const statusPath = join(dir, 'review.status.json');
  writeFileSync(statusPath, '{ not valid json }', 'utf8');

  assert.throws(
    () => readReviewStatusFile(statusPath),
    (err: Error) => err.message.startsWith('Invalid review status JSON:'),
  );
});

// Test 5: invalid status value throws with "expected approved|changes_requested"
test('readReviewStatusFile throws for invalid status value', async () => {
  const { readReviewStatusFile } = await import('../dist/orchestration/status-file.js');

  const dir = makeTempDir();
  const statusPath = join(dir, 'review.status.json');
  writeFileSync(statusPath, JSON.stringify({
    schemaVersion: 1,
    status: 'pending',
    summary: 'Still reviewing.',
  }), 'utf8');

  assert.throws(
    () => readReviewStatusFile(statusPath),
    (err: Error) => err.message.includes('expected approved|changes_requested'),
  );
});

// Test 6: missing schemaVersion throws with "Invalid review status schema version" prefix
test('readReviewStatusFile throws for missing schemaVersion', async () => {
  const { readReviewStatusFile } = await import('../dist/orchestration/status-file.js');

  const dir = makeTempDir();
  const statusPath = join(dir, 'review.status.json');
  writeFileSync(statusPath, JSON.stringify({
    status: 'approved',
    summary: 'Missing schema version.',
  }), 'utf8');

  assert.throws(
    () => readReviewStatusFile(statusPath),
    (err: Error) => err.message.startsWith('Invalid review status schema version'),
  );
});

// Test 7: wrong schemaVersion throws with "Invalid review status schema version" prefix
test('readReviewStatusFile throws for wrong schemaVersion', async () => {
  const { readReviewStatusFile } = await import('../dist/orchestration/status-file.js');

  const dir = makeTempDir();
  const statusPath = join(dir, 'review.status.json');
  writeFileSync(statusPath, JSON.stringify({
    schemaVersion: 2,
    status: 'approved',
    summary: 'Wrong version.',
  }), 'utf8');

  assert.throws(
    () => readReviewStatusFile(statusPath),
    (err: Error) => err.message.startsWith('Invalid review status schema version'),
  );
});
