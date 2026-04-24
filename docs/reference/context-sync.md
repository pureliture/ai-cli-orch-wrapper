# Context 동기화

`aco sync`는 Claude Code 프로젝트 설정을 Codex와 Gemini의 프로젝트 단위 설정으로 동기화한다.

## 지원되는 CLI 표면 (2026-04-22 기준)

| 표면 | Codex CLI 0.122.0 | Gemini CLI 0.38.2 |
|---------|-------------------|-------------------|
| 프로젝트 지침 | `AGENTS.md` | `GEMINI.md` |
| Skills | `.agents/skills/<skill>/SKILL.md` | `.agents/skills/<skill>/SKILL.md` |
| Custom agents | `.codex/agents/*.toml` | `.gemini/agents/*.md` |
| Hooks | `.codex/hooks.json` + `codex_hooks` feature flag | `.gemini/settings.json` hooks |
| 비대화형 prompt | `codex exec [PROMPT]` | `gemini --prompt <prompt>` |
| Reasoning effort CLI flag | **지원 안 함** | **지원 안 함** |

Codex와 Gemini는 `.agents/skills/<skill>/`을 공유 skill 디렉터리로 사용한다. `aco sync`는 `.claude/skills/<skill>/`을 `.agents/skills/<skill>/`로 재귀 복사한다. `.codex/skills` 또는 `.gemini/skills`를 직접 사용하지 않는다. 이 경로들은 공유 표면이 아니다.

## Source 탐색 순서

`aco sync`는 source 파일을 다음 순서로 읽는다:

1. `CLAUDE.md` at repository root
2. `.claude/CLAUDE.md` (optional)
3. `.claude/rules/*.md` 사전순 정렬 (선택)
4. `.claude/skills/*/SKILL.md` skill directories
5. `.claude/agents/*.md` agent files
6. `.claude/settings.json` hooks (`.claude/hooks.json`는 legacy fallback으로만 허용)

## 손실 변환 경고

모든 Claude Code 설정을 Codex 또는 Gemini에 그대로 표현할 수 있는 것은 아니다. 다음 필드는 삭제되거나 의미 손실이 있는 형태로 변환된다. 경고는 `.aco/sync-manifest.json`에 기록된다.

### Reasoning Effort

`.claude/agents/*.md`의 `reasoningEffort`는 provider 중립적인 의도 표현이다. Codex CLI와 Gemini CLI 모두 `--reasoning-effort` 런타임 flag를 지원하지 않는다.

- **Codex**: agent spec에 필드가 있을 때만 `model_reasoning_effort`를 `.codex/agents/*.toml`에 기록한다. 이는 설정 수준 필드이며 런타임 CLI flag가 아니다.
- **Gemini**: `reasoningEffort`는 완전히 생략한다. manifest 경고를 기록한다.
- **Runtime**: `aco delegate`는 어떤 provider CLI에도 `--reasoning-effort`를 전달하지 않는다.

### Gemini Read-Only 강제

`workspaceMode: read-only`와 `permissionProfile: restricted`는 Codex에서 `sandbox_mode = "read-only"`로 표현할 수 있다. Gemini에서는 best-effort 수준의 tool restriction만 가능하다. read-only 강제가 완전히 동등하지 않다는 manifest 경고를 기록한다.

### Hook 시맨틱

Claude Code는 agent를 차단하지 않고 실행되는 hook에 `async: true`를 지원한다. Codex와 Gemini hook은 agent loop 안에서 동기적으로 실행된다. Claude hook에 `async: true`가 있으면 경고를 기록하고, 생성된 대상 hook은 fire-and-forget 시맨틱을 주장하지 않는다.

지원하지 않는 hook event, 즉 대상 CLI 표면에 없는 event는 건너뛰고 경고로 기록한다.

타임아웃 단위는 서로 다르다. Claude Code hook은 초를 사용하고 Gemini hook은 밀리초를 사용한다. `aco sync`가 자동으로 변환한다.

## 사용법

```bash
# Claude context를 Codex와 Gemini 대상으로 동기화
aco sync

# 동기화가 최신인지 확인 (stale이면 1로 종료)
aco sync --check

# 파일에 쓰지 않고 변경 내용 미리보기
aco sync --dry-run

# drift가 있는 manifest 소유 생성 대상을 덮어쓰기
aco sync --force
```

## 생성 파일

`aco sync`는 다음 산출물을 관리한다:

| 산출물 | 유형 | 설명 |
|--------|------|-------------|
| `AGENTS.md` | 관리 block | Claude context에서 생성한 Codex 프로젝트 지침 |
| `GEMINI.md` | 관리 block | Claude context에서 생성한 Gemini 프로젝트 지침 |
| `.agents/skills/<skill>/` | 디렉터리 | `.claude/skills/`에서 복사한 skill 디렉터리 |
| `.codex/agents/*.toml` | 파일 | Codex custom agent 정의 |
| `.codex/hooks.json` | 파일 | Codex hook 설정 |
| `.codex/config.toml` | 관리 block | Codex feature flag (`codex_hooks = true`) |
| `.gemini/agents/*.md` | 파일 | Gemini custom agent 정의 |
| `.gemini/settings.json` | 파일 | hook entry가 포함된 Gemini 설정 |
| `.aco/sync-manifest.json` | 파일 | 해시와 경고를 담은 sync 소유권 manifest |

## Manifest 충돌 감지

`aco sync`는 생성 파일 해시를 `.aco/sync-manifest.json`에 추적한다. 마지막 sync 이후 manifest 소유 대상이 수동으로 수정되었다면, `aco sync`는 `--force` 없이 덮어쓰지 않는다. stale 또는 drift가 있는 대상을 확인하려면 `aco sync --check`를 실행한다.

## Pack Setup 통합

`aco pack setup`은 command와 prompt 템플릿을 설치한 뒤 자동으로 `aco sync`를 실행한다. sync 경고는 setup 출력에 표시된다. 치명적인 sync 충돌, 즉 소유권이 없는 대상 drift가 있으면 파일 쓰기 전에 setup이 실패하며, `aco sync --check` 또는 `aco sync --force`로 해결하라는 안내를 출력한다.
