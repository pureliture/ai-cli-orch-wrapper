/**
 * Aco config
 *
 * Reads and parses .wrapper.json from the current working directory.
 */

import { readFileSync } from 'node:fs';
import type { WorkflowDefinitionInput } from '../orchestration/workflow-config.js';

export const ACO_CONFIG_FILE = '.wrapper.json';

export interface AliasEntry {
  provider: string;
  agent: string;
}

export interface AcoConfig {
  aliases: Record<string, AliasEntry>;
  roles: Record<string, string>;
  workflows?: Record<string, WorkflowDefinitionInput>;
}

const DEFAULT_CONFIG: AcoConfig = { aliases: {}, roles: {} };

export function readAcoConfig(path = ACO_CONFIG_FILE): AcoConfig {
  try {
    const raw = readFileSync(path, 'utf8');
    return JSON.parse(raw) as AcoConfig;
  } catch {
    return DEFAULT_CONFIG;
  }
}
