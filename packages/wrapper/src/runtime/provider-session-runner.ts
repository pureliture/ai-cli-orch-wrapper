import type { Writable } from 'node:stream';
import type { IProvider, PermissionProfile } from '../providers/interface.js';
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
  /** Maximum number of characters to buffer in memory. Beyond this, output is still written to the stream but not accumulated. */
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
  const maxBuffer = options.maxOutputBuffer ?? Infinity;
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
      if (fullOutput.length < maxBuffer) {
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
  if (stream.write(chunk)) return;
  await new Promise<void>((resolve) => stream.once('drain', resolve));
}

async function endWritable(stream: Writable): Promise<void> {
  if (stream.writableEnded || stream.destroyed) return;
  await new Promise<void>((resolve, reject) => {
    stream.end((err?: Error | null) => (err ? reject(err) : resolve()));
  });
}
