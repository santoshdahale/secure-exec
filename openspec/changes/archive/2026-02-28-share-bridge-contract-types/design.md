## Context

`secure-exec` bridge contracts are currently expressed in multiple places: host runtime injection (`src/index.ts`), bridge implementation modules (`src/bridge/*.ts`), and isolate runtime global typing (`isolate-runtime/src/common/runtime-globals.d.ts`). The same bridge global names and envelope/reference shapes are repeated with local declarations, which increases drift risk and makes type evolution brittle.

A similar problem is solved in `rivetkit` dynamic runtime by centralizing bridge keys and envelope contracts in one module. Applying that pattern here would make bridge boundaries explicit and reusable across runtime layers.

## Goals / Non-Goals

**Goals:**
- Define a canonical shared bridge contract module in `packages/secure-exec/src/shared/`.
- Consolidate bridge global key constants and host/isolate envelope/reference types.
- Replace ad-hoc per-file bridge global declarations with shared contract imports.
- Reuse shared bridge contracts in isolate-runtime typing declarations through type-only coupling.
- Add regression checks that detect key drift across host injection and bridge consumers.

**Non-Goals:**
- Changing bridge/runtime feature behavior or capability surface.
- Reworking all runtime types outside bridge-boundary contracts.
- Introducing new sandbox capabilities or third-party bridge modules.

## Decisions

### 1. Create one canonical bridge contract module under `src/shared`
**Decision:** Add a single source of truth module for bridge constants and contract types (for example `src/shared/bridge-contract.ts`).

**Rationale:** This path is inside existing package `rootDir` and can be imported by bridge/runtime code without build-system friction.

**Alternatives considered:**
- Define contracts in `isolate-runtime/src/common` and import into `src/bridge`.
  - Rejected: crosses package compilation boundaries and conflicts with current `tsconfig` root assumptions.

### 2. Model keys as `as const` maps plus derived key unions
**Decision:** Define bridge global names as readonly constant maps and derive key/value unions from them.

**Rationale:** Prevents untracked string-literal drift and enables exhaustive checks in compile-time + tests.

**Alternatives considered:**
- Keep freeform string literals with comments only.
  - Rejected: does not enforce consistency.

### 3. Export envelope/reference interfaces for both host and bridge usage
**Decision:** Include typed apply/applySync/applySyncPromise reference signatures and payload envelopes in shared contracts.

**Rationale:** Shared signatures remove duplicate local declarations and make boundary expectations obvious.

**Alternatives considered:**
- Share only global key strings, keep local signatures.
  - Rejected: key drift would improve, but type drift across modules would remain.

### 4. Isolate-runtime consumes shared bridge contracts via type-only declarations
**Decision:** Wire `isolate-runtime/src/common/runtime-globals.d.ts` to shared bridge types via type-only imports (or generated type mirror if needed).

**Rationale:** Keeps runtime script payloads decoupled from runtime imports while preserving type consistency.

**Alternatives considered:**
- Duplicate shared types in isolate-runtime declarations.
  - Rejected: repeats drift problem.

### 5. Add verification for key consistency
**Decision:** Add targeted tests asserting host injection, bridge consumers, and shared key registry remain synchronized.

**Rationale:** Compile-time types catch many regressions, but explicit tests protect against accidental string literal bypasses.

## Risks / Trade-offs

- [Refactor touches multiple bridge modules and declarations] → Mitigation: migrate incrementally by subsystem (fs/process/network/child-process) and run type/tests after each step.
- [Type-only coupling between `src` and isolate-runtime declarations may be constrained by tsconfig boundaries] → Mitigation: keep canonical contracts under `src/shared` and use compatible type-only references from isolate-runtime typecheck config.
- [Overly broad shared contract could become hard to evolve] → Mitigation: keep contracts partitioned by bridge domain and only centralize true boundary types.

## Migration Plan

1. Introduce shared bridge contract module and constants/types.
2. Update bridge modules to import shared contracts and remove duplicate declarations.
3. Update host runtime injection typing and isolate-runtime global declarations to reference shared contracts.
4. Add/adjust regression tests for key consistency and run type/tests.

Rollback:
- Revert shared contract adoption and restore previous local declarations if regressions are found.

## Open Questions

- Should bridge contracts live in a single file or split by domain (`bridge-contract/fs`, `bridge-contract/network`, etc.) from the start?
- Do we want lint/test enforcement that forbids new hard-coded bridge global strings outside the shared registry?
