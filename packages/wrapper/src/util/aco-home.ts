import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Resolve the aco data root directory.
 *
 * Defaults to `~/.aco`. Set the `ACO_HOME` environment variable to redirect all
 * aco state (runs, sessions, agy-workspace, provider-auth-cache) elsewhere — used
 * by tests and dev smoke runs so they do not pollute the real `~/.aco`.
 */
export function acoHome(): string {
  const override = process.env.ACO_HOME?.trim();
  return override ? override : join(homedir(), '.aco');
}
