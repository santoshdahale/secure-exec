## Why

`NodeProcess` currently mixes orchestration with Node/`isolated-vm` runtime implementation details, which makes driver boundaries unclear and keeps capability policy split across constructor fallbacks and driver construction. We need a strict driver-owned runtime model now to simplify ownership, enforce deny-by-default behavior consistently, and make future runtime backends easier to add.

## What Changes

- **BREAKING**: Require `NodeProcess` to be created with a `driver`; remove fallback construction of a default driver inside `NodeProcess`.
- **BREAKING**: Remove direct capability injection options from `NodeProcess` (`filesystem`, `networkAdapter`, `commandExecutor`, `permissions`) and centralize capability setup in driver construction.
- Move Node/`isolated-vm` execution-heavy responsibilities into `NodeDriver` implementation, while keeping `NodeProcess` as the bridge/loader orchestrator over a generic runtime-driver interface.
- Make permission defaults explicit and secure: driver defaults to reject/deny all capability access unless permission checks are provided.
- Keep `processConfig` and `osConfig` as required runtime inputs on `NodeProcess`, sourced from driver-owned configuration and injected by `NodeProcess` during bridge/bootstrap.
- Temporarily disable browser runtime support for this phase by commenting out browser-facing paths and exports until driver-boundary refactor is stabilized.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `runtime-execution-model`: tighten runtime construction contract (required driver), shift runtime ownership to driver-backed execution interface, and temporarily remove browser execution path requirements.

## Impact

- `packages/sandboxed-node/src/index.ts` (`NodeProcess` options/constructor contract, runtime orchestration boundary, browser exports and references)
- `packages/sandboxed-node/src/node/driver.ts` (driver-owned runtime execution logic, deny-by-default permission defaults)
- `packages/sandboxed-node/src/types.ts` (new generic runtime-driver interfaces and updated public constructor types)
- `packages/sandboxed-node/src/browser/*` (commented-out or temporarily disabled integration surface)
- `packages/sandboxed-node/tests/index.test.ts` and related call sites currently using `new NodeProcess()` or direct constructor adapters
- README/examples/docs referencing constructor patterns and browser runtime availability
