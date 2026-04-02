export type PermissionProfile = 'default' | 'restricted' | 'unrestricted';

export interface AuthResult {
  ok: boolean;
  hint?: string;
}

export interface InvokeOptions {
  permissionProfile?: PermissionProfile;
  sessionId?: string;
}

export interface IProvider {
  readonly key: string;
  readonly installHint: string;

  isAvailable(): boolean;
  checkAuth(): Promise<AuthResult>;
  buildArgs(command: string, options?: InvokeOptions): string[];
  invoke(prompt: string, content: string, options?: InvokeOptions): AsyncIterable<string>;
}
