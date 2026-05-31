## MODIFIED Requirements

> **마이그레이션 주의**: 이 spec은 원래 Gemini CLI provider (`gemini_cli.go`, 디렉터리 `gemini-cli-provider/`)를
> 대상으로 작성되었다. Phases 1-3 antigravity 마이그레이션으로 Gemini CLI provider가 제거되고 Antigravity
> provider (`antigravity`, 바이너리 `agy`)로 대체되었다. 디렉터리는 `antigravity-cli-provider/`로 `git mv`
> 되었다. 아래 요구사항은 Antigravity CLI provider를 기준으로 업데이트되었다.

### Requirement: Antigravity CLI provider 옵션 필터링

기존 spec 의 `effortMap` 에서 Antigravity CLI 가 지원하지 않는 옵션은 전달하지 않도록 필터링한다. 지원하지 않는 옵션은 dormant code path 가 아닌 **완전 제거** 원칙 (YAGNI) 을 따른다.

**이전 행동 (Gemini era)**:
```yaml
effortMap:
  gemini_cli:
    high: high
```
→ `--reasoning-effort high` 전달 (Gemini CLI는 이를 지원하지 않았으므로 오류였음)

**변경 후 행동 (Antigravity)**:
- `antigravity.go` 에서 `effortMap.antigravity` 매핑을 **포함하지 않음**
- 현재 Antigravity CLI(`agy`)는 `--reasoning-effort` 를 지원하지 않으므로 전달하지 않음
- 향후 지원 시 **새로 추가**하는 방식 (dormant path 유지하지 않음)

#### Scenario: Antigravity CLI 실행 시 옵션 필터링
- **WHEN** `AntigravityProvider.Invoke()` 가 호출되고 frontmatter 에 `reasoningEffort: high` 가 있으면
- **THEN** `--reasoning-effort` 옵션을 command line 에 추가하지 않음

#### Scenario: Codex 는 계속 전달
- **WHEN** `CodexProvider.Invoke()` 가 호출되고 frontmetadata 에 `reasoningEffort: high` 가 있으면
- **THEN** `--reasoning-effort high` 옵션을 계속 전달

#### Scenario: 향후 Antigravity CLI 지원 옵션 추가
- **WHEN** Antigravity CLI 가 `--reasoning-effort` 를 지원하게 되면
- **THEN** `effortMap.antigravity` 매핑을 **새로 추가** (dormant path 복구 방식이 아님)
