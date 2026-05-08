import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import type { AuthResult } from './interface.js';
import type { IProvider } from './interface.js';

const AUTH_CACHE_TTL_MS = 5 * 60 * 1000;

type AuthCacheRecord = {
  checkedAt: number;
  provider: string;
  auth: AuthResult;
};

type AuthCache = Record<string, AuthCacheRecord>;

function cachePath(): string {
  return resolve(homedir(), '.aco', 'provider-auth-cache.json');
}

function readCache(path: string): Promise<AuthCache> {
  return readFile(path, 'utf8')
    .then((raw) => {
      const parsed = JSON.parse(raw) as AuthCache;
      return parsed ?? {};
    })
    .catch(() => ({}));
}

async function writeCache(path: string, cache: AuthCache): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(cache, null, 2), { mode: 0o600 });
}

function isFresh(entry: AuthCacheRecord | undefined, now: number, ttlMs: number): boolean {
  if (!entry) return false;
  return now - entry.checkedAt < ttlMs;
}

export interface GetCachedAuthOptions {
  ttlMs?: number;
  skipCache?: boolean;
}

export async function getCachedProviderAuth(
  provider: IProvider,
  options: GetCachedAuthOptions = {}
): Promise<AuthResult> {
  const { ttlMs = AUTH_CACHE_TTL_MS, skipCache = false } = options;
  const now = Date.now();

  const path = cachePath();
  const cache = await readCache(path);
  const key = provider.key;
  const entry = cache[key];

  if (!skipCache && isFresh(entry, now, ttlMs) && entry.provider === provider.key) {
    return entry.auth;
  }

  const auth = await provider.checkAuth();
  cache[key] = {
    provider: provider.key,
    checkedAt: now,
    auth,
  };

  await writeCache(path, cache).catch(() => undefined);
  return auth;
}
