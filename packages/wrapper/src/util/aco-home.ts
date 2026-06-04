import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * Resolve the aco data root directory.
 *
 * Defaults to `~/.aco`. Set the `ACO_HOME` environment variable to redirect all
 * aco state (runs, sessions, agy-workspace, provider-auth-cache) elsewhere — used
 * by tests and dev smoke runs so they do not pollute the real `~/.aco`.
 *
 * Always returns an absolute path. A relative `ACO_HOME` (e.g. `./tmp`) is
 * pinned to the launcher's cwd here so the data root stays stable even when aco
 * spawns provider child processes from a different working directory.
 */
export function acoHome(): string {
  const override = process.env.ACO_HOME?.trim();
  return resolve(override ? override : join(homedir(), '.aco'));
}
