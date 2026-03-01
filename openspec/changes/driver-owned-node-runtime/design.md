## Context

`NodeProcess` currently combines two responsibilities: runtime orchestration and Node/`isolated-vm` execution internals. The constructor also accepts direct capability adapters and permissions, while `createNodeDriver` separately applies capability/permission defaults. This split causes ownership ambiguity and policy drift.

This change adopts a strict boundary:
- Driver owns capability and execution-heavy behavior.
- `NodeProcess` remains the orchestrator for bridge/loader flow over a generic runtime-driver interface.
- Runtime configuration (`processConfig`, `osConfig`) is always injected by `NodeProcess`, but sourced from the driver contract.

For this phase, browser support is intentionally disabled to reduce cross-runtime coupling while the Node boundary is refactored.

## Goals / Non-Goals

**Goals:**
- Make `driver` required for `NodeProcess` construction.
- Remove direct capability injection from `NodeProcess` options and move ownership into driver construction.
- Normalize permission behavior to deny-by-default at driver level.
- Keep bridge/loader orchestration in `NodeProcess` but drive it through a generic execution interface.
- Preserve current Node runtime behavior (run/exec semantics, active-handle wait, host network facade) after boundary changes.
- Temporarily disable browser runtime exports/paths during refactor.

**Non-Goals:**
- Restoring browser runtime support in this change.
- Introducing new sandbox capabilities beyond the existing fs/network/child_process/process/os/runtime set.
- Reworking bridge module semantics unrelated to ownership boundaries.

## Decisions

### 1. Require driver at construction

**Choice:** `NodeProcessOptions.driver` becomes required, and constructor fallback logic that synthesizes a driver from raw options is removed.

**Rationale:** This creates a single capability source of truth and removes implicit behavior.

**Alternative considered:** Keep optional driver for backward compatibility. Rejected because it preserves split ownership and duplicate policy paths.

### 2. Introduce a generic runtime-driver interface

**Choice:** Define an internal runtime-driver contract that exposes execution lifecycle and capability handles consumed by `NodeProcess`.

**Rationale:** `NodeProcess` can remain bridge/loader orchestrator while runtime-specific heavy lifting lives in Node driver implementation.

**Alternative considered:** Move all runtime orchestration into driver and reduce `NodeProcess` to a shell. Rejected for this phase because bridge/loader sequencing remains shared orchestration logic.

### 3. Move execution-heavy Node/isolated-vm behavior into Node driver

**Choice:** Shift isolate lifecycle, module execution/caching, dynamic import handling, and host-side marshalling internals into Node driver-owned implementation.

**Rationale:** These are runtime-specific concerns and should not live in a generic process facade.

**Alternative considered:** Keep runtime internals in `NodeProcess` and only change constructor options. Rejected because it does not achieve driver ownership goals.

### 4. Keep `processConfig`/`osConfig` injected by `NodeProcess`, sourced from driver

**Choice:** `NodeProcess` continues to perform bridge/bootstrap injection, but config values are read from the required driver.

**Rationale:** Preserves deterministic initialization point while aligning configuration ownership with driver contract.

**Alternative considered:** Driver performs direct bridge/global injection. Rejected because it duplicates orchestration coupling and weakens shared initialization control.

### 5. Deny-by-default capability policy in driver

**Choice:** Driver defaults to reject all operations when permissions are not explicitly granted.

**Rationale:** Security baseline should be explicit and centralized at the driver boundary.

**Alternative considered:** Preserve permissive fallback when adapters are present. Rejected as unsafe and inconsistent with intended sandbox posture.

### 6. Temporarily disable browser runtime paths

**Choice:** Comment out browser-facing exports/integration paths for this phase and treat browser runtime as unsupported until re-enabled by a follow-up change.

**Rationale:** Avoids maintaining parallel runtime semantics while core ownership boundaries are being refactored.

**Alternative considered:** Keep browser runtime compiling with compatibility shims. Rejected to keep scope tight and reduce regression surface.

## Risks / Trade-offs

- **Breaking constructor and options contract** -> Mitigation: explicit migration in proposal/tasks and targeted updates across tests/examples/docs.
- **Behavior drift during runtime logic move** -> Mitigation: preserve existing execution scenarios (CJS/ESM exports, dynamic import timing, active-handle waits, host network path) as acceptance criteria.
- **Permission default regression** -> Mitigation: enforce driver-level deny-default tests and remove remaining permissive fallback paths.
- **Temporary browser disable may affect consumers** -> Mitigation: clearly document unsupported status and require explicit follow-up change to restore.

## Migration Plan

1. Define new runtime-driver interfaces in `types.ts` and update `NodeProcessOptions` to require `driver`.
2. Refactor Node driver implementation to own execution-heavy runtime responsibilities and capability policy defaults.
3. Update `NodeProcess` to consume runtime-driver interface and keep bridge/loader orchestration + config injection flow.
4. Disable/comment browser integration paths and document temporary unsupported state.
5. Update tests and examples to required-driver construction; remove direct constructor adapter usage.
6. Update compatibility/friction documentation and add follow-up for browser restoration.

## Open Questions

- Should browser disable behavior surface as compile-time absence of exports, runtime throw, or both?
- Do we keep any public mutator methods on `NodeProcess` (currently none required), or make process instances fully immutable post-construction?
