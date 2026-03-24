/**
 * Wrapper config
 *
 * Reads and parses .wrapper.json from the current working directory.
 */

import { readFileSync } from 'node:fs';

export const CONFIG_FILE_NAME = '.wrapper.json';

export interface AliasEntry {
  provider: string;
  agent: string;
}

export interface WrapperConfig {
  aliases: Record<string, AliasEntry>;
  roles: Record<string, string>;
}

const DEFAULT_CONFIG: WrapperConfig = { aliases: {}, roles: {} };

export function readWrapperConfig(path = CONFIG_FILE_NAME): WrapperConfig {
  try {
    const raw = readFileSync(path, 'utf8');
    return JSON.parse(raw) as WrapperConfig;
  } catch {
    return DEFAULT_CONFIG;
  }
}
