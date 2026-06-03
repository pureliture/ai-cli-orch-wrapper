# Context 동기화

`aco sync`는 Claude Code 프로젝트 설정을 Codex와 Antigravity의 프로젝트 단위 설정으로 동기화한다. manifest 형식은 v5다.

## Delegation Surfaces

Consent-gated delegation intentionally keeps the Claude Code UX centered on one generic command:

```text
.claude/commands/aco.md
```

Task-specific behavior belongs in natural language task text, CLI flags, or presets:

```text
.claude/aco/tasks/<preset>.md
.claude/skills/aco-delegation/SKILL.md
```

Do not add `/aco:review`, `/aco:spec-review`, `/aco:plan-review`, or similar task-specific slash commands. If delegation guidance changes, update the generic `/aco` command and `aco-delegation` skill instead.

`aco sync` may expose relevant shared policy surfaces to Codex/Antigravity targets according to the existing managed-block and allowed-skill rules. It does not turn `.claude/aco/tasks/` into provider execution by itself; `aco ask --yes` remains the execution gate.

## 중요: `.agents/skills`는 `.claude/skills`의 미러가 아님

`aco sync`는 더 이상 모든 `.claude/skills/<skill>/`을 `.agents/skills/<skill>/`로 재귀 복사하지 않는다. 기본 정책은 **default-deny**이며, 명시적으로 허용된 ACO-owned 공유 정책/reference skill만 `.agents/skills/`에 동기화된다.

- OpenSpec, Superpowers 등 upstream-managed 외부 skill은 `.agents/skills/`에 복사되지 않는다.
- `gh-*` command-alias skill은 provider-specific 표면으로 분류되어 공유 skill 출력에서 제외된다.
- `github-kanban-ops`와 같이 ACO가 직접 유지보수하는 공유 정책 skill만 `.agents/skills/`에 남는다.

허용 여부는 다음 순서로 결정된다 (exclude가 include보다 우선, 위쪽이 아래쪽보다 우선):

1. `.aco/sync.yaml`의 `skills.exclude`
2. `.aco/sync.yaml`의 `skills.include`
3. Built-in ACO-owned 기본값 (예: `github-kanban-ops`는 ACO-owned로 하드코딩)
4. Skill frontmatter의 `x-aco-owned: true` (advisory, config보다 우선하지 않음)
5. Skill 이름 기반 휴리스틱 (`openspec-*` → external, `gh-*` → provider-specific 등)
6. Default deny (owner `unknown`으로 분류)

## 지원되는 CLI 표면 (2026-05-31 기준, manifest v5)

| 표면                      | Codex CLI 0.122.0                                | Antigravity (`agy`)               |
| ------------------------- | ------------------------------------------------ | --------------------------------- |
| 프로젝트 지침             | `AGENTS.md`                                      | (없음 — `agy`는 AGENTS.md 미지원) |
| Skills                    | `.agents/skills/<skill>/SKILL.md`                | `.agents/skills/<skill>/SKILL.md` |
| Custom agents             | `.codex/agents/*.toml`                           | (없음 — agent 표면 미지원)        |
| 비대화형 prompt           | `codex exec [PROMPT]`                            | `agy --prompt <prompt>`           |
| Reasoning effort CLI flag | **지원 안 함**                                   | **지원 안 함**                    |

Codex는 공유 skill을 `.agents/skills/<skill>/`에서 읽는다. `.codex/skills/`는 `aco sync`가 관리하는 공유 표면이 아니다. 단, `.codex/skills/aco/`처럼 hand-maintained Codex-local 일급 진입점(`$aco`)은 존재한다.

> **AGENTS.md 주의**: 위 표의 `AGENTS.md`는 Codex CLI 런타임이 읽는 경로를 나타낼 뿐이다. `AGENTS.md`는 `aco sync`가 생성하거나 관리하지 않는다. 사람이 직접 유지보수하는 peer 문서이다.
>
> **Gemini 제거 주의**: Phases 1-3 마이그레이션으로 Gemini CLI provider가 제거되었다. `GEMINI.md`는 더 이상 `aco sync` 생성 대상이 아니다. `.gemini/agents/*`도 sync 대상에서 제외된다.

## Source 탐색 순서

`aco sync`는 source 파일을 다음 순서로 읽는다:

1. `CLAUDE.md` at repository root
2. `.claude/CLAUDE.md` (optional)
3. `.claude/rules/*.md` 사전순 정렬 (선택)
4. `.claude/skills/*/SKILL.md` skill directories
5. `.claude/agents/*.md` agent files

Skill source는 frontmatter에서 `x-aco-owned`, `x-aco-kind`, `x-aco-targets`를 파싱하여 동기화 자격을 판단한다.

`.claude/settings.json` hook 설정은 `aco sync` source가 아니다. Hook은 provider별 user-level runtime
설정으로 취급하며, repo-local context sync가 `.codex/hooks.json`, `.codex/config.toml` hook entry를 생성하지 않는다.

## 손실 변환 경고

모든 Claude Code 설정을 Codex 또는 Antigravity에 그대로 표현할 수 있는 것은 아니다. 다음 필드는 삭제되거나 의미 손실이 있는 형태로 변환된다. 경고는 `.aco/sync-manifest.json`에 기록된다.

### Reasoning Effort

`.claude/agents/*.md`의 `reasoningEffort`는 provider 중립적인 의도 표현이다. Codex CLI와 Antigravity CLI 모두 `--reasoning-effort` 런타임 flag를 지원하지 않는다.

- **Codex**: agent spec에 필드가 있을 때만 `model_reasoning_effort`를 `.codex/agents/*.toml`에 기록한다. 이는 설정 수준 필드이며 런타임 CLI flag가 아니다.
- **Antigravity**: `reasoningEffort`는 완전히 생략한다. manifest 경고를 기록한다.
- **Runtime**: `aco delegate`는 어떤 provider CLI에도 `--reasoning-effort`를 전달하지 않는다.

### Antigravity Read-Only 강제

`workspaceMode: read-only`와 `permissionProfile: restricted`는 Codex에서 `sandbox_mode = "read-only"`로 표현할 수 있다. Antigravity에서는 best-effort 수준의 tool restriction만 가능하다. read-only 강제가 완전히 동등하지 않다는 manifest 경고를 기록한다.

### Hook 설정

Hook은 `aco sync`가 변환하지 않는다. Claude와 Codex의 hook event와 실행 시맨틱은
project context보다 user-level runtime 설정에 가깝고, repo-local sync 산출물로 관리하면
provider runtime 설치와 context sync 경계가 섞인다. Hook 설치와 검증은 별도 user-level runtime
setup gate에서 다룬다.

## 사용법

```bash
# Claude context를 Codex 대상으로 동기화 (Antigravity는 project-instruction target 없음)
aco sync

# 동기화가 최신인지 확인 (stale이면 1로 종료)
aco sync --check

# 파일에 쓰지 않고 변경 내용 미리보기
aco sync --dry-run

# drift가 있는 manifest 소유 생성 대상을 덮어쓰기
aco sync --force

# 중복 provider 표면 경고를 오류로 승격 (CI 모드)
aco sync --check --strict

# 중복 감지된 asset 정리
aco sync --clean-duplicates

# 소유권이 불분명한 중복까지 강제 정리
aco sync --clean-duplicates --force-clean
```

## 생성 파일

`aco sync`는 다음 산출물을 관리한다:

| 산출물                    | 유형     | 설명                                                    |
| ------------------------- | -------- | ------------------------------------------------------- |
| `.agents/skills/<skill>/` | 디렉터리 | 명시적으로 허용된 ACO-owned skill만 복사                |
| `.codex/agents/*.toml`    | 파일     | Codex custom agent 정의                                 |
| `.aco/sync-manifest.json` | 파일     | 소유권, 해시, 경고를 담은 sync manifest (형식 v5)       |
| `.aco/sync.yaml`          | 파일     | skill include/exclude 규칙 (선택)                       |

> `AGENTS.md`는 더 이상 `aco sync`의 생성 대상이 아니다. 사람이 직접 유지보수하는 peer 문서이며, `aco sync`는 이 파일을 읽거나 감지하거나 쓰지 않는다.
>
> `GEMINI.md`와 `.gemini/agents/*.md`는 Phases 1-3 마이그레이션으로 Gemini provider가 제거되면서 더 이상 생성 대상이 아니다.

## 외부 asset 소유권

OpenSpec, Superpowers 등 upstream-managed tool의 skill이나 command는 ACO가 소유하지 않는다. `aco sync`는 이를 외부 asset으로 분류하고:

- `.agents/skills/`에 복사하지 않는다.
- `.aco/sync-manifest.json`에 `owner: external`로 기록한다.
- `aco sync --force`로도 외부 asset을 덮어쓰거나 입양하지 않는다.

provider-specific command (예: `.claude/commands/gh-issue.md`)는 해당 provider의 표면에 남아야 하며, 공유 skill 표면으로 복사되지 않는다.

## Manifest 충돌 감지

`aco sync`는 생성 파일 해시를 `.aco/sync-manifest.json`에 추적한다. 마지막 sync 이후 manifest 소유 대상이 수동으로 수정되었다면, `aco sync`는 `--force` 없이 덮어쓰지 않는다. stale 또는 drift가 있는 대상을 확인하려면 `aco sync --check`를 실행한다.

소유권이 `aco`인 대상만 자동 제거된다. 외부 또는 알 수 없는 소유권의 대상은 `aco sync`가 자동으로 삭제하지 않는다.

## 중복 provider 표면 감지

`aco sync --check`는 동일한 provider가 여러 표면에서 동일한 이름의 command나 skill을 노출하는 경우 경고를 출력한다:

- shared skill이 여러 provider 표면과 충돌하는 경우 (예: `.agents/skills/gh-issue/SKILL.md`)
- OpenSpec/Superpowers asset이 여러 provider 표면에 중복으로 존재하는 경우

`--strict` 모드에서는 중복 경고가 오류로 승격되어 `aco sync --check`가 non-zero로 종료된다.

## Pack Setup 통합

`aco pack setup`은 command, provider prompt, task preset 템플릿을 설치한 뒤 자동으로 `aco sync`를 실행한다.

- `templates/commands/**` -> `.claude/commands/**`
- `templates/prompts/**` -> `.claude/aco/prompts/**`
- `templates/tasks/**` -> `.claude/aco/tasks/**`
- `templates/skills/**` -> `<targetBase>/skills/**` (`--global`에서만)

`templates/skills/`는 배포 생성물이고 `.agents/skills/`는 sync 생성물로, 서로 다른 표면이다. 전자는 `.claude/skills/`(source of truth)에서 `build:skill-templates` 생성기로 파생되어 `aco pack install`이 유저레벨 `~/.claude/skills/`로 배포한다. 후자는 `aco sync`가 `.claude/skills/`를 읽어 Codex 공유 표면으로 미러한 결과다. 두 목록은 모두 `.aco/sync.yaml`의 `skills.include`에서 파생되므로 정합이 유지된다.

skill 설치는 `--global` 모드에서만 일어난다. non-global `pack install`/`pack setup`이 skill을 복사하면 `<cwd>/.claude/skills/`(= `aco sync`의 read source)를 덮어쓰고, `pack setup`이 직후 `aco sync`를 실행하므로 sync source 오염이 `.agents/skills/`로 전파된다. 이를 막기 위해 non-global 실행은 skill 복사를 skip한다.

설치된 task preset은 `aco ask --preset <name>`이 읽는 advisory prompt source이며, 그 자체로 provider를 실행하지 않는다. 실제 provider 실행은 `aco ask --yes` 또는 `aco run <provider> <command>`에서만 발생한다.

setup은 pack 파일을 쓰기 전에 sync preflight를 실행한다. manifest-owned target conflict는 fatal로 처리되어 파일 쓰기 전에 실패하고, `aco sync --check` 또는 `aco sync --force` 안내를 출력한다. no-source workspace와 update-only drift는 setup을 막지 않으며, 설치 후 sync 단계에서 skip 또는 refresh로 처리된다. 설치 후 sync가 실패하면 setup에 사용한 것과 같은 entrypoint로 `pack uninstall`을 실행하고, `--global` setup은 `pack uninstall --global`을 recovery 경로로 사용한다.

`aco pack status`는 ACO command pack 상태와 외부 통합 관찰 결과를 별도로 보고한다.
