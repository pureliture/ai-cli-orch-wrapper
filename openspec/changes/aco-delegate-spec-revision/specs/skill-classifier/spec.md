## ADDED Requirements

### Requirement: Skills are classified by ownership and kind
The system SHALL classify each discovered `.claude/skills/*/SKILL.md` into an `AssetOwner` (`aco`, `external`, `provider-specific`, `unknown`) and `AssetKind` (`shared-skill`, `command-alias-skill`, `external-skill`) before planning sync outputs.

#### Scenario: Built-in ACO-owned skill
- **WHEN** the skill name is `github-kanban-ops`
- **THEN** the classifier SHALL return owner `aco` and kind `shared-skill`
- **AND** the skill SHALL be eligible for sync output

#### Scenario: OpenSpec skill by naming convention
- **WHEN** the skill name starts with `openspec-`
- **THEN** the classifier SHALL return owner `external` and kind `external-skill`
- **AND** the skill SHALL NOT be eligible for sync output

#### Scenario: Superpowers skill by naming convention
- **WHEN** the skill name is `superpowers-test` or one of the known Superpowers names (`using-superpowers`, `brainstorming`, `writing-plans`, `executing-plans`)
- **THEN** the classifier SHALL return owner `external` and kind `external-skill`

#### Scenario: Command alias skill
- **WHEN** the skill name starts with `gh-`
- **THEN** the classifier SHALL return owner `provider-specific` and kind `command-alias-skill`
- **AND** the skill SHALL NOT be eligible for sync output

#### Scenario: Explicitly included skill
- **WHEN** `.aco/sync.yaml` `skills.include` contains the exact skill name
- **THEN** the classifier SHALL return owner `aco` and kind derived from `source.assetKind` (defaulting to `shared-skill`)
- **AND** the skill SHALL be eligible for sync output even if naming heuristics would classify it differently

#### Scenario: Explicitly excluded skill
- **WHEN** `.aco/sync.yaml` `skills.exclude` contains the exact skill name or a matching glob
- **THEN** the classifier SHALL return owner based on the excluded category (`external`, `provider-specific`, or `unknown`)
- **AND** the skill SHALL NOT be eligible for sync output even if `skills.include` also matches

#### Scenario: Advisory frontmatter
- **WHEN** a skill's `SKILL.md` frontmatter contains `x-aco-owned: true`
- **AND** no higher-precedence rule (exclude, include, built-in default) applies
- **THEN** the classifier SHALL return owner `aco` and kind derived from `source.assetKind` (defaulting to `shared-skill`)

#### Scenario: Unknown skill
- **WHEN** a skill does not match any built-in default, config rule, frontmatter, or naming heuristic
- **THEN** the classifier SHALL return owner `unknown` and kind `external-skill`
- **AND** the skill SHALL NOT be eligible for sync output

### Requirement: Classification precedence is deterministic
The system SHALL apply the classification rules in a fixed precedence order.

#### Scenario: Precedence chain
- **WHEN** any skill is discovered
- **THEN** the classifier SHALL evaluate rules in this order: (1) `.aco/sync.yaml` exclude, (2) `.aco/sync.yaml` include, (3) built-in ACO-owned defaults, (4) frontmatter `x-aco-owned`, (5) naming convention heuristics, (6) default deny
- **AND** the first matching rule SHALL determine the classification
