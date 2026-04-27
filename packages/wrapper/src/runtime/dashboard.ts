import type { RuntimeContext } from './types.js';
import { formatAuthStatus } from './auth-display.js';

interface RenderStyle {
  header: (value: string) => string;
  label: (value: string) => string;
  value: (value: string) => string;
  dim: (value: string) => string;
}

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

const DEFAULT_MAX_LIST = 16;

function isColorEnabled(forceColor?: boolean): boolean {
  if (forceColor === true) return true;
  if (forceColor === false) return false;
  if (!process.stderr.isTTY) return false;
  if (process.env.NO_COLOR !== undefined) return false;
  if (process.env.CI) return false;
  return true;
}

function makeStyle(enableColor: boolean): RenderStyle {
  if (!enableColor) {
    return {
      header: (value) => value,
      label: (value) => value,
      value: (value) => value,
      dim: (value) => value,
    };
  }
  return {
    header: (value) => `${BOLD}${CYAN}${value}${RESET}`,
    label: (value) => `${BOLD}${value}${RESET}`,
    value: (value) => `${GREEN}${value}${RESET}`,
    dim: (value) => `${DIM}${value}${RESET}`,
  };
}

function formatValue(value: string | string[] | undefined): string {
  if (!value) return '—';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'none';
    return value.slice(0, DEFAULT_MAX_LIST).join(', ');
  }
  return value;
}

export interface RuntimeDashboardOptions {
  color?: boolean;
}

export function renderRuntimeDashboard(
  context: RuntimeContext,
  options: RuntimeDashboardOptions = {}
): string {
  const color = isColorEnabled(options.color);
  const style = makeStyle(color);

  const authSummary = formatAuthStatus(context.active.auth);

  const lines = [
    style.header('🛰️  aco Runtime Session'),
    '',
    style.label('✨ Active'),
    `  ${style.label('Provider')}: ${style.value(context.active.provider)}`,
    `  ${style.label('Command')}: ${style.value(context.active.command)}`,
    `  ${style.label('Session ID')}: ${style.value(context.active.sessionId)}`,
    `  ${style.label('Permission')}: ${style.value(context.active.permissionProfile)}`,
    `  ${style.label('Working Dir')}: ${style.value(context.active.cwd)}`,
    `  ${style.label('Branch')}: ${style.value(formatValue(context.active.branch))}`,
    `  ${style.label('Prompt Template')}: ${style.value(formatValue(context.active.promptTemplatePath))}`,
    `  ${style.label('Auth')}: ${style.value(authSummary)}`,
  ];
  const sharedText = formatValue(context.exposed.sharedSkills);
  const providerAgents = formatValue(context.exposed.providerAgents);
  const providerHooks = formatValue(context.exposed.providerHooks);
  const providerConfig = formatValue(context.exposed.providerConfigFiles);

  lines.push(
    '',
    style.label('🧩 Exposed'),
    `  ${style.label('Providers')}: ${style.value(context.exposed.provider)}`,
    `  ${style.label('Agents')}: ${style.value(providerAgents)}`,
    `  ${style.label('Hooks')}: ${style.value(providerHooks)}`,
    `  ${style.label('Config')}: ${style.value(providerConfig)}`,
    `  ${style.label('Shared Skills')}: ${style.value(sharedText)}`
  );

  if (color && !context.active.auth.ok) {
    lines.push('', `${style.dim('⚠️  Provider is not authenticated; run: aco provider setup')}`);
  } else if (color) {
    lines.push('', `${style.dim('✅ Session context loaded')}`);
  }

  return lines.join('\n');
}
