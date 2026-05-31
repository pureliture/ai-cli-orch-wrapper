import { basename } from 'node:path';

/**
 * Patterns that identify credential-like file paths.
 * Checked against the basename and full normalized path.
 */
const CREDENTIAL_PATTERNS: RegExp[] = [
  /^\.env(\.[^/]+)?$/, // .env, .env.local, .env.production, etc.
  /^auth\.json$/, // OAuth token files
  /(?:^|[_-])cred(?:s|entials)?\.json$/i, // credentials.json, *_credentials.json, *_creds.json
  /^(id_rsa|id_ed25519|id_dsa|id_ecdsa)$/, // SSH private keys
  /\.(pem|key)$/i, // TLS/cert private keys
  /\.(pfx|p12)$/i, // PKCS#12 bundles
  /^secrets?\.(json|ya?ml)$/i, // secrets.json, secrets.yaml, secrets.yml
];

/**
 * Well-known full relative-path credential files (matched against the normalized path).
 */
const CREDENTIAL_PATHS: RegExp[] = [
  /(?:^|\/)\.codex\/auth\.json$/,
];

/**
 * Returns true if the given file path looks like a credential or secret file.
 */
export function isCredentialLikePath(filePath: string): boolean {
  const name = basename(filePath);
  for (const pattern of CREDENTIAL_PATTERNS) {
    if (pattern.test(name)) return true;
  }
  const normalized = filePath.replace(/\\/g, '/');
  for (const pattern of CREDENTIAL_PATHS) {
    if (pattern.test(normalized)) return true;
  }
  return false;
}

/**
 * Credential-like environment variable key suffixes.
 */
const CREDENTIAL_ENV_SUFFIXES = [
  '_TOKEN',
  '_KEY',
  '_SECRET',
  '_API_KEY',
  '_PASSWORD',
  'PRIVATE_KEY',
];

/**
 * Returns the list of environment variable keys that appear credential-like.
 */
export function findCredentialEnvKeys(env: Record<string, string | undefined>): string[] {
  return Object.keys(env).filter((key) =>
    CREDENTIAL_ENV_SUFFIXES.some((suffix) => key.toUpperCase().endsWith(suffix))
  );
}
