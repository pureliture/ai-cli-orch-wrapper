import { terminateProviderProcess } from './provider-process.js';
import { DEFAULT_PROVIDER_KILL_GRACE_MS } from './provider-execution-control.js';

/**
 * 진행 중인 provider 실행의 취소 대상 상태.
 * activePid/sessionId는 provider 실행 루프에서 변경되며, 핸들러는 호출 시점의
 * 최신 값을 참조한다 (참조 공유 객체).
 */
export interface ProviderCancellationState {
  /** 현재 실행 중인 자식 provider 프로세스의 PID. 실행 전/후에는 undefined. */
  activePid: number | undefined;
  /** 현재 진행 중인 세션 ID. 실행 전에는 undefined. */
  sessionId: string | undefined;
}

export interface ProviderCancellationHandlerDeps {
  state: ProviderCancellationState;
  /** 자식 프로세스 종료 함수. 기본값은 terminateProviderProcess. */
  terminate?: (pid: number, signal: NodeJS.Signals) => boolean;
  /** 세션을 cancelled 상태로 기록한다. */
  markCancelled: (sessionId: string) => Promise<void>;
  /** 종료 함수. 기본값은 process.exit(1). 테스트에서 주입해 종료를 막는다. */
  exit?: (code: number) => void;
  /**
   * SIGTERM 후 SIGKILL escalation까지의 grace(ms).
   * 미지정 시 env ACO_KILL_GRACE_MS, 그다음 DEFAULT_PROVIDER_KILL_GRACE_MS.
   */
  killGraceMs?: number;
  /**
   * grace 만료 후 SIGKILL을 보낼 콜백을 예약하는 seam.
   * 기본값은 setTimeout. 테스트에서 주입해 escalation 타이머를 제어한다.
   */
  scheduleKill?: (callback: () => void, delayMs: number) => unknown;
}

const EXIT_ERROR = 1;

function resolveKillGraceMs(explicit: number | undefined): number {
  if (explicit !== undefined) return explicit;
  const fromEnv = process.env.ACO_KILL_GRACE_MS;
  if (fromEnv !== undefined) {
    const parsed = Number(fromEnv);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return DEFAULT_PROVIDER_KILL_GRACE_MS;
}

/**
 * SIGINT/SIGTERM 수신 시 진행 중인 provider 자식 프로세스를 graceful하게 정리하고
 * 세션을 cancelled로 기록한 뒤 프로세스를 종료하는 핸들러를 만든다.
 *
 * P1a (고아 leak) 방지: 받은 신호를 그대로 전파하지 않고 항상 SIGTERM(graceful)을
 * 먼저 보낸 뒤, killGrace 후에도 핸들러 컨텍스트가 살아있으면 SIGKILL로 escalate한다
 * (timeout 경로의 SIGTERM→grace→SIGKILL 패턴과 동일).
 *
 * - activePid가 있으면 SIGTERM을 보내고, grace 후 SIGKILL을 예약한다.
 * - sessionId가 있으면 markCancelled로 세션을 취소 상태로 기록한다.
 * - markCancelled 완료 또는 grace+SIGKILL 후 exit(1)로 종료한다.
 *
 * cmdRun의 기존 signal 처리 패턴을 공통화한 형태다.
 */
export function createProviderCancellationHandler(
  deps: ProviderCancellationHandlerDeps
): (signal: NodeJS.Signals) => void {
  const terminate = deps.terminate ?? terminateProviderProcess;
  const exit = deps.exit ?? ((code: number) => process.exit(code));
  const scheduleKill =
    deps.scheduleKill ??
    ((callback: () => void, delayMs: number) => setTimeout(callback, delayMs).unref?.());
  const killGraceMs = resolveKillGraceMs(deps.killGraceMs);

  let handled = false;

  return (_signal: NodeJS.Signals): void => {
    // 중복 신호(SIGINT 후 SIGTERM 등)에 대해 종료 절차를 한 번만 수행한다.
    if (handled) return;
    handled = true;

    const { activePid, sessionId } = deps.state;

    // 종료 조건: 세션 기록(markCancelled)과 자식 정리(SIGKILL escalation 또는 자식 없음)가
    // 모두 끝난 뒤에만 exit한다. exit가 자식 정리보다 먼저 일어나면 고아가 남는다(P1a).
    let cleanupDone = activePid === undefined;
    let ledgerDone = sessionId === undefined;
    const maybeExit = (): void => {
      if (cleanupDone && ledgerDone) {
        exit(EXIT_ERROR);
      }
    };

    if (activePid !== undefined) {
      // P1a: graceful 종료를 먼저 시도한다 (raw 신호가 아닌 SIGTERM).
      terminate(activePid, 'SIGTERM');
      // grace 후에도 자식이 남아 있으면 SIGKILL로 escalate한 뒤에야 종료를 허용한다.
      scheduleKill(() => {
        terminate(activePid, 'SIGKILL');
        cleanupDone = true;
        maybeExit();
      }, killGraceMs);
    }

    if (sessionId !== undefined) {
      deps.markCancelled(sessionId).finally(() => {
        ledgerDone = true;
        maybeExit();
      });
    }

    // 자식도 세션도 없으면(실행 전 시그널) 즉시 종료한다.
    maybeExit();
  };
}

export interface ProviderCancellationHandle {
  /** SIGINT/SIGTERM 리스너를 해제한다. 여러 번 호출해도 안전하다. */
  dispose(): void;
}

/**
 * createProviderCancellationHandler로 만든 핸들러를 SIGINT/SIGTERM에 등록하고,
 * 해제용 dispose를 반환한다 (register/cleanup 쌍).
 *
 * P2a (listener 누수) 방지: 호출처는 finally에서 dispose를 호출해 리스너 누적을
 * 막아야 한다. dispose는 idempotent하다.
 */
export function installProviderCancellationHandler(
  deps: ProviderCancellationHandlerDeps
): ProviderCancellationHandle {
  const handler = createProviderCancellationHandler(deps);
  process.on('SIGINT', handler);
  process.on('SIGTERM', handler);

  let disposed = false;
  return {
    dispose(): void {
      if (disposed) return;
      disposed = true;
      process.off('SIGINT', handler);
      process.off('SIGTERM', handler);
    },
  };
}
