## 1. API Contract Cleanup

- [x] 1.1 Remove `stdout`/`stderr` from `ExecResult` and `RunResult` in `src/shared/api-types.ts`.
- [x] 1.2 Update Node runtime execution return shapes (`src/execution.ts`, `src/index.ts`) to stop producing legacy buffered output fields.
- [x] 1.3 Add explicit bounded failure metadata in execution results to preserve deterministic debugging signals without log buffering.
- [x] 1.4 Update browser runtime result shapes (`src/browser/index.ts`, `src/browser/worker.ts`) to match the non-buffered contract.

## 2. Legacy and Dead Symbol Removal

- [x] 2.1 Remove unused `NodeProcess` adapter-enabled flags (`filesystemEnabled`, `commandExecutorEnabled`, `networkEnabled`) and related dead assignments.
- [x] 2.2 Remove confirmed unused helper/types in bridge/runtime sources (`bridge/fs.ts`, `bridge/module.ts`, `shared/permissions.ts`).
- [x] 2.3 Remove unused child-process stream placeholder fields (`_buffer`, `_data`) or replace with non-accumulating no-op behavior.

## 3. Test and Doc Realignment

- [x] 3.1 Replace `tests/logging-load.test.ts` legacy buffering expectation with exploit-oriented assertions that high-volume logs do not accumulate runtime-managed buffers.
- [x] 3.2 Update runtime tests/types to validate the new result contract (no `stdout`/`stderr`) and hook-based logging behavior.
- [x] 3.3 Update docs examples (`docs/quickstart.mdx`, `docs/node-compatability.mdx`, `docs/security-model.mdx`) to remove `result.stdout`/`result.stderr` usage and show `onConsoleLog`.
- [x] 3.4 Update `docs-internal/friction/secure-exec.md` with migration note and compatibility trade-offs.

## 4. Validation (Explicit Test Plan)

- [x] 4.1 Run `pnpm -C packages/secure-exec check-types`.
- [x] 4.2 Run `pnpm --dir packages/secure-exec exec vitest run tests/index.test.ts tests/payload-limits.test.ts tests/logging-load.test.ts`.
- [x] 4.3 Run `pnpm --dir packages/secure-exec exec vitest run tests/types/`.
- [x] 4.4 Run `pnpm --dir packages/secure-exec exec vitest run tests/project-matrix.test.ts -t "module-access-pass"`.
