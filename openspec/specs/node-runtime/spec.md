# node-runtime Specification

## Purpose
Define runtime execution contracts, module loading behavior, async completion semantics, and dynamic import behavior.
## Requirements
### Requirement: Unified Sandbox Execution Interface
The project SHALL provide a stable sandbox execution interface for both Node and browser runtimes, with each runtime exposing an `exec` path for running untrusted code and returning structured execution results. Dynamic `import()` expressions within executed code SHALL evaluate lazily at call time rather than eagerly during setup.

#### Scenario: Execute code in Node runtime
- **WHEN** a caller creates `NodeProcess` with a valid driver and invokes `exec`
- **THEN** the sandbox MUST run the provided code in an isolated execution context and return structured output for the caller

#### Scenario: Execute code in browser runtime
- **WHEN** a caller creates `BrowserSandbox` and invokes `exec`
- **THEN** the sandbox MUST execute code in a Worker-backed isolated context and return structured output for the caller

#### Scenario: Dynamic imports in executed code evaluate lazily
- **WHEN** a caller invokes `exec` with code containing `import()` expressions
- **THEN** the execution pipeline MUST defer module evaluation until the `import()` expression is reached during code execution, preserving correct side-effect ordering

### Requirement: Driver-Based Capability Composition
Runtime capabilities SHALL be composed through host-provided drivers so filesystem, network, and child-process behavior are controlled by configured adapters rather than hardcoded runtime behavior.

#### Scenario: Node process uses configured adapters
- **WHEN** `NodeProcess` is created with a driver that defines filesystem, network, and command-execution adapters
- **THEN** sandboxed operations MUST route through those adapters for capability access

#### Scenario: Omitted capability remains unavailable
- **WHEN** a capability adapter is omitted from runtime configuration
- **THEN** corresponding sandbox operations MUST be unavailable or denied by the runtime contract

### Requirement: Active Handle Completion for Async Operations
The Node runtime SHALL wait for tracked active handles before finalizing execution results so callback-driven asynchronous work can complete.

#### Scenario: Child process output completes before exec resolves
- **WHEN** sandboxed code starts a child process and registers active-handle lifecycle events
- **THEN** `exec` MUST wait for handle completion before returning final output

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

### Requirement: Host-to-Sandbox HTTP Verification Path
The Node runtime SHALL expose a host-side request path for sandboxed HTTP servers so loader/host code can verify server behavior externally.

#### Scenario: Host fetches sandbox server endpoint
- **WHEN** sandboxed code starts an HTTP server through the bridged server APIs
- **THEN** host code MUST be able to issue requests through the runtime network facade and receive the sandbox server response

### Requirement: Lazy Evaluation of Dynamic Imports
Dynamically imported modules (`import()`) SHALL be evaluated only when the import expression is reached during user code execution, not during the precompilation phase.

#### Scenario: Side effects execute at import call time
- **WHEN** user code contains `console.log("before"); const m = await import("./side-effect"); console.log("after")` where `./side-effect` logs "side-effect" on evaluation
- **THEN** stdout MUST contain "before", "side-effect", "after" in that order

#### Scenario: Conditional dynamic import skips unused branch
- **WHEN** user code contains `if (false) { await import("./unused"); }` where `./unused` logs "loaded" on evaluation
- **THEN** stdout MUST NOT contain "loaded"

#### Scenario: Repeated dynamic import returns same module without re-evaluation
- **WHEN** user code calls `await import("./mod")` twice, where `./mod` increments a global counter on evaluation
- **THEN** the counter MUST equal 1 after both imports, and both calls MUST return the same module namespace

### Requirement: Precompilation Without Evaluation
The precompilation phase SHALL resolve and compile dynamic import targets but MUST NOT instantiate or evaluate them.

#### Scenario: Precompiled module has no side effects before user code
- **WHEN** a module targeted by a static `import("./target")` specifier logs to console on evaluation
- **THEN** no console output from that module SHALL appear before user code begins executing

### Requirement: Async Dynamic Import Resolution
The `__dynamicImport` bridge function SHALL return a Promise that resolves to the module namespace, performing instantiation and evaluation on demand.

#### Scenario: Dynamic import resolves to module namespace
- **WHEN** user code calls `const m = await import("./mod")` where `./mod` exports `{ value: 42 }` as default
- **THEN** `m.default` MUST equal `{ value: 42 }`

#### Scenario: Dynamic import of non-existent module rejects
- **WHEN** user code calls `await import("./nonexistent")`
- **THEN** the returned Promise MUST reject with an error indicating the module cannot be resolved

### Requirement: Configurable CPU Time Limit for Node Runtime Execution
The Node runtime MUST support an optional `cpuTimeLimitMs` execution budget for sandboxed code and MUST enforce it as a shared per-execution deadline across runtime calls that execute user-controlled code.

#### Scenario: Infinite loop is interrupted by configured CPU limit
- **WHEN** a caller configures `cpuTimeLimitMs` and executes code that does not terminate (for example `while(true){}`)
- **THEN** the runtime MUST interrupt execution once the configured budget is exhausted and return a timeout failure contract

#### Scenario: Shared deadline is enforced across multiple execution phases
- **WHEN** a caller configures `cpuTimeLimitMs` and execution spends time across multiple user-code phases (for example module evaluation plus later active-handle waiting)
- **THEN** the runtime MUST apply one shared budget across phases rather than resetting timeout per phase

#### Scenario: Timeout contract is deterministic
- **WHEN** execution exceeds a configured `cpuTimeLimitMs`
- **THEN** the runtime MUST return `code` `124` and include `CPU time limit exceeded` in stderr

#### Scenario: Unset CPU limit preserves existing runtime behavior
- **WHEN** a caller does not configure `cpuTimeLimitMs`
- **THEN** the runtime MUST preserve existing no-timeout behavior for execution duration control

### Requirement: Isolate Recovery After Timeout
When execution exceeds a configured CPU budget, the runtime MUST recycle isolate state before serving subsequent executions.

#### Scenario: Timeout execution does not leak state into next run
- **WHEN** an execution times out due to `cpuTimeLimitMs`
- **THEN** the next execution on the same `NodeProcess` instance MUST start from a fresh isolate state

### Requirement: Optional Timing Side-Channel Mitigation Profile
The Node runtime MUST provide timing mitigation controls that reduce high-resolution timing signals exposed to sandboxed code, with security-first default behavior.

#### Scenario: Default timing mode freezes execution clocks
- **WHEN** a caller executes code with `timingMitigation` unset
- **THEN** repeated reads of `Date.now()`, `performance.now()`, and `process.hrtime()` within the same execution MUST return deterministic frozen-time values

#### Scenario: Compatibility mode restores Node-like clocks
- **WHEN** a caller executes code with `timingMitigation` set to `"off"`
- **THEN** `Date.now()` and `performance.now()` MUST advance with real execution time semantics

#### Scenario: Default timing mode removes shared-memory timing primitive
- **WHEN** a caller executes code with `timingMitigation` unset
- **THEN** `SharedArrayBuffer` MUST NOT be available on `globalThis`

### Requirement: Package Metadata-Aware Module Classification
The runtime MUST classify JavaScript modules using Node-compatible metadata rules (extension plus nearest `package.json` module type), not source-token heuristics alone.

#### Scenario: .js under type module is treated as ESM
- **WHEN** a package has `package.json` with `"type": "module"` and sandboxed code loads `./index.js`
- **THEN** the runtime MUST evaluate the file as ESM semantics (including `import.meta` availability and ESM export behavior)

#### Scenario: .js under type commonjs is treated as CJS
- **WHEN** a package has `package.json` with `"type": "commonjs"` (or no ESM override) and sandboxed code loads `./index.js` via `require`
- **THEN** the runtime MUST evaluate the file as CommonJS and return `module.exports`

### Requirement: Dynamic Import Error Fidelity
Dynamic `import()` handling MUST preserve Node-like failure behavior by surfacing ESM compile/instantiate/evaluate errors directly and avoiding unintended fallback masking.

#### Scenario: ESM syntax failure rejects without require fallback masking
- **WHEN** user code executes `await import("./broken.mjs")` and `./broken.mjs` contains invalid ESM syntax
- **THEN** the Promise MUST reject with an ESM compile/evaluation error for that module rather than a fallback `require()`-style resolution error

#### Scenario: ESM runtime failure rejects with module error
- **WHEN** user code executes `await import("./throws.mjs")` and the imported module throws during evaluation
- **THEN** the Promise MUST reject with that evaluation failure and MUST NOT re-route to CommonJS fallback

### Requirement: CJS Namespace Shape for Dynamic Import
When dynamic `import()` resolves a CommonJS module, the returned namespace object MUST preserve Node-compatible default semantics for `module.exports` values across object, function, primitive, and null exports.

#### Scenario: Primitive CommonJS export is accessible as default
- **WHEN** sandboxed code executes `await import("./primitive.cjs")` and `primitive.cjs` sets `module.exports = 7`
- **THEN** the namespace result MUST expose `default === 7` without throwing during namespace construction

#### Scenario: Null CommonJS export is accessible as default
- **WHEN** sandboxed code executes `await import("./nullish.cjs")` and `nullish.cjs` sets `module.exports = null`
- **THEN** the namespace result MUST expose `default === null` without throwing during namespace construction

