## ADDED Requirements

### Requirement: Circular-Safe Console Output Capture
The sandbox console capture SHALL handle circular object references without throwing, replacing circular references with a `[Circular]` marker in the serialized output.

#### Scenario: Log object with circular reference
- **WHEN** sandboxed code calls `console.log` with an object that contains a circular reference
- **THEN** the captured stdout MUST contain the serialized object with `[Circular]` substituted for the circular reference, and execution MUST NOT throw

#### Scenario: Log deeply nested circular reference
- **WHEN** sandboxed code calls `console.log` with an object where a circular reference occurs at depth > 1
- **THEN** the captured stdout MUST contain the partially serialized object with `[Circular]` at the circular node

#### Scenario: Log null and undefined values
- **WHEN** sandboxed code calls `console.log` with `null` or `undefined` arguments
- **THEN** the captured stdout MUST contain `"null"` or `"undefined"` respectively, without throwing

#### Scenario: Console error and warn handle circular objects
- **WHEN** sandboxed code calls `console.error` or `console.warn` with a circular object
- **THEN** the captured stderr MUST contain the serialized object with `[Circular]` markers, and execution MUST NOT throw

### Requirement: Bounded Console Serialization Work
Console argument serialization SHALL enforce bounded work for very large or deeply nested payloads by applying depth, key-count, array-length, and output-length limits with deterministic truncation markers.

#### Scenario: Deep object logging is bounded
- **WHEN** sandboxed code logs an object that exceeds the configured depth budget
- **THEN** serialization MUST stop descending past the budget and emit a deterministic depth marker instead of unbounded traversal

#### Scenario: Large object or array logging is bounded
- **WHEN** sandboxed code logs an object/array that exceeds key-count or element-count budgets
- **THEN** serialization MUST truncate beyond the configured limits and emit a deterministic truncation marker

#### Scenario: Oversized output is bounded
- **WHEN** serialized console output exceeds the maximum output-length budget
- **THEN** the captured output MUST be truncated to the configured size with a deterministic suffix marker
