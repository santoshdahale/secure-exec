## Why

The sandbox console (`console.log`, `console.error`, etc.) uses `JSON.stringify` to serialize objects. This throws `TypeError: Converting circular structure to JSON` when sandboxed code logs objects with circular references, crashing the script instead of producing output. Real Node.js `console.log` handles circular objects gracefully via `util.inspect`.

## What Changes

- Replace the `JSON.stringify` call in `setupConsole()` with a circular-safe formatter inside the isolate.
- The formatter detects circular references and replaces them with a `[Circular]` marker, matching Node.js convention.
- Add test coverage for logging circular objects.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `node-runtime`: Console output capture must not throw on circular objects.

## Impact

- `packages/sandboxed-node/src/index.ts` - `setupConsole()` method, inline eval'd code.
- No API changes. `ExecResult` / `RunResult` stdout/stderr shape is unchanged.
