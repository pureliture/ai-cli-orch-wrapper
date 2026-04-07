## ADDED Requirements

### Requirement: /gh-followup command creates a post-review followup issue
The system SHALL provide a `/gh-followup` Claude Code slash command that creates a GitHub issue originating from a PR review, labeled with `origin:review` plus an appropriate `type:*` label, with a body referencing the source PR.

#### Scenario: Followup issue creation with origin label
- **WHEN** user invokes `/gh-followup` with PR number and description
- **THEN** system SHALL create an issue with `origin:review` label and one of `type:task`, `type:chore`, or `type:bug` label (user selects)

#### Scenario: Source PR reference in body
- **WHEN** followup issue is created
- **THEN** issue body SHALL begin with `From: #<PR_NUMBER> review comment` as the first line

#### Scenario: See also link
- **WHEN** followup issue is created
- **THEN** issue body SHALL include `See also: #<PR_NUMBER>` linking back to the originating PR

#### Scenario: Project Backlog assignment
- **WHEN** followup issue is created
- **THEN** system SHALL add the issue to Project #3 Backlog (same as `/gh-issue`)

#### Scenario: Type label selection for review followups
- **WHEN** the followup represents an improvement or feature
- **THEN** `type:task + origin:review` SHALL be used

#### Scenario: Chore type for refactoring followups
- **WHEN** the followup represents a refactoring task
- **THEN** `type:chore + origin:review` SHALL be used

#### Scenario: Bug type for defect followups
- **WHEN** the followup represents an actual code defect found in review
- **THEN** `type:bug + origin:review` SHALL be used
