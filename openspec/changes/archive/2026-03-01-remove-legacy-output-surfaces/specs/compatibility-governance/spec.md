## MODIFIED Requirements

### Requirement: Logging Capture Contract Changes MUST Update Compatibility And Security Docs
Any change that introduces or modifies runtime log-capture defaults or hook-based logging behavior MUST update compatibility/friction/security documentation in the same change and MUST include exploit-oriented regression tests for host resource amplification.

#### Scenario: Runtime switches default logging behavior
- **WHEN** runtime logging defaults change (for example from buffered capture to log-drop)
- **THEN** `docs-internal/friction/secure-exec.md` MUST document the compatibility impact and resource-exhaustion rationale in the same change

#### Scenario: Runtime introduces or changes log-stream hook behavior
- **WHEN** runtime log-stream hook contract changes (event shape, ordering semantics, or failure behavior)
- **THEN** `docs/security-model.mdx` MUST describe trust-boundary and resource-consumption implications and `docs/node-compatability.mdx` MUST reflect user-visible behavior changes where applicable

#### Scenario: Logging changes include exploit regression coverage
- **WHEN** logging/output behavior is changed in runtime or bridge paths
- **THEN** the same change MUST include tests that assert high-volume log emission does not create unbounded host-memory accumulation
