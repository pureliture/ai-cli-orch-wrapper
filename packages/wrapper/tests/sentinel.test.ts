import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseSentinel, stripRid, isPotentialSentinel } from '../src/util/sentinel.js';

describe('parseSentinel', () => {
  it('parses valid sentinel with 16 hex rid', () => {
    const line = 'ACO_META_a3f2b1c4d5e6f789: {"agent":"reviewer","provider":"gemini_cli","model":"gemini-2.5-pro","exit_code":0,"duration_ms":3812}';
    const result = parseSentinel(line);

    assert.notEqual(result, null);
    assert.equal(result?.rid, 'a3f2b1c4d5e6f789');
    assert.equal(result?.meta.agent, 'reviewer');
    assert.equal(result?.meta.provider, 'gemini_cli');
    assert.equal(result?.meta.model, 'gemini-2.5-pro');
    assert.equal(result?.meta.exit_code, 0);
    assert.equal(result?.meta.duration_ms, 3812);
  });

  it('parses sentinel with leading/trailing whitespace', () => {
    const line = '  ACO_META_0123456789abcdef: {"agent":"test","provider":"codex","model":"gpt-4","exit_code":1,"duration_ms":100}  ';
    const result = parseSentinel(line);

    assert.notEqual(result, null);
    assert.equal(result?.rid, '0123456789abcdef');
    assert.equal(result?.meta.agent, 'test');
  });

  it('returns null for invalid rid length', () => {
    const line = 'ACO_META_a3f2b1c4: {"agent":"test"}';
    const result = parseSentinel(line);
    assert.equal(result, null);
  });

  it('returns null for non-hex rid characters', () => {
    const line = 'ACO_META_ghijklmnopqrstuv: {"agent":"test"}';
    const result = parseSentinel(line);
    assert.equal(result, null);
  });

  it('returns null for invalid JSON payload', () => {
    const line = 'ACO_META_a3f2b1c4d5e6f789: not json';
    const result = parseSentinel(line);
    assert.equal(result, null);
  });

  it('returns null for non-sentinel lines', () => {
    const line = 'This is regular output from the provider';
    const result = parseSentinel(line);
    assert.equal(result, null);
  });

  it('parses old format ACO_META: for backward compatibility', () => {
    const line = 'ACO_META: {"agent":"old","provider":"codex","model":"gpt-4","exit_code":0,"duration_ms":500}';
    const result = parseSentinel(line);

    assert.notEqual(result, null);
    assert.equal(result?.rid, '');
    assert.equal(result?.meta.agent, 'old');
  });

  it('returns null for ACO_META_ prefix without valid format', () => {
    const line = 'ACO_META_something random text';
    const result = parseSentinel(line);
    assert.equal(result, null);
  });
});

describe('stripRid', () => {
  it('strips rid from valid sentinel', () => {
    const line = 'ACO_META_a3f2b1c4d5e6f789: {"agent":"reviewer","provider":"gemini"}';
    const stripped = stripRid(line);

    assert.equal(stripped, 'ACO_META: {"agent":"reviewer","provider":"gemini"}');
  });

  it('returns line unchanged if not a sentinel', () => {
    const line = 'Regular output line';
    const result = stripRid(line);
    assert.equal(result, line);
  });

  it('returns line unchanged for old format ACO_META:', () => {
    const line = 'ACO_META: {"agent":"test"}';
    const result = stripRid(line);
    assert.equal(result, line);
  });
});

describe('isPotentialSentinel', () => {
  it('returns false for valid sentinel format', () => {
    const line = 'ACO_META_a3f2b1c4d5e6f789: {"agent":"test"}';
    assert.equal(isPotentialSentinel(line), false);
  });

  it('returns false for non-ACO_META lines', () => {
    const line = 'Regular provider output';
    assert.equal(isPotentialSentinel(line), false);
  });

  it('returns true for ACO_META_ prefix without valid format', () => {
    const line = 'ACO_META_accidental output from provider';
    assert.equal(isPotentialSentinel(line), true);
  });

  it('returns true for ACO_META_ with wrong rid length', () => {
    const line = 'ACO_META_a3f2b1c4: {"agent":"test"}'; // 8 chars instead of 16
    assert.equal(isPotentialSentinel(line), true);
  });

  it('returns true for ACO_META_ with uppercase hex', () => {
    const line = 'ACO_META_A3F2B1C4D5E6F789: {"agent":"test"}'; // uppercase not valid
    assert.equal(isPotentialSentinel(line), true);
  });
});