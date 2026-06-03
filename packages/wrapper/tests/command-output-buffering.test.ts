import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { resolveRunOutputBuffering } from '../src/cli.js';
import { resolveAskOutputBuffering } from '../src/commands/ask.js';
import { invokeProviderForSession } from '../src/runtime/provider-session-runner.js';
import type { IProvider } from '../src/providers/interface.js';

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

  it('keeps provider session runner from accumulating output in stream-only mode', async () => {
    const provider: IProvider = {
      key: 'mock',
      installHint: 'mock',
      icon: '⚪',
      isAvailable: () => true,
      checkAuth: async () => ({ ok: true }),
      buildArgs: () => [],
      invoke: async function* (_command, _prompt, _content, options) {
        assert.equal(options?.outputBuffer?.mode, 'stream-only');
        yield 'large-output';
      },
    };
    const output = new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    });

    const result = await invokeProviderForSession({
      provider,
      command: 'review',
      prompt: 'prompt',
      content: 'content',
      permissionProfile: 'restricted',
      sessionId: 'test-session',
      output,
      outputBuffer: resolveRunOutputBuffering(),
    });

    assert.equal(result.hasOutput, true);
    assert.equal(result.fullOutput, '');
  });
});
