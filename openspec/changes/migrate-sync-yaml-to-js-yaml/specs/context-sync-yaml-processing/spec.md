## ADDED Requirements

### Requirement: Parse agent frontmatter with YAML semantics
The system SHALL parse sync-layer agent frontmatter using YAML semantics instead of a hand-rolled line parser.

#### Scenario: Quoted description contains colon
- **WHEN** an agent frontmatter field contains `description: "Review code: TypeScript and Node.js"`
- **THEN** the parsed agent spec SHALL contain the full description string including the colon

#### Scenario: Array values are quoted
- **WHEN** an agent frontmatter field contains an inline array with quoted values
- **THEN** the parsed agent spec SHALL preserve each array item without surrounding quotes

#### Scenario: YAML anchors and aliases are used
- **WHEN** an agent frontmatter document uses a YAML anchor and alias for repeated scalar or array values
- **THEN** the parsed agent spec SHALL resolve the alias to the expected value

#### Scenario: Multiline scalar is used
- **WHEN** an agent frontmatter field uses a YAML multiline scalar
- **THEN** the parsed agent spec SHALL preserve the scalar content according to YAML parsing rules

### Requirement: Parse formatter config with YAML semantics
The system SHALL parse `.aco/formatter.yaml` using YAML semantics instead of a hand-rolled line parser.

#### Scenario: Nested provider defaults
- **WHEN** formatter config includes nested mappings for provider defaults and model alias maps
- **THEN** the parsed formatter config SHALL preserve those nested mappings

#### Scenario: Formatter values use aliases
- **WHEN** formatter config uses anchors and aliases for repeated provider or model values
- **THEN** the parsed formatter config SHALL resolve those aliases before model resolution

#### Scenario: Formatter values contain YAML-sensitive characters
- **WHEN** formatter config values include colons, quotes, or escaped characters
- **THEN** the parsed formatter config SHALL preserve the intended string values

### Requirement: Serialize Gemini agent frontmatter with YAML semantics
The system SHALL serialize generated Gemini agent frontmatter using YAML serialization instead of manual string concatenation.

#### Scenario: Gemini description contains colon
- **WHEN** a Gemini agent description contains a colon
- **THEN** the serialized frontmatter SHALL remain valid YAML
- **AND** parsing the generated frontmatter SHALL recover the original description value

#### Scenario: Gemini description contains quotes
- **WHEN** a Gemini agent description contains quote characters
- **THEN** the serialized frontmatter SHALL escape or quote the value as valid YAML
- **AND** parsing the generated frontmatter SHALL recover the original description value

#### Scenario: Optional Gemini fields are omitted
- **WHEN** optional Gemini agent fields such as `description`, `model`, or `max_turns` are absent
- **THEN** the serialized frontmatter SHALL omit those fields
- **AND** the frontmatter SHALL remain valid YAML

### Requirement: Preserve sync config behavior
The system SHALL preserve existing sync behavior for currently supported simple YAML inputs while adding support for valid YAML edge cases.

#### Scenario: Existing simple agent fixture parses
- **WHEN** an existing simple agent frontmatter fixture is parsed
- **THEN** the resulting agent spec SHALL match the current expected fields

#### Scenario: Existing simple formatter fixture parses
- **WHEN** an existing simple formatter fixture is parsed
- **THEN** model and provider resolution SHALL produce the same results as before the migration
