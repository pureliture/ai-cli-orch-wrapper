## Why

현재 `aco ask --output-mode brief` 출력은 provider 상태와 파일 경로만 출력되어, 사용자가 실제 결과를 확인하려면 매번 `aco result`를 추가로 실행해야 하는 번거로움이 있습니다. 이는 토큰을 절약하면서도 핵심 요약을 전달하려는 'bounded brief' MVP의 원래 의도와 부합하지 않습니다. 세션별 outputLog의 핵심 내용을 brief 모드에 포함하여 워크플로우를 개선하고자 합니다.

## What Changes

- `renderRunBrief` 및 `renderSessionBrief` 함수가 세션 outputLog에서 bounded 요약(예: 최초 N바이트 또는 구조화된 상태 요약)을 추출하여 brief 출력에 포함하도록 수정합니다.
- 토큰을 절약하는 원래 목적을 유지하면서도 사용자에게 필수적인 정보를 전달하는 균형을 맞춥니다.
- 기존 테스트가 통과하도록 하위 호환성을 유지합니다.

## Capabilities

### New Capabilities
- `aco-ask-brief-summary`: `aco ask --output-mode brief` 실행 시 세션별 bounded 요약을 포함하여 출력하는 기능.

### Modified Capabilities

## Impact

- `packages/wrapper/src/commands/ask.ts` 파일의 UI 렌더링 로직(`renderRunBrief`, `renderSessionBrief`).
- CLI 사용자의 경험: `aco ask --output-mode brief` 사용 시 `aco result`를 실행하지 않아도 provider 응답의 주요 내용을 즉시 확인할 수 있습니다.
