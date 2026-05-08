import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRunOutputBuffering } from '../src/cli.js';
import { resolveAskOutputBuffering } from '../src/commands/ask.js';

describe('command invocation output buffering policy', () => {
  it('uses stream-only output policy for aco run', () => {
    const policy = resolveRunOutputBuffering();
    assert.equal(policy.mode, 'stream-only');
  });

  it('uses bounded output policy for aco ask brief output-mode only', () => {
    assert.equal(resolveAskOutputBuffering('brief').mode, 'bounded');
    assert.equal(resolveAskOutputBuffering('full').mode, 'stream-only');
    assert.equal(resolveAskOutputBuffering('save-only').mode, 'stream-only');
  });
});
