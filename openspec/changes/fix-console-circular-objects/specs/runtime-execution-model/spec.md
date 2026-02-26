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
