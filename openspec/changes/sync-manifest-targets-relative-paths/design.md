## Context

`sync-engine.ts`의 `computeTransformPlan`은 manifest를 빌드할 때 `output.targetPath`(절대 경로)를 그대로 `targetHashes`/`targets` 키로 사용한다. `sourceHashes`는 이미 PR #117에서 relative 경로로 전환됐으나, target 키는 절대 경로를 유지해 체크아웃 경로가 달라지면(다른 CI 에이전트, clone 위치 변경 등) drift 오탐이 발생한다.

영향 범위:
- `computeTransformPlan` 내 6개 섹션의 `targetHashes[o.targetPath]`, `targets[o.targetPath]` 할당 (lines 351–439)
- `runSync`의 conflict 탐지 및 action 결정 로직에서 `existingManifest.targets[output.targetPath]` 읽기 (lines 98–122)
- `runSync`의 cleanup 로직에서 `delete plan.manifest.targets[path]` (lines 227–234) — `path`는 현재 어디서 오는가에 따라 달라짐
- `manifest.ts`의 `migrateManifest` — v1 절대 경로 manifest를 v2로 올릴 때도 키가 절대 경로 그대로 유지됨

## Goals / Non-Goals

**Goals:**
- `targetHashes`/`targets` 키를 `relative(repoRoot, targetPath)`로 저장
- 읽기 경로(conflict 탐지, action 결정, cleanup)에서 `resolve(repoRoot, relKey)`로 절대 경로 복원
- `migrateManifest`에서 기존 절대 경로 키를 자동으로 상대 경로로 전환
- `calculateDrift`가 일관된 경로 형식(상대)으로 비교하도록 보장

**Non-Goals:**
- `SyncManifest` 타입 인터페이스 변경 없음 (키 형식은 런타임 계약이므로 타입에 별도 인코딩 불필요)
- `sourceHashes` 경로 처리 변경 없음 (이미 relative)
- `output.targetPath` 자체를 바꾸지 않음 — 내부 작업 중에는 절대 경로 유지, manifest 직렬화 시점에만 변환

## Decisions

### D1. 변환 위치: 빌드 시점 vs. 직렬화 시점

`computeTransformPlan` 내부의 `targetHashes`/`targets` 빌드 직후 변환한다 (빌드 시점). `writeManifest`나 `calculateDrift`에서 변환하는 대안보다 변환 책임이 한 곳에 집중되어 읽기 경로에서 어떤 형식을 기대하는지 명확하다.

**대안 고려**: `writeManifest`에서 직렬화 시 변환 → 읽기 경로도 변환 필요하지만 `readManifest`에서 복원하면 되므로 가능하나, `computeTransformPlan`이 내부적으로 절대/상대 섞인 구조를 만들어 코드 추적이 어려워짐.

### D2. 읽기 경로의 경로 복원

`runSync`에서 `existingManifest.targets[output.targetPath]`를 읽기 전에 `output.targetPath`에 대응하는 manifest 키를 얻으려면 `relative(repoRoot, output.targetPath)`를 키로 사용해야 한다. 모든 읽기 접근을 헬퍼 함수로 래핑한다:

```ts
function resolveManifestKey(repoRoot: string, absolutePath: string): string {
  return relative(repoRoot, absolutePath);
}
```

이 헬퍼를 사용하면 절대/상대 혼용 접근이 컴파일 타임에 드러나지 않더라도 단일 경로를 통해 일관성이 보장된다.

### D3. migrateManifest에서의 자동 마이그레이션

v1 manifest의 `targetHashes` 키가 절대 경로인지 판별하여 상대 경로로 전환한다. 판별 기준: `path.isAbsolute(key)`. `repoRoot`를 `migrateManifest`에 전달하여 `relative(repoRoot, key)`를 수행한다. `readManifest`가 `repoRoot`를 받으므로 시그니처 변경 최소화.

### D4. calculateDrift 경로 일관성

`calculateDrift`는 두 manifest를 비교하므로 현재 manifest(relative)와 기존 manifest(마이그레이션 후 relative)가 동일한 형식이면 추가 변환 불필요. 마이그레이션이 `readManifest`에서 보장되므로 `calculateDrift`는 변경 없음.

## Risks / Trade-offs

- **기존 absolute manifest와의 호환성** → `migrateManifest`에서 `path.isAbsolute` 체크로 자동 전환. 롤백 시 이전 버전이 상대 경로 manifest를 읽으면 키를 찾지 못해 `targetHashes` 빈 객체로 처리(= 모든 타겟을 신규로 인식). full `aco sync`를 한 번 실행하면 복구됨.
- **경로 구분자(Windows)** → repo는 macOS/Linux only. `relative()`/`resolve()`가 POSIX 경로를 반환하므로 문제 없음.
- **cleanup 로직의 `path` 변수** → `cleanedOwned`/`cleanedForced`에 담긴 경로가 현재 어떤 형식인지 확인 필요. 읽기 경로에서 relative 키를 사용하면 delete도 relative 키로 수행되므로 일관성 유지.

## Migration Plan

1. `computeTransformPlan` 내 `targetHashes`/`targets` 할당 시 relative 경로로 전환
2. `readManifest` → `migrateManifest` 시그니처에 `repoRoot` 추가, 절대 경로 키 감지 및 전환
3. `runSync`의 manifest 읽기 경로를 relative 키 기반으로 수정
4. 기존 `.aco/sync-manifest.json`은 `aco sync` 한 번 실행으로 자동 재생성 (또는 `readManifest` 시 마이그레이션으로 투명하게 처리)

롤백: `git revert` 후 `aco sync`로 manifest 재생성.

## Open Questions

없음.
