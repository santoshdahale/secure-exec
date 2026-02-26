## 1. Core Fix

- [ ] 1.1 Add `_safeStringify` helper in the `setupConsole()` eval block that uses `JSON.stringify` with a `WeakSet`-based replacer to catch circular references and substitute `[Circular]`
- [ ] 1.2 Update all four console methods (`log`, `error`, `warn`, `info`) to use `_safeStringify` instead of raw `JSON.stringify`

## 2. Tests

- [ ] 2.1 Add test: `console.log` with a circular object produces output containing `[Circular]` without throwing
- [ ] 2.2 Add test: `console.log` with `null` and `undefined` produces `"null"` and `"undefined"`
- [ ] 2.3 Add test: `console.error` with a circular object produces stderr containing `[Circular]` without throwing

## 3. Docs

- [ ] 3.1 Check off the circular-objects item in `docs-internal/todo/sandboxed-node.md`
