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

  it('reports total streamed bytes even when fullOutput is not captured (stream-only run path)', async () => {
    const chunk = 'X'.repeat(4096);
    const provider: IProvider = {
      key: 'mock',
      installHint: 'mock',
      icon: '⚪',
      isAvailable: () => true,
      checkAuth: async () => ({ ok: true }),
      buildArgs: () => [],
      invoke: async function* () {
        yield chunk;
        yield chunk;
        yield chunk;
      },
    };
    const output = new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    });

    const result = await invokeProviderForSession({
      provider,
      command: 'run',
      prompt: 'prompt',
      content: 'content',
      permissionProfile: 'restricted',
      sessionId: 'test-session',
      output,
      outputBuffer: resolveRunOutputBuffering(),
    });

    // fullOutput is intentionally empty in the no-capture run path.
    assert.equal(result.fullOutput, '');
    // outputBytes must reflect the real streamed size, not the (empty) buffer.
    assert.equal(result.outputBytes, Buffer.byteLength(chunk, 'utf8') * 3);
  });

  it('reports total streamed bytes uncapped when output exceeds the ask capture limit', async () => {
    const total = 20 * 1024;
    const big = 'Y'.repeat(total);
    const captureLimit = 16 * 1024;
    const provider: IProvider = {
      key: 'mock',
      installHint: 'mock',
      icon: '⚪',
      isAvailable: () => true,
      checkAuth: async () => ({ ok: true }),
      buildArgs: () => [],
      invoke: async function* () {
        yield big;
      },
    };
    const output = new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    });

    const result = await invokeProviderForSession({
      provider,
      command: 'ask',
      prompt: 'prompt',
      content: 'content',
      permissionProfile: 'restricted',
      sessionId: 'test-session',
      output,
      outputBuffer: resolveAskOutputBuffering('save-only'),
      maxOutputBuffer: captureLimit,
    });

    // fullOutput stays bounded by the capture limit (memory safety).
    assert.ok(
      Buffer.byteLength(result.fullOutput, 'utf8') <= captureLimit,
      'fullOutput must stay within the capture limit'
    );
    // outputBytes must equal the real streamed size, not the bounded capture.
    assert.equal(result.outputBytes, total);
  });

  it('counts UTF-8 byte length, not UTF-16 string length, for multibyte output', async () => {
    const payload = '안녕하세요 🚀'.repeat(100);
    const expectedBytes = Buffer.byteLength(payload, 'utf8');
    // Guard the test itself: byte length must differ from string length,
    // otherwise the assertion would not distinguish byteLength from .length.
    assert.notEqual(expectedBytes, payload.length);

    const provider: IProvider = {
      key: 'mock',
      installHint: 'mock',
      icon: '⚪',
      isAvailable: () => true,
      checkAuth: async () => ({ ok: true }),
      buildArgs: () => [],
      invoke: async function* () {
        yield payload;
      },
    };
    const output = new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    });

    const result = await invokeProviderForSession({
      provider,
      command: 'run',
      prompt: 'prompt',
      content: 'content',
      permissionProfile: 'restricted',
      sessionId: 'test-session',
      output,
      outputBuffer: resolveRunOutputBuffering(),
    });

    assert.equal(result.outputBytes, expectedBytes);
  });

  it('reports bytes streamed before a mid-stream provider error', async () => {
    const chunk = 'Z'.repeat(2048);
    const provider: IProvider = {
      key: 'mock',
      installHint: 'mock',
      icon: '⚪',
      isAvailable: () => true,
      checkAuth: async () => ({ ok: true }),
      buildArgs: () => [],
      invoke: async function* () {
        yield chunk;
        throw new Error('provider aborted mid-stream');
      },
    };
    const output = new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    });

    const result = await invokeProviderForSession({
      provider,
      command: 'run',
      prompt: 'prompt',
      content: 'content',
      permissionProfile: 'restricted',
      sessionId: 'test-session',
      output,
      outputBuffer: resolveRunOutputBuffering(),
    });

    // The error is captured, and outputBytes reflects what reached the output
    // before the abort — not silently reset to 0.
    assert.ok(result.error instanceof Error);
    assert.equal(result.outputBytes, Buffer.byteLength(chunk, 'utf8'));
  });
});
