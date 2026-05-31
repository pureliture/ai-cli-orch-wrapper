export type PermissionProfile = 'default' | 'restricted' | 'unrestricted';

export type OutputBufferMode = 'stream-only' | 'bounded' | 'disabled';

export type OutputBufferBytes = number;

export const DEFAULT_OUTPUT_BUFFER_MODE: OutputBufferMode = 'stream-only';
export const DEFAULT_OUTPUT_BUFFER_BYTES: OutputBufferBytes = 1_048_576;
export const MAX_OUTPUT_BUFFER_BYTES: OutputBufferBytes = 16_777_216;

export interface OutputBufferPolicy {
  /** Buffering mode for provider invoke output. */
  mode?: OutputBufferMode;
  /** Maximum bytes retained in bounded mode. */
  maxBytes?: OutputBufferBytes;
  /**
   * Mutable snapshot sink for bounded mode.
   * The sink is only populated when mode is `bounded`.
   */
  snapshot?: { value: string };
}

export type AuthMethod = 'api-key' | 'oauth' | 'cli-fallback' | 'missing';

export interface AuthResult {
  ok: boolean;
  method?: AuthMethod;
  version?: string;
  binaryPath?: string;
  hint?: string;
}

export interface InvokeOptions {
  permissionProfile?: PermissionProfile;
  sessionId?: string;
  /** Output buffering policy for provider stdout collection. */
  outputBuffer?: OutputBufferPolicy;
  /** Called once the provider process has been spawned, with its PID. */
  onPid?: (pid: number) => void;
  /** Maximum provider execution time in milliseconds. */
  timeoutMs?: number;
  /** Grace period after SIGTERM before SIGKILL. */
  killGraceMs?: number;
  /** Model identifier passed to the provider binary via -m flag. */
  model?: string;
  /**
   * Called once with the full captured stderr after the provider process closes.
   * Only invoked by spawnStream-based providers; built-in/mock providers do not call this.
   */
  onStderrComplete?: (stderr: string) => void;
}

export interface IProvider {
  readonly key: string;
  readonly installHint: string;

  isAvailable(): boolean;
  checkAuth(): Promise<AuthResult>;
  buildArgs(command: string, options?: InvokeOptions): string[];
  invoke(
    command: string,
    prompt: string,
    content: string,
    options?: InvokeOptions
  ): AsyncIterable<string>;

  /**
   * Summarize provider output for brief display.
   * @param output - The full provider output.
   * @param maxLength - Maximum length of the summary.
   * @returns A bounded summary string.
   */
  summarizeOutput?(output: string, maxLength: number): string;
}
