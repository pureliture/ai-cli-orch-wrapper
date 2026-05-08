import type { Writable } from 'node:stream';
import {
  DEFAULT_OUTPUT_BUFFER_BYTES,
  MAX_OUTPUT_BUFFER_BYTES,
  type IProvider,
  type OutputBufferPolicy,
  type PermissionProfile,
} from '../providers/interface.js';
import { sessionStore } from '../session/store.js';

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
}

export interface ProviderSessionRunResult {
  fullOutput: string;
  hasOutput: boolean;
  error?: unknown;
}

export async function invokeProviderForSession(
  options: ProviderSessionRunOptions
): Promise<ProviderSessionRunResult> {
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
  let fullOutput = '';
  let hasOutput = false;
  let error: unknown;

  try {
    for await (const chunk of options.provider.invoke(
      options.command,
      options.prompt,
      options.content,
      {
        permissionProfile: options.permissionProfile,
        sessionId: options.sessionId,
        outputBuffer,
        onPid: (pid) => {
          sessionStore.update(options.sessionId, { pid }).catch((err: unknown) => {
            console.warn(
              'Failed to record process PID:',
              err instanceof Error ? err.message : String(err)
            );
          });
        },
      }
    )) {
      await writeChunk(options.output, chunk);
      if (maxBuffer > 0 && fullOutput.length < maxBuffer) {
        fullOutput += chunk;
        if (fullOutput.length > maxBuffer) {
          fullOutput = fullOutput.slice(0, maxBuffer);
        }
      }
      hasOutput = true;
      await options.onChunk?.(chunk);
    }
  } catch (err) {
    error = err;
  } finally {
    await endWritable(options.output);
  }

  return { fullOutput, hasOutput, ...(error ? { error } : {}) };
}

async function writeChunk(stream: Writable, chunk: string): Promise<void> {
  if ((stream as { skipDrainWait?: boolean }).skipDrainWait) {
    stream.write(chunk);
    return;
  }

  if (stream.write(chunk)) return;
  await new Promise<void>((resolve) => stream.once('drain', resolve));
}

async function endWritable(stream: Writable): Promise<void> {
  if (stream.writableEnded || stream.destroyed) return;
  await new Promise<void>((resolve, reject) => {
    stream.end((err?: Error | null) => (err ? reject(err) : resolve()));
  });
}
