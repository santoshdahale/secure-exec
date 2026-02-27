## Context

`setupConsole()` in `packages/sandboxed-node/src/index.ts` injects a `console` object into the isolate via `context.eval()`. The legacy formatter path used raw `JSON.stringify` for object arguments, which throws on circular references and crashes the sandboxed script.

The formatting code runs inside the isolate (it's eval'd JavaScript), so formatter logic must compile into self-contained source. We cannot rely on host-side Node.js `util.inspect`.

## Goals / Non-Goals

**Goals:**
- Console methods (`log`, `error`, `warn`, `info`) must not throw when passed circular objects.
- Circular references are replaced with `[Circular]`, matching Node.js convention.
- Null values print as `'null'`, undefined as `'undefined'`.

**Non-Goals:**
- Full `util.inspect` fidelity (depth limits, colors, custom inspect symbols, etc.).
- Formatting improvements beyond fixing the crash (e.g., pretty-printing, indentation).

## Decisions

### Shared formatter module + generated isolate setup code

**Decision:** Move console serialization into `src/shared/console-formatter.ts` and have `setupConsole()` call `getConsoleSetupCode()` from that module.

**Rationale:** The formatter logic is now isolated, testable, and reusable. `getConsoleSetupCode()` still injects self-contained JavaScript into the isolate, but behavior is maintained in a normal TypeScript module with dedicated tests.

**Alternative considered:** Keep inline formatter code in `index.ts`. Rejected because behavior and performance logic become hard to evolve and hard to test independently.

### Fast path first, circular-safe fallback second

**Decision:** Attempt plain `JSON.stringify` first for eligible objects, then fall back to a `WeakSet`-based circular-safe replacer only when needed.

**Rationale:** Most logs are non-circular, so fast-path avoids replacer overhead in common cases while preserving correctness for circular structures.

**Alternative considered:** Always use replacer-based serialization. Rejected due avoidable per-log traversal overhead.

### Bounded serialization budgets for pathological payloads

**Decision:** Add serialization budgets (`maxDepth`, `maxKeys`, `maxArrayLength`, `maxOutputLength`) with truncation markers.

**Rationale:** This caps worst-case logging cost and output volume for very large/deep values without crashing.

**Alternative considered:** Unlimited traversal and output. Rejected due performance and memory risk under untrusted workloads.

## Risks / Trade-offs

- **[WeakSet availability]** `WeakSet` is available in all V8 versions that `isolated-vm` targets (ES2015+). No risk here.
- **[Output fidelity vs safety]** Budget truncation can differ from full Node `util.inspect` output. This is acceptable because the change prioritizes safety/performance for sandbox logging.
- **[Non-serializable values]** Functions, Symbols, and BigInts are still dropped or coerced by `JSON.stringify`. This is existing behavior and out of scope.
