/**
 * Alias command
 *
 * Dispatches a named alias to the corresponding cao launch invocation.
 */

import { spawnSync } from 'node:child_process';
import type { AliasEntry } from '../config/wrapper-config.js';

export async function aliasCommand(
  aliasName: string,
  entry: AliasEntry,
  passthroughArgs: string[],
): Promise<void> {
  const caoArgs = [
    'launch',
    '--provider', entry.provider,
    '--agents', entry.agent,
    ...passthroughArgs,
  ];
  const result = spawnSync('cao', caoArgs, { stdio: 'inherit' });
  if (result.error) {
    console.error(`Error: failed to invoke cao for alias '${aliasName}': ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
