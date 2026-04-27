import { basename } from 'node:path';
import type { AuthResult } from '../providers/interface.js';

function appendMethod(parts: string[], value?: string): void {
  if (!value) return;
  parts.push(value);
}

function appendVersion(parts: string[], value?: string): void {
  if (!value) return;
  parts.push(`v${value}`);
}

function appendBinaryPath(parts: string[], value?: string): void {
  if (!value) return;
  const base = basename(value);
  if (!base) return;
  parts.push(`bin ${base}`);
}

function formatReadyLabel(auth: AuthResult): string {
  const parts: string[] = [];
  appendMethod(parts, auth.method);
  appendVersion(parts, auth.version);
  appendBinaryPath(parts, auth.binaryPath);
  return parts.length > 0 ? `ready (${parts.join(', ')})` : 'ready';
}

function formatNotReadyLabel(auth: AuthResult): string {
  return auth.hint ? `not ready (${auth.hint})` : 'not ready';
}

export function formatAuthStatus(auth: AuthResult): string {
  return auth.ok ? formatReadyLabel(auth) : formatNotReadyLabel(auth);
}
