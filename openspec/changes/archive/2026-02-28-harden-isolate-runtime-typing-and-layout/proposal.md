## Why

The isolate runtime source currently relies on broad `globalThis as Record<string, unknown>` casts and scattered `unknown` typing that weakens type safety and obscures runtime contracts. At the same time, isolate-injected code lives flat under `isolate-runtime/`, making shared logic and inject-entry boundaries harder to maintain as the runtime grows.

## What Changes

- Reorganize isolate runtime sources into explicit domains:
  - `packages/secure-exec/isolate-runtime/src/inject/{file}.ts` for host-evaluated inject entrypoints.
  - `packages/secure-exec/isolate-runtime/src/common/**` for shared runtime helpers/types used by inject entrypoints.
- Introduce explicit isolate runtime global contracts (ambient/type-only declarations) and replace broad `Record<string, unknown>` casts with concrete typed global properties.
- Reduce avoidable `unknown` usage in inject code while preserving boundary-safe `unknown` at trust boundaries (for example runtime value plumbing and untyped module exports).
- Update isolate-runtime build/manifest generation to compile inject entrypoints from the new `src/inject` tree and support shared `src/common` dependencies.
- Add/upgrade isolate-runtime typecheck coverage so typing regressions in isolate-runtime source fail CI alongside existing package checks.

## Capabilities

### New Capabilities
- `isolate-runtime-source-architecture`: define canonical isolate-runtime source layout and build expectations for inject entrypoints plus shared common modules.

### Modified Capabilities
- `node-runtime`: strengthen static isolate-runtime source requirements to include enforceable typing contracts and typecheck coverage for isolate-runtime artifacts.

## Impact

- Affected code:
  - `packages/secure-exec/isolate-runtime/**`
  - `packages/secure-exec/scripts/build-isolate-runtime.mjs`
  - `packages/secure-exec/src/generated/isolate-runtime.ts` (generated)
  - `packages/secure-exec/package.json`, `packages/secure-exec/tsconfig*`, and related test coverage
- Build/task graph impact: isolate-runtime compile and check-type steps must account for `src/inject` and `src/common` paths.
- No intended runtime behavior change for sandbox execution semantics; this is a maintainability and safety hardening change.
