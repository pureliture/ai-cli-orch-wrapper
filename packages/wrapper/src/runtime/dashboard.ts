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

const HOST_ICON = '🟠';
const HOST_ICON_ASCII = '[HOST]';

/**
 * provider key를 ASCII 라벨로 매핑한다(`--no-unicode`/비-UTF-8 폴백).
 * 알려지지 않은 provider는 key 앞 2글자 대문자로 폴백한다.
 */
function asciiIconFor(providerKey: string): string {
  switch (providerKey) {
    case 'antigravity':
      return '[AG]';
    case 'codex':
      return '[CX]';
    case 'mock':
      return '[MC]';
    default:
      return `[${providerKey.slice(0, 2).toUpperCase()}]`;
  }
}

export interface RuntimeRollupEntry {
  context: RuntimeContext;
  /** provider가 선언한 색동그라미 이모지 아이콘(IProvider.icon). */
  icon: string;
}

export interface RuntimeRollupDashboardOptions {
  color?: boolean;
  /**
   * false면 색동그라미 이모지 대신 ASCII 라벨로 폴백한다.
   * `--no-unicode` 또는 비-UTF-8/유니코드 미지원 환경 감지 시 전달된다.
   * 기본값은 true(유니코드 사용).
   */
  unicode?: boolean;
}

/**
 * 멀티프로바이더 위임을 위한 롤업 대시보드를 렌더한다.
 *
 * 공통 정보(command·branch 등)를 롤업 헤더 1개로, 각 provider를 별도 행
 * (icon·provider·session·auth)으로 렌더한다. 단일 provider일 때도 동일 구조로
 * 헤더 1개 + 행 1개를 렌더한다(`aco ask` 경로 전용; `aco run`은 단일 렌더 유지).
 *
 * unicode가 false면 provider 아이콘과 host 헤더 아이콘을 ASCII 라벨로 폴백하고
 * 행 정렬을 유지한다.
 */
export function renderRuntimeRollupDashboard(
  entries: readonly RuntimeRollupEntry[],
  options: RuntimeRollupDashboardOptions = {}
): string {
  const color = isColorEnabled(options.color);
  const style = makeStyle(color);
  const useUnicode = options.unicode !== false;
  const hostGlyph = useUnicode ? HOST_ICON : HOST_ICON_ASCII;

  const rollupLabel = useUnicode ? '🛰️  Rollup' : 'Rollup';
  const warnPrefix = useUnicode ? '⚠️  ' : '';
  const headerTitle = `${hostGlyph}  aco Runtime Session`;
  const lines: string[] = [style.header(headerTitle), ''];

  // 롤업 헤더: command·branch 등 위임 공통 정보를 첫 entry 기준으로 한 번만 표시한다.
  const first = entries[0]?.context.active;
  if (first) {
    lines.push(
      style.label(rollupLabel),
      `  ${style.label('Command')}: ${style.value(first.command)}`,
      `  ${style.label('Working Dir')}: ${style.value(first.cwd)}`,
      `  ${style.label('Branch')}: ${style.value(formatValue(first.branch))}`,
      `  ${style.label('Permission')}: ${style.value(first.permissionProfile)}`,
      ''
    );
  }

  // provider별 행: icon + provider 헤더, 그 아래 session·auth.
  for (const entry of entries) {
    const active = entry.context.active;
    const glyph = useUnicode ? entry.icon : asciiIconFor(active.provider);
    const authSummary = formatAuthStatus(active.auth);
    const authText = active.auth.ok ? style.value(authSummary) : style.dim(authSummary);
    lines.push(
      `${glyph} ${style.label(active.provider)}`,
      `  ${style.label('Session ID')}: ${style.value(active.sessionId)}`,
      `  ${style.label('Auth')}: ${authText}`,
      ''
    );
  }

  // 미인증 provider가 하나라도 있으면 degraded 정책 안내를 덧붙인다.
  const unauthenticated = entries.filter((entry) => !entry.context.active.auth.ok);
  if (unauthenticated.length > 0) {
    const names = unauthenticated.map((entry) => entry.context.active.provider).join(', ');
    lines.push(
      style.dim(
        `${warnPrefix}Not authenticated: ${names}. Authenticated providers run in degraded mode; run: aco provider setup`
      )
    );
  }

  return lines.join('\n').replace(/\n+$/, '');
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
