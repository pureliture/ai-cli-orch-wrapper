## Why

`aco pack install`은 `templates/commands`와 `templates/prompts`(+`tasks`)만 `.claude/`로 복사하고, 스킬(`.claude/skills/`)은 npm 패키지에 동봉되지 않는다. 그 결과 `npx @pureliture/ai-cli-orch-wrapper pack install --global`만으로는 `/aco` 관련 스킬을 유저레벨에 설치하거나 버전업 시 갱신할 수 없고, 사용자는 repo를 직접 clone해야만 스킬을 받을 수 있다. clone 없이 npx 한 번으로 commands·prompts·skills를 함께 배포·갱신하는 경로가 필요하다.

## What Changes

- 큐레이션된 스킬 subset을 source of truth(`.claude/skills/`)에서 생성기로 복사한 `templates/skills/` 디렉터리를 신설하고, `files: ["dist","templates"]`를 통해 npm 패키지에 동봉한다.
- `aco pack install`/`pack setup`이 `--global` 모드에서만 `templates/skills/`를 `~/.claude/skills/`로 복사하도록 한다. non-global 모드는 스킬 복사를 skip한다(아래 BREAKING-인접 동작 참고).
- 설치된 스킬 파일을 `aco-manifest.json`에 기록하고 `pack uninstall`이 이를 선택적으로 제거하도록 manifest 계약을 확장한다.
- `templates/skills/` 내용이 `.claude/skills/`와 어긋나지 않도록 생성기 재실행 + `git diff --exit-code` 기반 parity 검사를 CI에 추가한다.
- packable 스킬 allowlist를 context-sync allowlist(`.aco/sync.yaml` include + `ACO_OWNED_SKILLS`)와 정합시켜 단일 기준에서 파생한다.

## Capabilities

### New Capabilities
- `pack-install-skill-distribution`: `aco pack install`이 큐레이션된 스킬을 유저레벨(`~/.claude/skills/`)로 배포·갱신·제거하는 동작, `--global` 전용 가드, manifest 추적, `templates/skills/` 생성·parity 계약을 정의한다.

### Modified Capabilities
<!-- 없음: 본 변경은 pack install 표면에 신규 동작을 추가하며, context-sync(aco sync)의 요구사항(spec-level behavior)은 바꾸지 않는다. sync allowlist와의 정합은 참조 관계일 뿐 sync 요구사항 변경이 아니다. -->

## Impact

- `packages/installer/src/commands/pack-install.ts`, `packages/wrapper/src/commands/pack-install.ts`: 스킬 복사 단계(`--global` 가드), manifest 기록/제거 확장.
- `packages/wrapper/package.json`: 신규 생성기 스크립트(예: `build:skill-templates`), `templates/`에 `skills/` 포함.
- `templates/skills/`: 신규 생성물(커밋 대상).
- CI 워크플로: 생성기 재실행 + `git diff --exit-code` parity gate.
- 테스트: `pack-runtime-contract`에 스킬 설치/skip/uninstall 경로 추가.
- 충돌 회피: non-global 실행 시 `cwd/.claude/skills/`(= `aco sync` read source)를 덮지 않음. `aco pack setup`이 내부에서 `runSync`를 연쇄 호출하므로(`pack-install.ts`) `--global` 가드가 없으면 sync source 오염 → `.agents/skills/` 자동 전파 회귀가 발생함.
