import type { Writable } from 'node:stream';
import {
  DEFAULT_OUTPUT_BUFFER_BYTES,
  MAX_OUTPUT_BUFFER_BYTES,
  type IProvider,
  type OutputBufferPolicy,
  type PermissionProfile,
} from '../providers/interface.js';
import { sessionStore, SessionStore } from '../session/store.js';

export interface ProviderSessionRunOptions {
  provider: IProvider;
  command: string;
  prompt: string;
  content: string;
  permissionProfile: PermissionProfile;
  sessionId: string;
  output: Writable;
  onChunk?: (chunk: string) => void | Promise<void>;
  /** Provider stdout buffering policy. Defaults to stream-only to avoid unbounded accumulation. */
  outputBuffer?: OutputBufferPolicy;
  /** Maximum number of characters to buffer in memory. Used only for bounded output collection. */
  maxOutputBuffer?: number;
  /** Maximum provider execution time in milliseconds. */
  timeoutMs?: number;
  /** Grace period after SIGTERM before SIGKILL. */
  killGraceMs?: number;
  /** Called once with the provider's OS PID when available. */
  onPid?: (pid: number) => void;
  /** Model identifier passed to the provider binary via -m flag. */
  model?: string;
  /**
   * Child process env policy applied at invocation time.
   * When set, recorded in the session ledger via sessionStore.update.
   */
  envPolicy?: string;
  /**
   * Session store to use for ledger updates. Defaults to the global sessionStore.
   * Primarily used in tests to inject an isolated store instance.
   */
  store?: SessionStore;
}

export interface ProviderSessionRunResult {
  fullOutput: string;
  /**
   * Total number of UTF-8 bytes streamed from the provider, counted before any
   * in-memory capture truncation. Reflects the real bytes written to the output
   * log even when `fullOutput` is empty (no-capture run path) or bounded
   * (ask save-only/full path with a capture limit).
   */
  outputBytes: number;
  hasOutput: boolean;
  error?: unknown;
  /**
   * Full stderr captured from the provider process.
   * Empty string when provider does not expose stderr (e.g. built-in/mock providers).
   * Populated via onStderrComplete callback for spawnStream-based providers.
   */
  stderrContent: string;
}

const OMITTED_OUTPUT_MARKER = '\n...[output omitted]...\n';

export async function invokeProviderForSession(
  options: ProviderSessionRunOptions
): Promise<ProviderSessionRunResult> {
  const store = options.store ?? sessionStore;

  if (options.envPolicy !== undefined) {
    await store
      .update(options.sessionId, { envPolicy: options.envPolicy })
      .catch((err: unknown) => {
        console.warn(
          'Failed to record envPolicy:',
          err instanceof Error ? err.message : String(err)
        );
      });
  }

  const outputBuffer = options.outputBuffer ?? { mode: 'stream-only' };
  const outputBufferMode = outputBuffer.mode ?? 'stream-only';
  const shouldCaptureOutput =
    options.maxOutputBuffer !== undefined || outputBufferMode === 'bounded';
  const maxBuffer = shouldCaptureOutput
    ? Math.min(
        options.maxOutputBuffer ?? outputBuffer.maxBytes ?? DEFAULT_OUTPUT_BUFFER_BYTES,
        MAX_OUTPUT_BUFFER_BYTES
      )
    : 0;
  const outputCapture = maxBuffer > 0 ? createBoundedOutputCapture(maxBuffer) : undefined;
  let hasOutput = false;
  let outputBytes = 0;
  let error: unknown;
  let capturedStderr = '';

  try {
    for await (const chunk of options.provider.invoke(
      options.command,
      options.prompt,
      options.content,
      {
        permissionProfile: options.permissionProfile,
        sessionId: options.sessionId,
        outputBuffer,
        timeoutMs: options.timeoutMs,
        killGraceMs: options.killGraceMs,
        model: options.model,
        onStderrComplete: (stderr) => {
          capturedStderr = stderr;
        },
        onPid: (pid) => {
          options.onPid?.(pid);
          store.update(options.sessionId, { pid }).catch((err: unknown) => {
            console.warn(
              'Failed to record process PID:',
              err instanceof Error ? err.message : String(err)
            );
          });
        },
      }
    )) {
      await writeChunk(options.output, chunk);
      outputCapture?.append(chunk);
      outputBytes += Buffer.byteLength(chunk, 'utf8');
      hasOutput = true;
      await options.onChunk?.(chunk);
    }
  } catch (err) {
    error = err;
  } finally {
    await endWritable(options.output);
  }

  return {
    fullOutput: outputCapture?.value() ?? '',
    outputBytes,
    hasOutput,
    stderrContent: capturedStderr,
    ...(error ? { error } : {}),
  };
}

async function writeChunk(stream: Writable, chunk: string): Promise<void> {
  if (stream.write(chunk)) return;
  await new Promise<void>((resolve) => stream.once('drain', resolve));
}

async function endWritable(stream: Writable): Promise<void> {
  if (stream.writableEnded || stream.destroyed) return;
  await new Promise<void>((resolve, reject) => {
    stream.end((err?: Error | null) => (err ? reject(err) : resolve()));
  });
}

function createBoundedOutputCapture(maxBuffer: number): {
  append(chunk: string): void;
  value(): string;
} {
  let head = '';
  let tail = '';
  let totalLength = 0;

  return {
    append(chunk: string): void {
      totalLength += chunk.length;
      if (head.length < maxBuffer) {
        head += chunk.slice(0, maxBuffer - head.length);
      }

      tail += chunk;
      if (tail.length > maxBuffer) {
        tail = tail.slice(tail.length - maxBuffer);
      }
    },
    value(): string {
      if (totalLength <= maxBuffer) return head;

      const marker = OMITTED_OUTPUT_MARKER.slice(0, maxBuffer);
      const available = Math.max(0, maxBuffer - marker.length);
      const headLength = Math.ceil(available / 2);
      const tailLength = available - headLength;

      return `${head.slice(0, headLength)}${marker}${tail.slice(tail.length - tailLength)}`;
    },
  };
}
