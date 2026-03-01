## Why

Recent runtime changes made console output drop-by-default with optional streaming hooks, but several legacy output-capture surfaces and dead symbols remain. This creates confusing API/documentation contracts, stale tests, and unnecessary host-memory risk from leftover buffering paths.

## What Changes

- **BREAKING**: remove `stdout`/`stderr` fields from `ExecResult` and `RunResult`; expose only deterministic execution status (`code`, `exports` for `run`) plus explicit error metadata for runtime failures.
- Keep console output delivery exclusively through `onConsoleLog` streaming hooks; no runtime-managed result buffering in Node or browser runtimes.
- Remove confirmed dead/legacy symbols found by strict unused checks (unused fields, helpers, and type aliases) in runtime/bridge sources.
- Replace stale log-buffering regression test with exploit-oriented tests that assert no accumulation under high-volume logging.
- Update quickstart/security/compat docs to remove `result.stdout` examples and show hook-based log consumption.

## Capabilities

### New Capabilities
- `execution-result-minimal-contract`: Define minimal non-buffered execution result shape and migration expectations.

### Modified Capabilities
- `node-runtime`: Runtime result contract and logging behavior wording updated to remove legacy `stdout`/`stderr` result fields.
- `documentation-site`: Quickstart/runtime examples updated to match hook-based logging contract.
- `compatibility-governance`: Ensure required exploit-focused tests cover memory-amplification regressions for logging/output paths.

## Impact

- Affected code: `packages/secure-exec/src/shared/api-types.ts`, `packages/secure-exec/src/index.ts`, `packages/secure-exec/src/execution.ts`, browser runtime files, bridge cleanup sites (`bridge/fs.ts`, `bridge/module.ts`, `shared/permissions.ts`, `bridge/child-process.ts`), tests, docs.
- API impact: Type-level and runtime response shape changes for `exec()`/`run()` consumers.
- Governance impact: stronger regression coverage around memory/CPU amplification vectors tied to output handling.
