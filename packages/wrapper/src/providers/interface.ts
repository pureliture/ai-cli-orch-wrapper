export type PermissionProfile = 'default' | 'restricted' | 'unrestricted';

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
  /** Called once the provider process has been spawned, with its PID. */
  onPid?: (pid: number) => void;
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
}
