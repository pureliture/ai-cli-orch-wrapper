import { terminateProviderProcess } from './provider-process.js';

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
}

const EXIT_ERROR = 1;

/**
 * SIGINT/SIGTERM 수신 시 진행 중인 provider 자식 프로세스를 정리하고
 * 세션을 cancelled로 기록한 뒤 프로세스를 종료하는 핸들러를 만든다.
 *
 * - activePid가 있으면 받은 시그널을 그대로 자식에게 전파한다.
 * - sessionId가 있으면 markCancelled로 세션을 취소 상태로 기록한다.
 * - 정리/기록 후 exit(1)로 종료한다 (markCancelled 성공/실패와 무관하게 종료).
 *
 * cmdRun의 기존 signal 처리 패턴을 공통화한 형태다.
 */
export function createProviderCancellationHandler(
  deps: ProviderCancellationHandlerDeps
): (signal: NodeJS.Signals) => void {
  const terminate = deps.terminate ?? terminateProviderProcess;
  const exit = deps.exit ?? ((code: number) => process.exit(code));

  return (signal: NodeJS.Signals): void => {
    const { activePid, sessionId } = deps.state;

    if (activePid !== undefined) {
      terminate(activePid, signal);
    }

    if (sessionId !== undefined) {
      deps.markCancelled(sessionId).finally(() => {
        exit(EXIT_ERROR);
      });
    } else {
      // 실행 전 시그널: 기록할 세션이 없으므로 즉시 종료한다.
      exit(EXIT_ERROR);
    }
  };
}
