import type { AuthResult, PermissionProfile } from '../providers/interface.js';

export interface RuntimeActiveContext {
  provider: string;
  command: string;
  sessionId: string;
  permissionProfile: PermissionProfile;
  cwd: string;
  branch?: string;
  promptTemplatePath?: string;
  auth: AuthResult;
}

export interface RuntimeExposedContext {
  sharedSkills: string[];
  providerAgents: string[];
  providerHooks: string[];
  providerConfigFiles: string[];
  provider: string;
}

export interface RuntimeContext {
  active: RuntimeActiveContext;
  exposed: RuntimeExposedContext;
}
