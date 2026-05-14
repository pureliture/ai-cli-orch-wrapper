export type ProviderExecutionErrorCode = 'timeout' | 'cancelled';

export class ProviderExecutionError extends Error {
  constructor(
    readonly code: ProviderExecutionErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ProviderExecutionError';
  }
}

export function isProviderExecutionError(
  error: unknown,
  code?: ProviderExecutionErrorCode
): error is ProviderExecutionError {
  return error instanceof ProviderExecutionError && (code === undefined || error.code === code);
}
