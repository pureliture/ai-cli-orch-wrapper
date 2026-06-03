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

/**
 * stderr 대시보드를 렌더해야 하는지 판단한다(5.1 TTY 분리 대응).
 *
 * - 비-TTY(파이프/CI): `false` → 대시보드 프레임 완전 비활성화
 * - TTY + NO_COLOR: `true` → 색만 제거, 구조 유지
 * - TTY + 색 허용: `true`
 */
export function shouldRenderDashboard(opts: { isTTY: boolean; noColor: boolean }): boolean {
  return opts.isTTY;
}

/**
 * 현재 process 환경을 기반으로 대시보드 렌더 여부를 결정한다.
 * stderr.isTTY와 NO_COLOR 환경 변수를 확인한다.
 */
export function shouldRenderDashboardFromEnv(): boolean {
  const isTTY = process.stderr.isTTY === true;
  const noColor = process.env.NO_COLOR !== undefined;
  return shouldRenderDashboard({ isTTY, noColor });
}

/**
 * 대시보드 갱신 throttle/deadband 가드를 생성한다(5.2 throttle).
 *
 * `shouldRender(force?)`를 호출하면:
 * - `force === true`이면 deadband를 무시하고 항상 `true`를 반환한다.
 *   (P1 trailing-edge 보장: 마지막/강제 flush 렌더가 throttle에 걸려 최종 상태가
 *   영구 유실되는 것을 막는다.)
 * - 그 외에는 마지막 렌더로부터 `deadbandMs` 이내이면 `false`(억제),
 *   deadband 경과 후이면 `true`를 반환한다.
 *
 * 통과(`true`)할 때마다(force 포함) 내부 타임스탬프를 갱신하므로, 강제 flush 이후
 * 잦은 갱신은 다시 deadband로 억제된다.
 */
export function makeDashboardThrottleGuard(deadbandMs: number): {
  shouldRender: (force?: boolean) => boolean;
} {
  let lastRenderAt = -Infinity;
  return {
    shouldRender(force = false): boolean {
      const now = Date.now();
      if (!force && now - lastRenderAt < deadbandMs) return false;
      lastRenderAt = now;
      return true;
    },
  };
}

/**
 * locale 환경 변수를 검사해 UTF-8 지원 여부를 반환한다.
 * 4.6 배선: `--no-unicode` 플래그의 보조 locale 감지 경로에서 사용한다.
 *
 * 판정 규칙(POSIX 우선순위 `LC_ALL` > `LC_CTYPE` > `LANG`):
 * - 우선순위 순으로 첫 번째로 설정된(빈 문자열이 아닌) 변수만 본다.
 *   그 값에 "utf-8"/"utf8"(대소문자 무관)가 있으면 `true`, 없으면 `false`.
 *   예: `LC_ALL=C`로 명시적으로 끄면 `LANG=...UTF-8`이 있어도 `false`.
 * - 셋 모두 미설정이면 `true`(안전한 기본값: UTF-8 지원 가정).
 */
export function isUnicodeLocale(env: Record<string, string | undefined>): boolean {
  const effective = [env['LC_ALL'], env['LC_CTYPE'], env['LANG']].find(
    (v): v is string => typeof v === 'string' && v.length > 0
  );
  if (effective === undefined) return true; // locale 정보 없음 → UTF-8 가정
  return /utf-?8/i.test(effective);
}

/**
 * process.env 기반으로 UTF-8 locale 여부를 판단한다.
 */
export function isUnicodeLocaleFromEnv(): boolean {
  return isUnicodeLocale({
    LC_ALL: process.env.LC_ALL,
    LC_CTYPE: process.env.LC_CTYPE,
    LANG: process.env.LANG,
  });
}

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
        `${warnPrefix}Not authenticated: ${names}. These providers are skipped; the run continues in degraded mode with the authenticated providers. To enable them, run: aco provider setup`
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
