## Why

`aco run`과 일부 provider 연동 경로에서 출력이 메모리에 축적되면 대형 응답 처리 시 OOM이 발생할 수 있습니다.
특히 스트리밍 응답을 다루는 장시간 작업에서 출력 버퍼링 방식을 기본으로 통제하지 않으면 안정적으로 장시간 실행을 보장하기 어렵습니다.

## What Changes

- `aco` provider 호출 경로에 출력 버퍼링 정책을 명시적으로 주입할 수 있는 옵션을 추가합니다.
- 버퍼링 정책을 기본적으로는 스트리밍 중심(`bounded`/`disabled` 전환 가능)으로 두고, 필요한 호출만 제한된 메모리 버퍼를 사용하도록 합니다.
- 출력 버퍼링을 요구하는 호출자는 실제로 필요한 경우에만 버퍼링을 활성화하고, 기본 흐름은 대량 출력 시 메모리 압박을 일으키지 않도록 유지합니다.

## Capabilities

### New Capabilities

- `provider-output-buffering-control`: Provider invoke 실행 시 호출자 기준 출력 버퍼링 정책(비활성/제한/전체)을 설정하고 상한을 제어한다.

### Modified Capabilities

- (변경 없음)

## Impact

- `packages/wrapper/src/providers/interface.ts`: provider 호출 옵션에 출력 버퍼링 정책/상한 전달 파라미터 추가.
- `packages/wrapper/src/util/spawn-stream.ts`: 대량 출력의 기본 메모리 증가를 방지할 수 있도록 버퍼링 모드 제어 로직 반영.
- `packages/wrapper/src/cli.ts`: `aco run` provider 호출에서 기본 정책을 안전 모드(메모리 제한)로 정렬.
- `packages/wrapper/src/commands/ask.ts`: `aco ask`의 호출 경로(필요 시)에서 전체 출력이 아닌 제한 버퍼링 전략으로 동작하도록 정합성 확보.
