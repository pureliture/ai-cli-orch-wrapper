# Proposal: aco v2 Context Sync Layer

**Change:** aco-v2-context-sync-layer  
**Schema:** spec-driven  
**Status:** Draft  

---

## Why

현재 `ai-cli-orch-wrapper`는 Claude Code 외부 CLI(Gemini, Codex)를 peer agent로 실행할 때, 프로젝트의 Claude Code 설정(context, rules, skills, agents, hooks)을 외부 CLI에 동일하게 제공하지 못한다. 이로 인해 외부 AI가 프로젝트의 coding standards, conventions, agent personas를 모른 채 작동하여 출력 품질이 저하된다.

세 CLI는 모두 프로젝트 레벨 설정을 지원하지만, 최신 Codex CLI 0.122.0 및 Gemini CLI 0.38.2 기준으로 파일명, 디렉터리, hook schema, agent schema, runtime flag 표면이 서로 다르다. 단순 파일 복사는 깨지기 쉽고, 사용자가 각 CLI마다 같은 정책을 수동으로 유지보수해야 하는 문제가 있다.

**Why now:** aco v2 아키텍처 전환(frontmatter 기반 routing, stdout 직접 반환)과 함께 delivery하면, 외부 AI가 Claude Code와 동일한 프로젝트 context를 공유하여 "native feeling" peer agent 경험을 완성할 수 있다.

## What Changes

- **`aco pack setup`**: 초기 설치 시 Claude Code 프로젝트 설정을 Codex/Gemini 프로젝트 설정으로 동기화
- **`aco sync` (new command)**: 명시적 동기화 명령어. `.claude/` 변경 시 재동기화
- **동기화 규칙 구현**:
  - root `CLAUDE.md` + optional `.claude/CLAUDE.md` + optional `.claude/rules/*.md` → managed block in `AGENTS.md` (Codex)
  - root `CLAUDE.md` + optional `.claude/CLAUDE.md` + optional `.claude/rules/*.md` → managed block in `GEMINI.md` (Gemini)
  - `.claude/skills/*/SKILL.md` directories → `.agents/skills/<skill>/` recursive copy (Codex + Gemini shared alias)
  - `.claude/agents/*.md` → `.codex/agents/*.toml` (Codex)
  - `.claude/agents/*.md` → `.gemini/agents/*.md` (Gemini)
  - `.claude/settings.json` hooks, with optional `.claude/hooks.json` fallback → `.codex/hooks.json` + `.codex/config.toml` feature flag (Codex)
  - `.claude/settings.json` hooks, with optional `.claude/hooks.json` fallback → `.gemini/settings.json` + `.gemini/hooks/` wrapper scripts (Gemini)
  - sync ownership and content hashes → `.aco/sync-manifest.json`
- **provider runtime compatibility hardening**:
  - `aco delegate` MUST NOT pass unsupported provider CLI flags such as `--reasoning-effort`
  - reasoning effort is mapped only into provider-specific configuration surfaces that are confirmed supported
- **`aco delegate` runtime 동기화 체크 제거**: blocking contract 유지. Stale detection은 `aco sync --check`가 담당

**Compatibility:** `aco run <provider> <command>`는 기존 deprecation 경고를 유지한다. 이 change는 `aco sync`를 추가하지만 기존 command를 제거하지 않는다.

## Capabilities

### New Capabilities

- `context-sync`: Claude Code source-of-truth를 기반으로 Codex/Gemini 프로젝트 레벨 설정 동기화
- `cli-sync-command`: `aco sync` 명령어 — 명시적 동기화 트리거
- `provider-runtime-compatibility`: 최신 Codex/Gemini CLI가 실제로 지원하는 launch flags/config surfaces만 사용

### Modified Capabilities

- `aco-pack-setup`: 설치 시 동기화 로직 추가 (기존: 템플릿 설치만 → 변경: + 동기화)

## Impact

- **packages/wrapper/src/cli.ts**: `aco sync` 명령어 추가
- **packages/wrapper/src/sync/**: 새 디렉토리 — 동기화 변환 로직
  - `codex-transform.ts`: `.claude/` → `.codex/` 변환
  - `gemini-transform.ts`: `.claude/` → `.gemini/` 변환
  - `transform-interface.ts`: 공통 변환 인터페이스
  - `manifest.ts`: managed output ownership, hash, drift detection
- **packages/wrapper/src/commands/pack-install.ts**: `pack setup`에 동기화 단계 추가
- **internal/provider/codex.go, internal/provider/gemini_cli.go**: unsupported runtime flag 제거
- **새 파일 (동기화 산출물)**: `AGENTS.md`, `GEMINI.md`, `.agents/skills/`, `.codex/`, `.gemini/`, `.aco/sync-manifest.json` (aco가 생성/관리)
