## MODIFIED Requirements

### Requirement: Gemini CLI provider 옵션 필터링

기존 spec 의 `effortMap` 에서 Gemini CLI 가 지원하지 않는 옵션은 전달하지 않도록 필터링한다. 지원하지 않는 옵션은 dormant code path 가 아닌 **완전 제거** 원칙 (YAGNI) 을 따른다.

**이전 행동**:
```yaml
effortMap:
  gemini_cli:
    high: high
```
→ `--reasoning-effort high` 전달

**변경 후 행동**:
- `gemini_cli.go` 에서 `effortMap.gemini_cli` 매핑을 **완전 제거**
- 현재 Gemini CLI 는 `--reasoning-effort` 를 지원하지 않으므로 전달하지 않음
- 향후 지원 시 **새로 추가**하는 방식 (dormant path 유지하지 않음)

#### Scenario: Gemini CLI 실행 시 옵션 필터링
- **WHEN** `GeminiProvider.Invoke()` 가 호출되고 frontmatter 에 `reasoningEffort: high` 가 있으면
- **THEN** `--reasoning-effort` 옵션을 command line 에 추가하지 않음

#### Scenario: Codex 는 계속 전달
- **WHEN** `CodexProvider.Invoke()` 가 호출되고 frontmetadata 에 `reasoningEffort: high` 가 있으면
- **THEN** `--reasoning-effort high` 옵션을 계속 전달

#### Scenario: 향후 Gemini CLI 지원 옵션 추가
- **WHEN** Gemini CLI 가 `--reasoning-effort` 를 지원하게 되면
- **THEN** `effortMap.gemini_cli` 매핑을 **새로 추가** (기존 dormant path 를 복구하는 것이 아님)
