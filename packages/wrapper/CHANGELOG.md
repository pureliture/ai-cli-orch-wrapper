# @pureliture/ai-cli-orch-wrapper

## 0.7.0

### Minor Changes

- 2657594: Add `ACO_HOME` env var to relocate the aco data root.

  aco previously hardcoded its data root to `~/.aco`, so dev/test runs (e.g.
  `aco ask --task test --providers mock`) wrote run ledgers into the developer's
  real `~/.aco`, mixing throwaway mock runs into actual usage history. Setting
  `ACO_HOME` now redirects all aco state — runs, sessions, agy-workspace, and the
  provider-auth-cache — to the given directory. When unset, behavior is unchanged
  (`~/.aco`). The test suite uses this to keep `npm test` from polluting `~/.aco`.

## 0.6.0

### Minor Changes

- 78c94eb: aco 위임 런타임을 host UX에 노출: `aco ask`에 `--runtime-banner` 추가 — 비-TTY host(Claude `/aco`, Codex `$aco`)로 실행될 때 런타임 롤업 대시보드를 ANSI-free 블록으로 stdout에 1회 출력해 host가 사용자에게 activation 배너로 표시한다. 플래그가 없으면 stdout 기본 동작은 변하지 않는다. 함께 추가된 `--host claude|codex`는 배너 헤더 아이콘과 `Host:` 줄을 위임 host에 맞게 표시한다(표시 전용, 기본 claude). `/aco`·`$aco` 커맨드 본문이 두 플래그를 자동으로 부착한다.

## 0.5.4

### Patch Changes

- f9ad702: feat(sync): `.aco/sync.yaml`에 `agents.exclude` 옵션 추가. glob으로 매칭된 agent id는
  `aco sync`의 source discovery에서 제외되어 `.codex/agents/`로 생성되지 않고 manifest에도
  들어가지 않는다. 기본(설정 없음)은 기존대로 모든 agent를 sync한다. 이를 통해 gitignore된
  로컬 전용 agent가 디스크에 있어도 manifest가 host-independent하게 유지된다.

## 0.5.3

### Patch Changes

- 53f3789: chore(skills): 배포 대상에서 repo 전용 `improve-codebase-architecture` 스킬을 제외한다. sync allowlist에서 빼고 생성 산출물(`.agents`/`templates`)을 추적 해제·gitignore 처리해, 빌드 시 더 이상 패키지에 번들되지 않는다. (OpenSpec 개발 툴링도 함께 추적 해제하지만 이는 비배포 surface라 패키지 영향은 없다.)

## 0.5.2

### Patch Changes

- 9f2ec4b: fix(sync): 매니페스트 `targets[].source`를 repo-relative로 정규화해 머신/worktree
  절대경로 누수와 cross-checkout sync drift를 제거한다. 더불어 `aco-delegation` skill에
  위임 가시화(Visibility) 규칙을 추가하고, README의 provider 아이콘을 교체한다.

## 0.5.1

### Patch Changes

- 87d858f: antigravity 위임이 `agy`를 고정 중립 작업 디렉터리(`~/.aco/agy-workspace`)에서 실행하도록 수정. 이전에는 호출 위치(임시·session·job 디렉터리 포함)를 그대로 상속해 Antigravity project 목록에 임시 경로가 무한 누적됐다. spawn 시 바이너리를 절대경로화하고, 워크스페이스 생성 실패 시 inherited cwd로 fallback해 위임이 hard-fail하지 않게 했다 (#166).

## 0.5.0

### Minor Changes

- `aco sync`가 structured source(skill / Codex agent)가 하나도 없는 fresh repo에서 빈 manifest만 쓰고 성공하던 동작을 막고, 명확한 "No sync sources found" 에러로 non-zero 종료하도록 강화. 단 기존 manifest나 legacy 타깃이 있으면 통과시켜 stale-target·legacy Gemini·orphan Codex agent cleanup이 끝까지 돌게 한다 (#152).

### Patch Changes

- 11dc797: npm 배포 파이프라인 복원: `publishConfig.access = "public"` 추가, release workflow를 `release` label PR merge 전용으로 제한, `release` GitHub label 생성
- `aco ask --output-mode save-only|full`(stream-only) 경로에서 run/session ledger의 `outputBytes`가 16KB capture 상한에 잘린 버퍼로 계산돼 실제 출력보다 작게 기록되던 문제 수정. provider session runner가 capture 상한과 무관하게 실제 스트리밍된 UTF-8 총 바이트를 별도로 세어 반환한다 (#139).

## 0.4.1

### Patch Changes

- 4051fa2: npm 배포 파이프라인 복원: `publishConfig.access = "public"` 추가, release workflow를 `release` label PR merge 전용으로 제한, Changesets release PR에 `release` label 자동 적용
