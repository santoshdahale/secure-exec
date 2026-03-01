## 1. Driver Contract and Public API

- [ ] 1.1 Add a generic runtime-driver interface in `packages/sandboxed-node/src/types.ts` for execution lifecycle, capability handles, and runtime config access
- [ ] 1.2 Update `NodeProcessOptions` in `packages/sandboxed-node/src/index.ts` to require `driver` and remove direct constructor capability options (`filesystem`, `networkAdapter`, `commandExecutor`, `permissions`)
- [ ] 1.3 Remove optional constructor fallback driver creation in `NodeProcess` and simplify permission precedence to driver-owned policy only

## 2. Move Node Runtime Heavy Lifting into Driver

- [ ] 2.1 Refactor `packages/sandboxed-node/src/node/driver.ts` to own Node/`isolated-vm` execution-heavy logic (isolate lifecycle, module execution, dynamic import internals, host marshalling)
- [ ] 2.2 Keep bridge/loader orchestration in `NodeProcess` over the new generic driver interface, with `processConfig` and `osConfig` injected by `NodeProcess` from driver-provided values
- [ ] 2.3 Remove obsolete runtime-specific methods/fields from `NodeProcess` that become driver-owned

## 3. Enforce Deny-by-Default Driver Policy

- [ ] 3.1 Update Node driver defaults so missing permission checks reject all capability access
- [ ] 3.2 Remove permissive fallback behavior in driver construction paths and align all driver-created adapters with explicit allow semantics
- [ ] 3.3 Add/adjust tests for deny-by-default behavior under required-driver construction

## 4. Temporarily Disable Browser Surface

- [ ] 4.1 Comment out browser-facing exports and integration paths in `packages/sandboxed-node/src/index.ts` and package entrypoints for this phase
- [ ] 4.2 Comment out browser runtime implementation paths under `packages/sandboxed-node/src/browser/` as needed to keep Node runtime refactor isolated
- [ ] 4.3 Add clear temporary unsupported notes in code/docs to track browser restoration as follow-up work

## 5. Migrate Tests, Docs, and Validation

- [ ] 5.1 Update `packages/sandboxed-node/tests/index.test.ts` and related call sites to always construct `NodeProcess` with a driver
- [ ] 5.2 Update README/examples/OpenSpec references that mention old constructor fallback or direct capability options
- [ ] 5.3 Log migration friction and fix notes in `docs-internal/friction/sandboxed-node.md`, including temporary browser disable and restore follow-up
- [ ] 5.4 Run targeted checks in `packages/sandboxed-node`: `pnpm run check-types`, targeted `vitest` coverage for NodeProcess/driver behavior, and any required spec-conformance checks
