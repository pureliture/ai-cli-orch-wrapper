## 1. manifest.ts — 마이그레이션 및 읽기 경로

- [x] 1.1 `readManifest` 시그니처에 `repoRoot: string` 파라미터 추가
- [x] 1.2 `migrateManifest`에 `repoRoot` 파라미터 추가하고, `targetHashes`/`targets` 키 중 `path.isAbsolute(key)`인 경우 `relative(repoRoot, key)`로 변환
- [x] 1.3 `readManifest` 호출부(`sync-engine.ts`)에서 `repoRoot` 인자 전달

## 2. sync-engine.ts — manifest 빌드(쓰기 경로)

- [x] 2.1 `computeTransformPlan` 내 AGENTS.md/GEMINI.md 섹션의 `targetHashes[agentsMdPath]`, `targets[agentsMdPath]` 할당을 `relative(repoRoot, agentsMdPath)` 키로 변경
- [x] 2.2 skills, Codex agents, Gemini agents, Codex hooks, Gemini hooks 각 섹션의 `targetHashes[o.targetPath]`, `targets[o.targetPath]` 할당을 `relative(repoRoot, o.targetPath)` 키로 변경 (총 5개 섹션)

## 3. sync-engine.ts — manifest 읽기 경로(conflict 탐지, action 결정, cleanup)

- [x] 3.1 conflict 탐지 루프에서 `existingManifest.targets[output.targetPath]` → `existingManifest.targets[relative(repoRoot, output.targetPath)]`로 수정 (line ~98)
- [x] 3.2 `existingManifest.targetHashes[output.targetPath]` 참조도 relative 키로 수정 (line ~99)
- [x] 3.3 action 결정 루프에서 `existingManifest?.targets[output.targetPath]` → relative 키로 수정 (line ~121–122)
- [x] 3.4 cleanup 로직에서 `cleanedOwned`/`cleanedForced` 경로가 어떤 형식인지 확인하고, `delete plan.manifest.targets[path]`/`targetHashes[path]`를 일관된 relative 키로 수정 (lines ~227–234)

## 4. 테스트

- [x] 4.1 `manifest.ts` 단위 테스트: 절대 경로 키를 가진 legacy manifest를 `readManifest`에 전달하면 relative 키로 변환되는지 검증
- [x] 4.2 `sync-engine.ts` 통합 테스트: 다른 `repoRoot` 값으로 `aco sync --check`를 실행했을 때 false positive drift가 발생하지 않는지 검증
- [x] 4.3 기존 fixture 테스트(`npm run test:fixtures`) 통과 확인

## 5. 검증

- [x] 5.1 `npm run typecheck` 통과
- [x] 5.2 `npm test` 통과
- [x] 5.3 `aco sync` 실행 후 `.aco/sync-manifest.json`에서 `targetHashes`/`targets` 키가 relative 경로인지 직접 확인
- [x] 5.4 `aco sync --check`가 재실행 시 exit 0 반환 확인
