/**
 * CLI surface helpers
 *
 * Centralizes public command metadata and user-visible formatting.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AcoConfig } from './config/aco-config.js';

export const CANONICAL_COMMAND = 'aco';
export const LEGACY_COMMAND = 'wrapper';
export const BUILTIN_COMMANDS = ['setup', 'help', 'version', 'workflow', 'workflow-run', 'alias'];

interface PackageMetadata {
  version?: string;
}

function readPackageMetadata(): PackageMetadata {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const packageJsonPath = join(moduleDir, '..', 'package.json');
  const raw = readFileSync(packageJsonPath, 'utf8');
  return JSON.parse(raw) as PackageMetadata;
}

export function getPackageVersion(): string {
  return readPackageMetadata().version ?? '0.0.0';
}

export function formatVersionLine(): string {
  return `${CANONICAL_COMMAND} v${getPackageVersion()}`;
}

export function formatHelp(config: AcoConfig): string {
  const aliasLines = Object.keys(config.aliases)
    .filter(name => !BUILTIN_COMMANDS.includes(name))
    .map(name => `  ${name.padEnd(8)} Launch ${config.aliases[name].provider} via cao`)
    .join('\n');

  return `
${CANONICAL_COMMAND} - AI CLI orchestration environment setup

Usage: ${CANONICAL_COMMAND} <command>

Commands:
  setup        Bootstrap the AI CLI orchestration environment
  help         Show this help
  version      Show version
  workflow     Run named workflow from .wrapper.json
  workflow-run Run ad-hoc workflow with runtime overrides
${aliasLines ? '\nAliases:\n' + aliasLines : ''}
`;
}

export function formatUseCanonicalCommand(nextStep: 'help' | 'setup'): string {
  return `Use ${CANONICAL_COMMAND} ${nextStep}.`;
}

export function selectRecoveryNextStep(command?: string): 'help' | 'setup' {
  return command === 'setup' ? 'setup' : 'help';
}

export function formatUnknownCommand(command?: string): string {
  const detail = command
    ? `Error: unknown command '${command}'`
    : 'Error: missing command';

  return `${detail}\n${formatUseCanonicalCommand(selectRecoveryNextStep(command))}`;
}
