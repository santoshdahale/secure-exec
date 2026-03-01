## Context

`secure-exec` runtime behavior was intentionally changed to drop console output by default and stream logs via `onConsoleLog`, but the public result types still expose legacy `stdout`/`stderr` fields. The repository also has stale artifacts tied to old behavior:

- `packages/secure-exec/tests/logging-load.test.ts` still expects multi-megabyte `result.stdout` buffering and currently fails.
- `docs/quickstart.mdx` still demonstrates `console.log(result.stdout)`.
- strict unused-symbol scan (`tsc --noEmit --noUnusedLocals --noUnusedParameters`) reports dead symbols in runtime/bridge modules.

This mismatch increases maintenance cost, obscures intended behavior, and leaves unnecessary memory-amplification paths.

## Goals / Non-Goals

**Goals:**
- Remove legacy execution-result output capture fields from runtime APIs.
- Keep output delivery hook-only and non-buffering by default across runtimes.
- Delete confirmed dead symbols/properties/methods that no longer participate in runtime behavior.
- Replace stale logging tests/docs with exploit-oriented no-buffer assertions.

**Non-Goals:**
- Redesign child-process API semantics beyond removal of dead placeholders.
- Introduce a new persistent logging backend or retention store.
- Change project-matrix pass/fail fixture policy.

## Decisions

1. Remove `stdout`/`stderr` from `ExecResult` and `RunResult` (breaking change).
- Rationale: current contract is misleading and encourages polling result buffers that should stay absent for safety.
- Alternative considered: keep empty fields indefinitely for compatibility. Rejected because it preserves ambiguous API and stale usage patterns.

2. Preserve deterministic failure visibility with explicit non-buffered error metadata.
- Rationale: callers still need failure reasons without reopening unbounded output capture.
- Alternative considered: throw for all failures and remove result metadata. Rejected to avoid broad behavioral churn in existing `exec` flow.

3. Remove dead symbols found by strict compiler scan and manual bridge review.
- Targets include unused flags in `NodeProcess`, dead helper/types in `bridge/fs.ts` and `bridge/module.ts`, and unused imports in permission wrappers.
- Alternative considered: keep symbols as comments or `_` placeholders. Rejected because these are not compatibility contracts and add maintenance noise.

4. Replace legacy logging-load test with exploit-focused regression tests.
- Rationale: testing should enforce that high-volume logs do not accumulate in runtime-managed buffers.
- Alternative considered: delete stale tests without replacement. Rejected because we would lose regression coverage for a known resource-exhaustion vector.

## Risks / Trade-offs

- [Consumer breakage from result type changes] -> Mitigation: mark breaking in proposal/specs, update type tests, provide migration examples using `onConsoleLog`.
- [Loss of convenience for callers that relied on `result.stderr`] -> Mitigation: provide explicit bounded error metadata in results and updated docs.
- [Node/browser runtime behavior drift] -> Mitigation: align contracts in shared API types and add parity tests for logging defaults.
- [Over-removal of symbols that are intentionally reserved] -> Mitigation: limit removals to symbols proven unused by compiler diagnostics or direct file-scope analysis.

## Migration Plan

1. Update shared result types and runtime return shapes.
2. Refactor Node and browser execution pipelines to remove legacy `stdout`/`stderr` result plumbing.
3. Update tests:
- remove/replace stale buffering assertions
- add exploit regression checks for high-volume logs
- update type tests for new result contract
4. Update docs (`quickstart`, `node-compatability`, `security-model`, friction notes).
5. Run focused checks (`check-types`, targeted vitest files) before merge.

Rollback: revert result-type and runtime-shape commits as one unit; keep dead-code removals isolated in separate commits if split rollout is needed.

## Open Questions

- Should runtime failure metadata be `error?: { message: string; kind?: string }` or a flat `errorMessage?: string`?
- Should browser worker expose the same `onConsoleLog` hook API in this change or in a follow-up?
