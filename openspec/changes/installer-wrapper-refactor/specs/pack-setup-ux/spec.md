## ADDED Requirements

### Requirement: aco pack setup installs command pack independently of provider setup
`aco pack setup` SHALL install the command templates and wrapper binary without requiring any provider CLI to be present. It SHALL report pack installation status and prompt the user to run provider setup separately.

#### Scenario: Pack setup succeeds without provider CLIs
- **WHEN** user runs `aco pack setup` and neither `gemini` nor `copilot` is in PATH
- **THEN** pack templates and wrapper binary are installed; output includes a note that provider CLIs are not yet configured

#### Scenario: Pack setup reports installed commands
- **WHEN** `aco pack setup` completes
- **THEN** output lists each installed command file (e.g., `/gemini:review`, `/copilot:rescue`) and the location of the `aco` binary

### Requirement: aco provider setup <name> configures a specific provider
`aco provider setup <name>` SHALL check provider CLI availability and authentication, install the CLI if missing (via the provider's install hint), and verify auth status.

#### Scenario: Provider already installed and authenticated
- **WHEN** user runs `aco provider setup gemini` and `gemini` CLI is installed and authenticated
- **THEN** output shows green status: `gemini: installed ✓  auth: ok ✓`

#### Scenario: Provider CLI missing
- **WHEN** user runs `aco provider setup gemini` and `gemini` is not in PATH
- **THEN** output shows the install command (e.g., `npm install -g @google/gemini-cli`) and exits with a non-zero code

#### Scenario: Provider CLI installed but not authenticated
- **WHEN** user runs `aco provider setup copilot` and `copilot` is in PATH but `gh auth status` fails
- **THEN** output shows the auth command (e.g., `gh auth login`) and exits with a non-zero code

### Requirement: aco pack status reports installed state
`aco pack status` SHALL report the current installed state: pack version, installed command files, and per-provider availability/auth status.

#### Scenario: Full status report
- **WHEN** user runs `aco pack status`
- **THEN** output includes: pack version, list of installed command files, and for each registered provider its `isAvailable()` and `checkAuth()` result

### Requirement: Pack setup and provider setup are independent and composable
It SHALL be possible to run `aco pack setup` and `aco provider setup <name>` in any order without either failing due to the other not having run first.

#### Scenario: Provider setup before pack setup
- **WHEN** user runs `aco provider setup gemini` before `aco pack setup`
- **THEN** provider setup succeeds (or fails for auth reasons); pack setup is not required

#### Scenario: Pack setup after provider setup
- **WHEN** user runs `aco pack setup` after `aco provider setup gemini` already succeeded
- **THEN** pack installs without re-running provider auth; existing provider config is preserved
