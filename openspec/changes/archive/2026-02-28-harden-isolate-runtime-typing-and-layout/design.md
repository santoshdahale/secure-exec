## Context

`secure-exec` currently evaluates isolate bootstrap code from static files under `packages/secure-exec/isolate-runtime/`, but the source tree is flat and most inject scripts repeatedly cast `globalThis` to `Record<string, unknown>`. This makes runtime-global contracts hard to audit and weakens compile-time safety around isolate bridge state.

The requested change combines two concerns that are coupled in practice:
1. Improve typing quality in isolate runtime injection code (remove as many avoidable `unknown` forms as possible while preserving boundary-safe semantics).
2. Reorganize isolate runtime source into explicit inject entrypoints and shared common code (`src/inject`, `src/common`) so contracts and reuse are maintainable.

Constraints:
- Preserve Node.js behavior targets and avoid runtime semantic drift.
- Keep host-to-isolate injection sourced from static TypeScript modules.
- Keep build outputs and source IDs stable enough that host runtime loaders continue to resolve known inject entries.

## Goals / Non-Goals

**Goals:**
- Establish a canonical isolate-runtime source topology:
  - `packages/secure-exec/isolate-runtime/src/inject/*.ts`
  - `packages/secure-exec/isolate-runtime/src/common/**`
- Replace repeated broad global casts with explicit typed global contracts.
- Reduce avoidable `unknown` usage in inject code without weakening boundary safety.
- Ensure isolate-runtime typing is checked during normal package validation.
- Keep runtime behavior equivalent to current contracts.

**Non-Goals:**
- Changing runtime feature semantics (module resolution, permissions, timing policy, bridge behavior).
- Rewriting all require polyfill internals for maximal type strictness in one pass.
- Introducing fixture-specific runtime logic or compatibility exceptions.

## Decisions

### 1. Partition isolate-runtime source by role
**Decision:** Move isolate runtime sources under `isolate-runtime/src/` with:
- `inject/` for host-evaluated entry scripts that map to manifest IDs.
- `common/` for shared utilities and type-only declarations used by inject entries.

**Rationale:** This makes inject boundaries explicit and avoids continuing a flat file layout that mixes entrypoints with reusable internals.

**Alternatives considered:**
- Keep flat `isolate-runtime/` structure and add naming prefixes only.
  - Rejected: weaker structural guarantees and poorer discoverability.

### 2. Keep manifest entry IDs stable while changing source layout
**Decision:** Update isolate-runtime build mapping so manifest IDs remain stable (for example `setupDynamicImport`, `bridgeInitialGlobals`) even though source files move to `src/inject`.

**Rationale:** This minimizes host-loader churn and reduces migration risk in runtime callsites that already use `getIsolateRuntimeSource("...")`.

**Alternatives considered:**
- Rename all source IDs to include `srcInject` path context.
  - Rejected: unnecessary host callsite churn for no runtime-value gain.

### 3. Compile inject entrypoints as self-contained runtime artifacts
**Decision:** Update build logic to treat `src/inject/*.ts` as entrypoints and permit imports from `src/common/**` while still emitting executable standalone source strings for manifest/runtime injection.

**Rationale:** Shared code in `src/common` should be allowed without forcing runtime module resolution inside `context.eval` payloads.

**Alternatives considered:**
- Forbid imports and duplicate common logic across inject files.
  - Rejected: increases drift and maintenance cost.
- Keep transform-only compilation with unresolved imports.
  - Rejected: inject payloads are executed as standalone code and cannot rely on runtime module loading.

### 4. Use explicit runtime global contracts to replace broad casts
**Decision:** Define isolate runtime global contracts in type-only declarations and consume them directly from `globalThis` in inject code.

**Rationale:** Most current `unknown` usage comes from repeated `Record<string, unknown>` casting rather than real trust boundaries; typed contracts improve safety and readability with minimal behavior risk.

**Alternatives considered:**
- Keep broad casts and only add helper wrappers.
  - Rejected: still leaks broad `unknown` across all scripts.

### 5. Preserve intentional `unknown` at trust boundaries
**Decision:** Retain `unknown` where values are intentionally unconstrained (for example expose-global value payloads, dynamic import argument coercion, `module.exports`, and v8 shim serialization inputs).

**Rationale:** Replacing these with narrower types would encode false assumptions and risk semantic regressions.

**Alternatives considered:**
- Eliminate all `unknown` regardless of boundary semantics.
  - Rejected: would reduce correctness and likely require unsafe casts elsewhere.

### 6. Add isolate-runtime typecheck coverage to validation workflow
**Decision:** Add dedicated isolate-runtime typecheck configuration and wire it into package validation so isolate-runtime typing regressions fail fast.

**Rationale:** `packages/secure-exec/tsconfig.json` currently includes only `src/**/*`, so isolate-runtime typing quality is not enforced.

**Alternatives considered:**
- Keep typecheck coverage limited to `src/**` and rely on review discipline.
  - Rejected: does not enforce the requested typing hardening.

## Risks / Trade-offs

- [Build pipeline complexity increases due to new source tree and entrypoint handling] → Mitigation: keep build script deterministic, preserve stable source IDs, and add focused tests for manifest outputs.
- [Typing hardening might accidentally alter runtime behavior if refactors mix typing and logic] → Mitigation: enforce no-op logic changes in typing commits and run runtime tests after each phase.
- [Strict typecheck of all isolate-runtime files may expose legacy polyfill typing debt] → Mitigation: scope initial enforcement to inject/common contracts with explicit follow-up tasks for deeper polyfill typing work.
- [Path migration could break references in docs/tests/scripts] → Mitigation: update isolate-runtime inventory docs and injection-policy tests in the same change.

## Migration Plan

1. Create the new directory structure and move inject entrypoints to `isolate-runtime/src/inject` with common utilities/types under `isolate-runtime/src/common`.
2. Update build/manifest generation to discover inject entries from the new path and compile them into existing `dist/isolate-runtime/**` plus generated manifest output.
3. Introduce runtime global type contracts and apply targeted typing refactors in inject files.
4. Add isolate-runtime typecheck target and wire it into `pnpm`/turbo validation commands.
5. Run targeted runtime/type tests and verify no behavior regression.

Rollback:
- Revert this change as a single unit if inject artifact generation or runtime parity regresses; previous flat-path artifacts remain the known-good baseline.

## Open Questions

- Should isolate-runtime typecheck gating include `require-setup.ts` in the first pass, or should that file be tracked as a follow-up typing-hardening milestone?
- Should manifest ID derivation remain purely filename-based or switch to explicit registry mapping for long-term stability guarantees?
