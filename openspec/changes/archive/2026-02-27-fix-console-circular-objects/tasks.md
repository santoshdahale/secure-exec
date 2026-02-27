## 1. Core Fix

- [x] 1.1 Extract console serialization and setup generation into `packages/sandboxed-node/src/shared/console-formatter.ts`
- [x] 1.2 Update `setupConsole()` in `packages/sandboxed-node/src/index.ts` to use generated setup code from the shared formatter module
- [x] 1.3 Implement fast-path serialization first, with circular-safe fallback (`WeakSet` replacer) when needed
- [x] 1.4 Add bounded serialization budgets for depth/key-count/array-length/output-length with deterministic truncation markers

## 2. Tests

- [x] 2.1 Add test: `console.log` with a circular object produces output containing `[Circular]` without throwing
- [x] 2.2 Add test: `console.log` with `null` and `undefined` produces `"null"` and `"undefined"`
- [x] 2.3 Add test: `console.error` with a circular object produces stderr containing `[Circular]` without throwing
- [x] 2.4 Add dedicated formatter test suite at `packages/sandboxed-node/tests/console-formatter.test.ts` covering fast path, fallback, and budget behavior

## 3. Docs

- [x] 3.1 Check off the circular-objects item in `docs-internal/todo/sandboxed-node.md`
