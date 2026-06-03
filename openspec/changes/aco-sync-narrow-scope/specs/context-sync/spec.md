## REMOVED Requirements

### Requirement: Project guidance generation
**Reason**: `aco sync`의 책임을 구조적 표면 변환(agents/skills/hooks)으로 한정한다. `AGENTS.md`(및 이미 드롭된 `GEMINI.md`) 같은 freeform guideline/instruction markdown은 sync가 저작·투영하지 않고 hand-maintained peer 문서로 소유한다.

**Migration**: sync는 더 이상 `AGENTS.md`/`GEMINI.md`를 생성하지 않는다. 기존 repo의 `ACO GENERATED CONTEXT` 관리 블록 마커는 무해한 HTML 주석으로 남으며, 사용자가 원할 때 1회 손으로 제거한다(sync는 이를 자동 편집·감지하지 않는다). Codex `$aco`/`aco delegate` 진입점 같은 provider-native 가이드는 `AGENTS.md`(손유지)와 `.codex/skills/aco/`가 소유한다.

## ADDED Requirements

### Requirement: Project-guidance files are outside sync awareness
The system SHALL exclude project-guidance markdown (`AGENTS.md`, `GEMINI.md`) from `aco sync` entirely: it SHALL NOT read, detect, generate, or write these files, and SHALL carry no migration logic for them.

#### Scenario: Sync never writes project-guidance markdown
- **WHEN** `aco sync` runs for any repository state
- **THEN** the system SHALL NOT create, rewrite, or modify `AGENTS.md` or `GEMINI.md`
- **AND** SHALL NOT inspect them for managed-block markers

#### Scenario: Manifest excludes guidance targets on regeneration
- **WHEN** `aco sync` regenerates the manifest from its current target set
- **THEN** the manifest SHALL contain only structured-surface targets
- **AND** any pre-existing `AGENTS.md`/`GEMINI.md` target keys from an older manifest SHALL be dropped without error and without a dedicated prune step

#### Scenario: Existing managed-block markers are left untouched
- **WHEN** an `AGENTS.md` still contains old `ACO GENERATED CONTEXT` markers
- **THEN** `aco sync` SHALL leave the file byte-for-byte unchanged
- **AND** SHALL NOT emit drift or migration output for it
