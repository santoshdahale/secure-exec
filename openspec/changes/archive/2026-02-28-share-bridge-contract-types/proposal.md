## Why

Bridge type contracts are currently duplicated across host runtime setup, bridge modules, and isolate runtime globals, which causes drift and weakens compile-time guarantees. We need a single shared contract model, similar to the `rivetkit` dynamic isolate bridge pattern, so bridge keys and envelope/reference types stay synchronized.

## What Changes

- Introduce a canonical shared bridge contract module in `packages/secure-exec/src/shared/` that defines:
  - global key constants for host-injected bridge globals
  - envelope payload interfaces and bridge reference signatures
  - type aliases used by both host and isolate sides
- Refactor bridge modules and runtime wiring to consume these shared types instead of per-file ad-hoc declarations.
- Wire isolate-runtime typing contracts to reuse shared bridge types via type-only imports where safe.
- Add regression coverage ensuring shared bridge contract keys remain consistent with runtime injection and bridge consumption paths.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `node-bridge`: add requirements for a canonical shared bridge type contract and key consistency across host/runtime/bridge boundaries.

## Impact

- Affected code:
  - `packages/secure-exec/src/shared/**`
  - `packages/secure-exec/src/bridge/**`
  - `packages/secure-exec/src/index.ts`
  - `packages/secure-exec/isolate-runtime/src/common/**`
- No intended behavior change to sandbox capability semantics; this is contract hardening and maintainability improvement.
- Reduces typing drift risk for bridge globals and envelope payloads across runtime layers.
