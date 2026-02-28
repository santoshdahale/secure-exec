## 1. Reorganize Isolate Runtime Source Layout

- [x] 1.1 Create `packages/secure-exec/isolate-runtime/src/inject/` and move all isolate inject entry scripts there.
- [x] 1.2 Create `packages/secure-exec/isolate-runtime/src/common/` and move shared helpers/contracts there.
- [x] 1.3 Update `packages/secure-exec/isolate-runtime/README.md` mapping to reflect the new `src/inject` and `src/common` structure.

## 2. Update Isolate-Runtime Build and Manifest Generation

- [x] 2.1 Update `packages/secure-exec/scripts/build-isolate-runtime.mjs` to discover inject entrypoints from `isolate-runtime/src/inject`.
- [x] 2.2 Ensure inject entrypoints can consume `src/common` modules while still emitting standalone runtime-injectable artifacts.
- [x] 2.3 Preserve existing manifest source IDs used by host runtime callsites and verify `src/generated/isolate-runtime.ts` compatibility.

## 3. Harden Isolate-Runtime Typing Contracts

- [x] 3.1 Introduce explicit runtime-global type contracts for isolate inject/common source (type-only declarations).
- [x] 3.2 Replace `globalThis as Record<string, unknown>` cast patterns in inject files with explicit typed global access.
- [x] 3.3 Narrow avoidable `unknown` usage in dynamic-import/fs/global-policy inject paths while preserving boundary-safe `unknown` at intentional trust boundaries.

## 4. Enforce Typecheck Coverage for Isolate Runtime Sources

- [x] 4.1 Add dedicated isolate-runtime typecheck configuration/command covering `isolate-runtime/src/inject` and `isolate-runtime/src/common`.
- [x] 4.2 Wire isolate-runtime typecheck into package/turbo validation flow so regressions fail CI.
- [x] 4.3 Add or update targeted tests validating isolate-runtime manifest/build behavior under the new layout.

## 5. Validate, Document, and Track Friction

- [x] 5.1 Run secure-exec typechecks and targeted runtime tests after the refactor and fix regressions.
- [x] 5.2 Update `docs-internal/friction/secure-exec.md` with typing/layout friction notes and mark resolved with concrete fix details.
- [x] 5.3 Confirm OpenSpec artifacts remain consistent with implementation outcomes and update deltas if implementation decisions change.
