export const DEFAULT_PROVIDER_TIMEOUT_SECONDS = 300;
export const DEFAULT_PROVIDER_KILL_GRACE_MS = 5_000;

export interface TimeoutEnv {
  ACO_TIMEOUT_SECONDS?: string;
}

export interface ProviderExecutionControl {
  timeoutMs: number;
  killGraceMs: number;
}

export function resolveProviderTimeoutSeconds(
  flagValue: string | undefined,
  env: TimeoutEnv = process.env
): number {
  const source = flagValue ?? env.ACO_TIMEOUT_SECONDS;
  if (source === undefined || source === '') return DEFAULT_PROVIDER_TIMEOUT_SECONDS;

  const parsed = Number(source);
  const label = flagValue !== undefined ? '--timeout' : 'ACO_TIMEOUT_SECONDS';
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${label}: expected a positive number of seconds`);
  }

  return parsed;
}

export function resolveProviderExecutionControl(
  flagValue: string | undefined,
  env: TimeoutEnv = process.env
): ProviderExecutionControl {
  return {
    timeoutMs: Math.ceil(resolveProviderTimeoutSeconds(flagValue, env) * 1000),
    killGraceMs: DEFAULT_PROVIDER_KILL_GRACE_MS,
  };
}

export function parseProviderTimeoutFlag(args: string[]): string | undefined {
  const index = args.indexOf('--timeout');
  if (index === -1) return undefined;

  const value = args[index + 1];
  if (value === undefined || value.startsWith('-')) {
    throw new Error('Invalid --timeout: expected a positive number of seconds');
  }
  return value;
}
