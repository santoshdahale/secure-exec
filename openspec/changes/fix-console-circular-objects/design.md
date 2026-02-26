## Context

`setupConsole()` in `packages/sandboxed-node/src/index.ts` injects a `console` object into the isolate via `context.eval()`. The current formatter uses `typeof a === 'object' ? JSON.stringify(a) : String(a)` for each argument. `JSON.stringify` throws on circular references, which crashes the sandboxed script entirely.

The formatting code runs inside the isolate (it's eval'd JavaScript), so the fix must also be self-contained JavaScript that runs inside the isolate - no access to host-side Node.js `util.inspect`.

## Goals / Non-Goals

**Goals:**
- Console methods (`log`, `error`, `warn`, `info`) must not throw when passed circular objects.
- Circular references are replaced with `[Circular]`, matching Node.js convention.
- Null values print as `'null'`, undefined as `'undefined'`.

**Non-Goals:**
- Full `util.inspect` fidelity (depth limits, colors, custom inspect symbols, etc.).
- Formatting improvements beyond fixing the crash (e.g., pretty-printing, indentation).

## Decisions

### Inline circular-safe stringify inside the isolate

**Decision:** Define a `_safeStringify` helper function inside the `context.eval()` block that wraps `JSON.stringify` with a circular-reference replacer using a `WeakSet`.

**Rationale:** The code runs inside the isolate, so it must be self-contained JavaScript. A `WeakSet`-based seen tracker is the standard minimal pattern for circular detection. It avoids pulling in any external dependency and keeps the eval'd code small.

**Alternative considered:** Try/catch around `JSON.stringify` and fall back to `String(a)`. Rejected because `String(a)` on a complex object just produces `[object Object]`, losing all useful information. The replacer approach preserves the non-circular parts of the object.

### Use `JSON.stringify` with replacer, not a custom walk

**Decision:** Keep `JSON.stringify` as the serializer but pass a `replacer` function that tracks seen objects via `WeakSet` and substitutes `"[Circular]"` for repeated references.

**Rationale:** `JSON.stringify` with a replacer handles all the edge cases (nested objects, arrays, toJSON methods) correctly. Writing a custom recursive walk would duplicate that logic and introduce new bug surface. The replacer is called for every value, so it naturally catches circular refs at any depth.

## Risks / Trade-offs

- **[WeakSet availability]** `WeakSet` is available in all V8 versions that `isolated-vm` targets (ES2015+). No risk here.
- **[Performance on deep objects]** The replacer adds a `WeakSet.has` + `WeakSet.add` per object node. This is negligible for console logging use cases.
- **[Non-serializable values]** Functions, Symbols, and BigInts are still dropped or coerced by `JSON.stringify`. This is existing behavior and out of scope.
