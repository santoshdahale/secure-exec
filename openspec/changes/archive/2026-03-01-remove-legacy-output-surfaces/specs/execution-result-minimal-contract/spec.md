## ADDED Requirements

### Requirement: Execution Results MUST Exclude Buffered Output Fields
The runtime SHALL return minimal execution results that do not include runtime-managed `stdout` or `stderr` capture fields.

#### Scenario: Exec result contains status without output buffers
- **WHEN** `NodeProcess.exec()` completes in default logging mode
- **THEN** the returned result MUST include execution status fields and MUST NOT include `stdout`/`stderr` properties

#### Scenario: Run result contains exports without output buffers
- **WHEN** `NodeProcess.run()` completes and returns module exports
- **THEN** the returned result MUST include `code` and `exports` semantics and MUST NOT include `stdout`/`stderr` properties

### Requirement: Failure Details MUST Be Exposed Without Log Buffer Retention
The runtime SHALL expose deterministic failure metadata without retaining unbounded per-execution log buffers.

#### Scenario: Runtime error remains observable without stderr capture
- **WHEN** execution fails due to runtime error
- **THEN** callers MUST receive deterministic failure metadata sufficient for debugging without requiring buffered `stderr` output capture
