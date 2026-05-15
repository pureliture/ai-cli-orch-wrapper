## ADDED Requirements

### Requirement: Ubiquitous language reference

The project SHALL provide a maintained ubiquitous language reference for `aco` domain terms used by humans and AI agents.

#### Scenario: Initial glossary scope stays narrow

- **WHEN** the first ubiquitous language implementation is planned
- **THEN** the initial glossary SHALL fully define provider invocation and run/session artifact terms
- **AND** context sync, harness surfaces, consent/permissions, and verification terms SHALL be represented as backlog placeholders unless they are required to explain the first slice.

#### Scenario: Contributor discovers term definitions

- **WHEN** a contributor needs to understand first-slice terms such as `run`, `session`, `brief`, `artifact`, or `provider`
- **THEN** the contributor SHALL be able to find those terms in `docs/reference/ubiquitous-language.md`
- **AND** each term SHALL include a definition, scope, and at least one repo-specific example.
- **AND** backlog terms such as `harness` and `generated target` SHALL be listed as placeholders until their workflow slice fully defines them.

#### Scenario: Preferred terms are distinguished from discouraged synonyms

- **WHEN** a term has common but misleading synonyms
- **THEN** the language reference SHALL identify the preferred term
- **AND** explain why the discouraged synonym should not be used.

#### Scenario: Future workflow docs reuse the vocabulary

- **WHEN** a new OpenSpec change describes provider execution, artifacts, context sync, or harness surfaces
- **THEN** it SHALL use the preferred terms from the ubiquitous language reference unless the change explicitly introduces a new term.

#### Scenario: Terminology drift is checked automatically

- **WHEN** the first ubiquitous language slice is implemented
- **THEN** the project SHALL include a focused automated terminology check for high-risk discouraged terms
- **AND** the check SHALL support accepted aliases or allowlisted legacy language so it does not become broad prose policing.

#### Scenario: Public contract is protected

- **WHEN** terminology cleanup touches public commands, artifact fields, or documented file layouts
- **THEN** the change SHALL preserve backward compatibility unless a separate migration plan and tests are included.
- **AND** code renames SHALL remain targeted to ambiguity that affects behavior, emitted artifacts, or tests.
