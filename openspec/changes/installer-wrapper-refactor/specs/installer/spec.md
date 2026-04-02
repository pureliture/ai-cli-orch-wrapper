## ADDED Requirements

### Requirement: Pack install copies command templates to target directory
The installer SHALL copy all files from `templates/commands/` into the target `.claude/commands/` directory. By default the target is `./.claude/commands/` (project-local). With `--global` flag the target is `~/.claude/commands/`.

#### Scenario: Default project-local install
- **WHEN** user runs `npx aco-install` or `aco pack install` in a project directory
- **THEN** installer copies `templates/commands/**` into `./.claude/commands/` and reports each file copied

#### Scenario: Global install
- **WHEN** user runs `aco pack install --global`
- **THEN** installer copies templates into `~/.claude/commands/` and reports each file copied

#### Scenario: Skip existing files by default
- **WHEN** a target file already exists and `--force` is not passed
- **THEN** installer skips that file, prints a warning, and continues with remaining files

#### Scenario: Force overwrite
- **WHEN** user passes `--force`
- **THEN** installer overwrites all target files without prompting

### Requirement: Pack install places wrapper binary
The installer SHALL ensure the `aco` binary is available in PATH after installation. It SHALL link or copy the wrapper entry point from `packages/wrapper/dist/cli.js` into an appropriate bin location.

#### Scenario: Binary placed on install
- **WHEN** `aco pack install` completes successfully
- **THEN** `aco --version` executes without error from the project directory

#### Scenario: Binary name collision warning
- **WHEN** a binary named `aco` already exists in PATH and does not match this package
- **THEN** installer prints a warning and offers `--binary-name <name>` override option

### Requirement: Pack install copies prompt templates
The installer SHALL copy `templates/prompts/` into the target `.claude/aco/prompts/` directory alongside the command templates.

#### Scenario: Prompt templates copied
- **WHEN** install completes successfully
- **THEN** `templates/prompts/gemini/` and `templates/prompts/copilot/` are present under the target `.claude/aco/prompts/`

### Requirement: Pack uninstall removes installed files
The installer SHALL provide `aco pack uninstall` that removes all files previously installed by `aco pack install`.

#### Scenario: Clean uninstall
- **WHEN** user runs `aco pack uninstall`
- **THEN** all installed command files and prompt templates are removed; the `aco` binary is unlinked

### Requirement: Installer validates Node.js version
The installer SHALL check that the running Node.js version meets the declared `engines.node` range before proceeding.

#### Scenario: Node version too old
- **WHEN** installed Node.js is below minimum required version
- **THEN** installer prints an error with the required range and exits with a non-zero code
