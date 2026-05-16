## Why

`aco sync --check`가 체크아웃 경로에 따라 drift 오탐을 발생시킨다. PR #117에서 `sourceHashes`는 repo-relative 경로로 전환됐으나 `targetHashes`/`targets` 키는 절대 경로(`output.targetPath`)로 유지되어, CI 환경이나 다른 머신에서 체크아웃 위치가 달라지면 동일한 파일도 변경된 것으로 잘못 감지된다.

## What Changes

- `sync-engine.ts`에서 manifest를 빌드할 때 `targetHashes`/`targets` 키를 `relative(repoRoot, targetPath)`로 변환하여 저장
- `sync-engine.ts`에서 manifest를 읽을 때 (drift 체크, conflict 탐지, cleanup) 상대 경로를 `resolve(repoRoot, path)`로 절대 경로로 복원
- `manifest.ts`의 `calculateDrift`가 상대 경로 키를 올바르게 비교할 수 있도록 일관된 경로 형식 보장
- 기존 절대 경로 manifest에 대한 자동 마이그레이션 경로 제공 (`migrateManifest` 함수 확장)

## Capabilities

### New Capabilities

- `manifest-portable-keys`: manifest의 `targetHashes`/`targets` 키를 repo-relative 경로로 저장·복원하는 메커니즘. 체크아웃 경로가 달라져도 일관된 drift 결과를 보장한다.

### Modified Capabilities

없음. 기존 스펙(`openspec/specs/aco-v2-spec.md`)에는 manifest 키 형식에 대한 명시적 요구사항이 없으므로 spec-level 요구사항 변경 없음.

## Impact

- `packages/wrapper/src/sync/sync-engine.ts`: manifest 빌드 로직(7곳 이상의 `targetPath` 할당) 및 읽기 로직(drift 체크, conflict 탐지, cleanup)
- `packages/wrapper/src/sync/manifest.ts`: `migrateManifest` 함수 — 절대 경로 기존 manifest를 상대 경로로 자동 변환
- `.aco/sync-manifest.json`: 기록 형식 변경 (절대 → 상대 경로). 기존 manifest는 마이그레이션으로 자동 처리
- 외부 API 없음; `aco sync`, `aco sync --check` CLI 동작의 정확성 개선
