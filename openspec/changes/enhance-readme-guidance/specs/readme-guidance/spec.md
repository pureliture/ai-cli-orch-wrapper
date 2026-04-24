## ADDED Requirements

### Requirement: Preserve latest README outline
The README enhancement SHALL preserve the current top-level section structure from latest `origin/main` unless a specific user-facing gap cannot be addressed inside that outline.

#### Scenario: Existing headings remain primary navigation
- **WHEN** `README.md` is updated
- **THEN** the current top-level headings, including `현재 구현 범위`, remain the document's primary navigation structure

#### Scenario: Broad conceptual headings are avoided
- **WHEN** OpenSpec workflow, provider model, or ccg-workflow compatibility content is considered
- **THEN** that content is not added as a dedicated top-level heading unless the existing outline cannot satisfy the README purpose without it

### Requirement: Clarify first-use path
The README SHALL explain the practical first-use path from prerequisites through install, provider setup, source-build sync checking, and basic session operations.

#### Scenario: Reader starts from installation
- **WHEN** a first-time reader reaches `설치`
- **THEN** the README explains the expected setup sequence and distinguishes npx usage from local checkout usage

#### Scenario: Reader configures providers
- **WHEN** a reader reaches `Provider 설정`
- **THEN** the README identifies required external CLIs, available credential sources, and the limits of local readiness checks

### Requirement: Improve command scanability
The README SHALL present core `aco` commands in rendered Markdown that is easier to scan than a dense command-only block.

#### Scenario: Reader scans CLI overview
- **WHEN** GitHub renders `CLI 개요`
- **THEN** command groups, command names, purposes, and usage contexts are visually scannable

#### Scenario: Reader copies commands
- **WHEN** the README includes shell commands
- **THEN** commands appear in fenced `bash` code blocks and remain copyable without embedded prose

### Requirement: Provide compact architecture orientation
The README SHALL include a compact architecture orientation inside `Architecture at a Glance`.

#### Scenario: Reader scans architecture
- **WHEN** a reader reaches `Architecture at a Glance`
- **THEN** the README shows the relationship between source harness assets, `aco sync`, generated target surfaces, provider execution, and session operations

#### Scenario: Reader needs deeper detail
- **WHEN** a reader needs implementation-level architecture detail
- **THEN** the README links to deeper architecture documentation instead of duplicating it fully

### Requirement: Distinguish source and generated surfaces
The README SHALL distinguish manually maintained harness/source assets from generated or managed target surfaces.

#### Scenario: Reader reviews harness layout
- **WHEN** a reader reaches `Harness Layout` or `저장소 구조`
- **THEN** the README makes clear which paths are maintained source surfaces and which paths are generated or managed outputs

### Requirement: Expand durable troubleshooting
The README SHALL cover durable first-response troubleshooting paths without replacing the runbook.

#### Scenario: `aco` is missing
- **WHEN** `aco: command not found` occurs
- **THEN** the README gives the relevant package installation or PATH-oriented recovery step

#### Scenario: Provider readiness fails
- **WHEN** provider setup fails because a CLI is missing or credentials are unavailable
- **THEN** the README points to the provider setup command and relevant environment or OAuth credential source

#### Scenario: Slash commands are missing or stale
- **WHEN** Claude slash commands are unavailable or stale
- **THEN** the README points to the relevant `aco pack` recovery path

#### Scenario: Generated target drift is suspected
- **WHEN** Codex or Gemini generated surfaces may be stale
- **THEN** the README identifies the source-build `sync --check` path as the read-only drift detection path and avoids implying the current public npm release always exposes `aco sync`

### Requirement: Improve documentation navigation
The README SHALL describe when to use the main linked docs rather than listing links without context.

#### Scenario: Reader chooses next documentation
- **WHEN** a reader reaches `문서`
- **THEN** each major linked document has a short description that helps the reader choose the correct next reference

### Requirement: State OpenSpec-based development workflow
The README SHALL state that repository changes are developed through OpenSpec change artifacts.

#### Scenario: Reader scans the project introduction
- **WHEN** a reader reads the top-level README introduction
- **THEN** the README identifies OpenSpec proposal, design, spec, and task artifacts as the default change workflow for this project

### Requirement: Provide AI commit message template and prompt
The repository SHALL provide a Git commit message template and a Korean AI commit-writing prompt.

#### Scenario: Developer configures commit template
- **WHEN** a developer wants Git to open the repository commit template
- **THEN** the repository provides `.gitmessage` and README guidance for `git config commit.template .gitmessage`

#### Scenario: Codex drafts a commit message
- **WHEN** Codex drafts or creates a commit message
- **THEN** repo instructions point Codex to the Korean commit-writing prompt and require title plus body format

#### Scenario: AI contributors are recorded
- **WHEN** an AI CLI or model was used to develop the change
- **THEN** the commit prompt requires contributor trailers for the AI CLI and model, including `AI-CLI` and `AI-Model` fallback trailers when GitHub-recognized identities are unavailable

### Requirement: Treat Markdown rendering as acceptance criteria
The README enhancement SHALL account for rendered Markdown quality, not only raw text content.

#### Scenario: README is rendered
- **WHEN** the README is rendered by GitHub or a local Markdown viewer
- **THEN** headings, tables, diagrams, code fences, and links preserve the intended reading order and avoid unnecessary visual clutter

#### Scenario: README links are rendered
- **WHEN** readers use README links for deeper documentation
- **THEN** link labels are descriptive and point to existing repository documentation where practical

### Requirement: Preserve source-build validation path
The change SHALL keep the local source-build validation path usable when README guidance depends on source implementation commands.

#### Scenario: Source-build sync path is documented
- **WHEN** the README points readers to `node packages/wrapper/dist/cli.js sync --check`
- **THEN** the wrapper package TypeScript build succeeds without missing declaration errors for `js-yaml`
