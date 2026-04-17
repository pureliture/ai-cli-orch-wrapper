## ADDED Requirements

### Requirement: /gh-pr-followup command handles PR review comments
The system SHALL provide a `/gh-pr-followup` command that fetches unresolved review threads for a given Pull Request using the GitHub GraphQL API. It SHALL evaluate each thread to determine if it should be immediately resolved or deferred to a new issue.

#### Scenario: Fetching and evaluating threads
- **WHEN** a user invokes `/gh-pr-followup` with a PR number
- **THEN** the system fetches all `isResolved: false` review threads for the PR
- **AND** evaluates or asks the user whether to resolve or defer each thread

### Requirement: Immediate resolution of review threads
The system SHALL allow immediate resolution of review threads by modifying the local codebase, writing a reply using `addPullRequestReviewThreadReply`, and resolving the thread using `resolveReviewThread`.

#### Scenario: Quick fix resolution
- **WHEN** a review thread is deemed a quick fix
- **THEN** the system applies the necessary code changes
- **AND** executes GraphQL mutations to reply to and resolve the thread on GitHub

### Requirement: Deferral of review threads
The system SHALL allow deferring complex review threads by creating a new GitHub issue. The issue SHALL have the `origin:review` label, reference the source PR in the body, and be added to Project #3 Backlog.

#### Scenario: Complex task deferral
- **WHEN** a review thread is deemed too large for an immediate fix
- **THEN** the system creates a new issue with the `origin:review` label
- **AND** adds the newly created issue to the Project #3 Backlog
