import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import type { AuthResult } from './interface.js';
import type { IProvider } from './interface.js';

const AUTH_CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_PATH = resolve(homedir(), '.aco', 'provider-auth-cache.json');

type AuthCacheRecord = {
  checkedAt: number;
  provider: string;
  auth: AuthResult;
};

type AuthCache = Record<string, AuthCacheRecord>;

function readCache(): Promise<AuthCache> {
  return readFile(CACHE_PATH, 'utf8')
    .then((raw) => {
      const parsed = JSON.parse(raw) as AuthCache;
      return parsed ?? {};
    })
    .catch(() => ({}));
}

async function writeCache(cache: AuthCache): Promise<void> {
  await mkdir(dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2), { mode: 0o600 });
}

function isFresh(entry: AuthCacheRecord | undefined, now: number, ttlMs: number): boolean {
  if (!entry) return false;
  return now - entry.checkedAt < ttlMs;
}

export interface GetCachedAuthOptions {
  ttlMs?: number;
}

export async function getCachedProviderAuth(
  provider: IProvider,
  options: GetCachedAuthOptions = {}
): Promise<AuthResult> {
  const { ttlMs = AUTH_CACHE_TTL_MS } = options;
  const now = Date.now();

  const cache = await readCache();
  const key = provider.key;
  const entry = cache[key];

  if (isFresh(entry, now, ttlMs) && entry.provider === provider.key) {
    return entry.auth;
  }

  const auth = await provider.checkAuth();
  cache[key] = {
    provider: provider.key,
    checkedAt: now,
    auth,
  };

  await writeCache(cache).catch(() => undefined);
  return auth;
}
