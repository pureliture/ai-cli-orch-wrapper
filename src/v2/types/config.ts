/**
 * V2 config schema
 *
 * Defines the .wrapper.json contract for the v2 bridge architecture.
 * Aliases map to adapter configs rather than cao provider strings.
 */

export const V2_CONFIG_FILE = '.wrapper.json';

/**
 * Identifies which CliAdapter implementation handles a given alias.
 * The adapter field is a registry key (e.g. 'claude-code', 'gemini-cli', 'codex').
 */
export interface CliAdapterConfig {
  /** Registry key identifying the CliAdapter implementation (e.g. 'claude-code') */
  adapter: string;
  /** Optional extra args forwarded verbatim to the adapter's launch() call */
  extraArgs?: string[];
}

/** Per-role mapping — role name -> adapter registry key */
export type RoleMap = Record<string, string>;

/** Root .wrapper.json shape for v2 */
export interface V2Config {
  /** Alias name -> adapter config */
  aliases: Record<string, CliAdapterConfig>;
  /** Optional role -> adapter key mapping (e.g. orchestrator -> 'claude-code') */
  roles?: RoleMap;
  /** Schema version — allows future migration guards */
  schemaVersion?: string;
}

export const DEFAULT_V2_CONFIG: V2Config = { aliases: {} };
