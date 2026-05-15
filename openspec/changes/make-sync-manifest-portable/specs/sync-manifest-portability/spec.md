## ADDED Requirements

### Requirement: Repo-portable sync manifest

The context sync manifest SHALL be portable across repo clones, worktrees, and CI checkouts by avoiding maintainer-specific absolute repo paths in current manifest records.

#### Scenario: New manifest uses repo-relative paths

- **WHEN** `aco sync` writes the current manifest format
- **THEN** source and target manifest keys SHALL be repo-relative paths
- **AND** the manifest SHALL identify its path mode so readers can distinguish it from legacy absolute-path manifests.

#### Scenario: Legacy manifest remains readable

- **WHEN** `aco sync` or `aco doctor` reads a legacy manifest with absolute paths
- **THEN** it SHALL preserve enough information to evaluate current checkout sync state
- **AND** it SHALL report or perform migration according to documented behavior.

#### Scenario: Portability is distinct from content drift

- **WHEN** a manifest points at another checkout but generated target contents are otherwise current
- **THEN** diagnostics SHALL distinguish non-portable path metadata from stale generated target content.

#### Scenario: User drift remains protected

- **WHEN** a manifest-owned generated target has been manually modified in the current checkout
- **THEN** `aco sync --check` SHALL still report a conflict or drift
- **AND** normal sync SHALL NOT silently overwrite the target unless the documented force path is used.

#### Scenario: Manifest keys are platform-stable

- **WHEN** the manifest is written on different supported platforms
- **THEN** repo-relative keys SHALL use a stable path format that does not depend on the local absolute checkout path.
