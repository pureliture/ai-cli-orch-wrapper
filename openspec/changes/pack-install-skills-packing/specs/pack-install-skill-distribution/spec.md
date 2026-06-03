## ADDED Requirements

### Requirement: Global skill distribution via pack install
`aco pack install`은 `--global` 모드에서 큐레이션된 스킬을 `templates/skills/`로부터 `~/.claude/skills/<skill>/`로 복사하여 유저레벨에 설치 SHALL 한다.

#### Scenario: Global install copies skills
- **WHEN** 사용자가 `aco pack install --global`을 실행한다
- **THEN** `templates/skills/` 아래 각 스킬이 `~/.claude/skills/<skill>/`에 복사된다
- **AND** commands·prompts·tasks 기존 복사 동작은 변하지 않는다

#### Scenario: Force overwrites existing skill files
- **WHEN** `~/.claude/skills/<skill>/`에 파일이 이미 존재하고 사용자가 `aco pack install --global --force`를 실행한다
- **THEN** 기존 스킬 파일이 `templates/skills/` 버전으로 덮어써진다

#### Scenario: Without force existing skill files are skipped
- **WHEN** `~/.claude/skills/<skill>/`에 파일이 이미 존재하고 사용자가 `--force` 없이 `aco pack install --global`을 실행한다
- **THEN** 기존 파일은 보존되고 skip 메시지가 출력된다
- **AND** `templates/skills/`에만 있는 신규 파일은 복사된다

### Requirement: Non-global pack runs MUST NOT touch sync source
`aco pack install`/`aco pack setup`은 non-global(`--global` 미지정) 모드에서 스킬을 복사 SHALL NOT 한다. 이로써 `aco sync`가 READ source로 사용하는 `cwd/.claude/skills/`를 오염시키지 않는다.

#### Scenario: Non-global install skips skills
- **WHEN** 사용자가 repo 안에서 `aco pack install`(`--global` 없이)을 실행한다
- **THEN** `cwd/.claude/skills/`는 어떤 스킬 파일도 생성·수정·삭제되지 않는다
- **AND** 스킬 복사가 건너뛰어졌음을 알리는 로그가 출력된다

#### Scenario: Non-global pack setup keeps sync source intact
- **WHEN** 사용자가 repo 안에서 `aco pack setup`(`--global` 없이)을 실행한다
- **THEN** 내부 `runSync` 호출 이전과 이후 모두 `cwd/.claude/skills/`의 내용이 변경되지 않는다
- **AND** `.agents/skills/`가 `templates/skills/` 내용으로 대체되지 않는다

### Requirement: templates/skills is generated from source with parity enforcement
`templates/skills/`는 source of truth인 `.claude/skills/`에서 생성기 스크립트로 파생 SHALL 되며, CI는 생성기 재실행 후 작업 트리에 차이가 없음을 검증 SHALL 한다.

#### Scenario: Generator reproduces committed templates
- **WHEN** CI가 스킬 템플릿 생성기를 실행한다
- **THEN** `git diff --exit-code`가 변경 없음(exit 0)을 반환한다

#### Scenario: Drift between source and templates fails CI
- **WHEN** `.claude/skills/`의 큐레이션 스킬이 수정되었으나 `templates/skills/`가 재생성되지 않았다
- **THEN** CI parity 검사가 비제로 종료 코드로 실패한다

### Requirement: Packable skill allowlist derives from sync allowlist
스킬 템플릿 생성기는 포함할 스킬을 context-sync allowlist(`.aco/sync.yaml` include + 내장 `ACO_OWNED_SKILLS`)에서 파생 SHALL 하며, 외부/래퍼 스킬은 제외 SHALL 한다.

#### Scenario: External and alias skills excluded
- **WHEN** 생성기가 실행되고 `.claude/skills/`에 `gh-*`, `openspec-*`, `superpowers-*` 스킬이 존재한다
- **THEN** 이들은 `templates/skills/`에 포함되지 않는다

#### Scenario: ACO-owned skills included
- **WHEN** 생성기가 실행되고 `ACO_OWNED_SKILLS` 또는 `.aco/sync.yaml` include에 명시된 스킬이 존재한다
- **THEN** 해당 스킬이 `templates/skills/`에 포함된다

### Requirement: Installed skills are tracked and selectively removable
설치된 스킬 파일은 `aco-manifest.json`에 기록 SHALL 되고, `aco pack uninstall`은 manifest 기록에 따라 스킬을 선택적으로 제거 SHALL 한다.

#### Scenario: Manifest records installed skills
- **WHEN** `aco pack install --global`이 스킬을 설치한다
- **THEN** 설치된 각 스킬 파일 경로가 `~/.claude/aco/aco-manifest.json`의 파일 목록에 기록된다

#### Scenario: Uninstall removes only manifest-recorded skills
- **WHEN** 사용자가 `aco pack uninstall --global`을 실행한다
- **THEN** manifest에 기록된 스킬 파일만 제거된다
- **AND** manifest에 없는 사용자 소유 파일은 보존된다
