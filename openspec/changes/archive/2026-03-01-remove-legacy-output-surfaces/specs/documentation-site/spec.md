## MODIFIED Requirements

### Requirement: Quickstart Uses Steps With Runnable Example
The Quickstart page SHALL present onboarding steps using Mintlify `<Steps>` and SHALL include at least one basic runnable example that verifies setup success using the current runtime logging contract.

#### Scenario: Steps component structures onboarding
- **WHEN** the Quickstart page is rendered
- **THEN** the page MUST contain a `<Steps>` block with ordered setup actions

#### Scenario: Quickstart includes basic verification example
- **WHEN** a user follows the Quickstart page
- **THEN** the page MUST provide at least one concrete command example and expected successful outcome text

#### Scenario: Quickstart does not rely on legacy buffered output fields
- **WHEN** Quickstart demonstrates how to read execution logs
- **THEN** it MUST use hook-based log streaming examples and MUST NOT instruct users to read `result.stdout` or `result.stderr`
