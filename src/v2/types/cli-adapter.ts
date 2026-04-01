/**
 * CliAdapter interface
 *
 * Abstracts any AI CLI backend (claude-code, gemini-cli, codex, etc.)
 * behind a common contract. Implementations live in src/v2/adapters/.
 */

/** Options passed to CliAdapter.launch() */
export interface LaunchOptions {
  /** Alias name being launched (for error messages) */
  aliasName: string;
  /** Arguments forwarded verbatim to the underlying CLI */
  passthroughArgs: string[];
  /** Optional agent identifier (used by adapters that support multi-agent selection) */
  agent?: string;
}

/** Result returned by CliAdapter.launch() */
export interface LaunchResult {
  /** Exit code from the underlying CLI process. 0 = success. */
  exitCode: number;
  /** Optional error message if the launch failed before the process started */
  error?: string;
}

/**
 * Contract for any AI CLI backend.
 * Implementations must be stateless — all runtime context comes via LaunchOptions.
 */
export interface CliAdapter {
  /** Human-readable adapter name (e.g. 'claude-code', 'gemini-cli') */
  readonly name: string;

  /**
   * Check whether the underlying CLI binary is available in the current PATH.
   * Must not throw — return false if the check fails for any reason.
   */
  isAvailable(): boolean;

  /**
   * Return the version string reported by the underlying CLI.
   * Returns null if the CLI is unavailable or reports no version.
   */
  version(): string | null;

  /**
   * Launch the CLI with the given options.
   * Must not throw — surface errors via LaunchResult.error and non-zero exitCode.
   */
  launch(options: LaunchOptions): Promise<LaunchResult>;
}
