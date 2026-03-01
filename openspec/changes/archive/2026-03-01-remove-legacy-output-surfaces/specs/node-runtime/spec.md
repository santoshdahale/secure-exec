## MODIFIED Requirements

### Requirement: Runtime Default Logging Mode Drops Console Output
Runtime logging SHALL be drop-on-floor by default: if no explicit log hook is configured, console emissions MUST NOT be retained in runtime-managed execution buffers or surfaced through legacy result output fields.

#### Scenario: Exec without log hook does not capture console output
- **WHEN** sandboxed code emits `console.log` and `console.error` and runtime executes without a configured log hook
- **THEN** execution MUST complete without buffered log capture and execution results MUST NOT expose buffered `stdout`/`stderr` fields

### Requirement: Runtime Exposes Optional Streaming Log Hook
The Node runtime SHALL expose an optional host hook for streaming console log events (`stdout` and `stderr` channels) in emission order, without retaining runtime-owned history.

#### Scenario: Hook receives ordered events across stdout and stderr channels
- **WHEN** sandboxed code emits interleaved `console.log`, `console.warn`, and `console.error` calls with a configured hook
- **THEN** the hook MUST receive ordered events with channel metadata matching the original emission sequence

#### Scenario: Hook-enabled runtime still avoids buffered accumulation
- **WHEN** high-volume logging is emitted with a configured hook
- **THEN** secure-exec runtime MUST stream events to the hook without accumulating unbounded per-execution log buffers in host memory

## ADDED Requirements

### Requirement: Runtime Execution Result Contract Is Output-Buffer Free
The Node runtime SHALL use an execution result contract that omits runtime-managed output capture fields and relies on explicit hooks/metadata instead.

#### Scenario: Result typing excludes legacy stdout and stderr fields
- **WHEN** runtime API result types are consumed from `secure-exec`
- **THEN** TypeScript definitions for execution results MUST NOT include `stdout` or `stderr` properties
