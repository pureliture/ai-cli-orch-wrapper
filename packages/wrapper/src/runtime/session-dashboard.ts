import { collectRuntimeContext, type RuntimeContextInput } from './context.js';
import { renderRuntimeDashboard } from './dashboard.js';
import type { RuntimeContext } from './types.js';

/**
 * 대시보드 렌더에 필요한 최소 세션 식별 정보.
 *
 * `aco run`은 단일 세션, `aco ask`는 provider별 세션 리스트를 만든다. U5에서는
 * 둘 다 단일/현행 구조로 대시보드를 렌더하므로 공통 seam만 마련한다. 멀티세션
 * 롤업은 U7에서 이 타입을 확장해 처리한다.
 */
export interface RuntimeSessionLike {
  id: string;
  provider: string;
}

/**
 * 세션 리스트에서 대표(primary) 세션을 고른다.
 *
 * U5에서는 단일 세션 접근부(대시보드·persist·취소)가 회귀 없이 동작하도록 하는
 * 하위호환 헬퍼다. 현재는 첫 세션을 반환하며, U7에서 멀티세션 롤업으로 전환할 때
 * 단일 접근부가 이 seam을 통해 일관되게 동작하도록 한다.
 */
export function getPrimarySession<T extends RuntimeSessionLike>(
  sessions: readonly T[]
): T | undefined {
  return sessions[0];
}

export interface EmitRuntimeDashboardSink {
  write: (chunk: string) => void;
  /** renderRuntimeDashboard의 색상 강제 옵션을 그대로 전달한다. */
  color?: boolean;
}

/**
 * 런타임 컨텍스트를 수집해 'aco Runtime Session' 대시보드를 sink(기본 stderr)에
 * 렌더한다. `aco run`과 `aco ask`가 공유하는 커널 진입점이다.
 *
 * 수집된 RuntimeContext를 반환하므로, 호출부는 세션 store에 persist하는 등의
 * 후속 처리를 이어갈 수 있다.
 */
export async function emitRuntimeDashboard(
  input: RuntimeContextInput,
  sink: EmitRuntimeDashboardSink = { write: (chunk) => process.stderr.write(chunk) }
): Promise<RuntimeContext> {
  const context = await collectRuntimeContext(input);
  const dashboard = renderRuntimeDashboard(
    context,
    sink.color !== undefined ? { color: sink.color } : {}
  );
  sink.write(dashboard + '\n');
  return context;
}
