# lightweight sandbox - phase 2

## overview

Phase 2 completes the missing pieces from SPEC.md to enable real npm packages like `ms` and `jsonfile` to work.

## 1. fs polyfill

Implement a `fs` module polyfill that routes through SystemBridge, enabling packages that read/write files.

```ts
// Inside isolated-vm, fs operations should route to SystemBridge
const fs = require("fs");
fs.writeFileSync("/test.json", '{"hello":"world"}');
const content = fs.readFileSync("/test.json", "utf8");
```

**Implementation approach:**

Use isolated-vm References to bridge fs calls to SystemBridge:

```ts
// In NodeProcess.setupRequire():
const fsReadRef = new ivm.Reference(async (path: string) => {
  return this.systemBridge.readFile(path);
});
const fsWriteRef = new ivm.Reference((path: string, content: string) => {
  this.systemBridge.writeFile(path, content);
});

// Pass refs into sandbox, fs polyfill calls them:
// fs.readFileSync = (path) => _fsRead.applySyncPromise(undefined, [path]);
```

**Methods to implement:**
- `readFileSync(path, encoding?)` - sync read via applySyncPromise
- `writeFileSync(path, data)` - sync write
- `existsSync(path)` - check existence
- `mkdirSync(path, options?)` - create directory
- `readdirSync(path)` - list directory
- `statSync(path)` - file stats (return mock stat object)
- `unlinkSync(path)` - delete file

Async versions can wrap the sync versions in Promise.resolve() for basic compatibility.

**Test:**
```ts
const proc = new NodeProcess({ systemBridge: bridge });
const result = await proc.run(`
  const fs = require("fs");
  fs.writeFileSync("/test.txt", "hello");
  module.exports = fs.readFileSync("/test.txt", "utf8");
`);
expect(result).toBe("hello");
```

## 2. package bundler with dependencies

Replace the simple single-file bundler with esbuild-based bundling that handles internal requires.

**Current limitation:**
```ts
// This fails because jsonfile requires graceful-fs, universalify, etc.
const jsonfile = require("jsonfile");
```

**Implementation approach:**

Use esbuild to bundle packages with their dependencies:

```ts
import * as esbuild from "esbuild";

export async function bundlePackage(
  packageName: string,
  bridge: SystemBridge
): Promise<string | null> {
  const entryPath = await findPackageEntry(packageName, bridge);
  if (!entryPath) return null;

  // Create a virtual filesystem plugin for esbuild
  const virtualFsPlugin: esbuild.Plugin = {
    name: "virtual-fs",
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        // Resolve relative imports within the package
        // Resolve node_modules imports
      });
      build.onLoad({ filter: /.*/ }, async (args) => {
        // Load file content from SystemBridge
        const content = await bridge.readFile(args.path);
        return { contents: content, loader: "js" };
      });
    },
  };

  const result = await esbuild.build({
    entryPoints: [entryPath],
    bundle: true,
    format: "cjs",
    platform: "node",
    write: false,
    plugins: [virtualFsPlugin],
    // Externalize node builtins - they're handled by polyfills
    external: ["fs", "path", "events", "util", "stream", "buffer", ...],
  });

  return wrapAsModule(result.outputFiles[0].text);
}
```

**Key considerations:**
- Externalize node builtins (fs, path, etc.) - these are provided by polyfills
- Handle circular dependencies (esbuild does this)
- Cache bundled results aggressively
- May need to handle JSON imports

**Test:**
```ts
// Load real ms package from host node_modules
const vm = new VirtualMachine();
await vm.loadFromHost("/path/to/project"); // has ms installed

const result = await vm.spawn("node", ["-e", `
  const ms = require("ms");
  console.log(ms("1h"));
`]);
expect(result.stdout).toContain("3600000");
```

## 3. additional stdlib polyfills

Add more node stdlib polyfills using node-stdlib-browser (already a dependency).

**Priority polyfills:**
- `buffer` - Buffer class, widely used
- `stream` - Stream classes, needed by many packages
- `assert` - assertions
- `url` - URL parsing
- `querystring` - query string parsing
- `os` - basic os info (can return mock values)

**Implementation:**

Extend `polyfills.ts` to bundle these from node-stdlib-browser:

```ts
const POLYFILL_SOURCES: Record<string, string> = {
  path: "path-browserify",
  events: "events",
  util: "util",
  // Add these:
  buffer: "buffer",
  stream: "stream-browserify",
  assert: "assert",
  url: "url",
  querystring: "querystring-es3",
  os: "os-browserify/browser",
};
```

**Test:**
```ts
const result = await proc.run(`
  const { Buffer } = require("buffer");
  module.exports = Buffer.from("hello").toString("base64");
`);
expect(result).toBe("aGVsbG8=");
```

## 4. node shim .webc package

Build and include the node shim as a .webc package so bash can call `node` via IPC.

**Current state:**
- Falls back to `sharrattj/coreutils` which doesn't have node shim
- IPC polling code exists in WasixInstance but the WASM-side shim isn't bundled

**Implementation:**

The Rust shim source is in `scratch/wasmer-node-shim/`. Build process:

```bash
# Build the Rust shim to WASM
cd scratch/wasmer-node-shim
cargo build --target wasm32-wasmer-wasi --release

# Package as .webc with bash and coreutils
wasmer create-exe ... # or use wasmer package tooling
```

The shim does:
1. Receive args (e.g., `node -e "console.log(1)"`)
2. Write args to `/ipc/request.txt`
3. Poll for `/ipc/response.txt`
4. Read response (exit code + stdout)
5. Print stdout and exit with code

**Package structure (wasmer.toml):**
```toml
[package]
name = "node-shim"
version = "0.1.0"

[dependencies]
"sharrattj/bash" = "1.0"
"sharrattj/coreutils" = "1.0"

[[command]]
name = "node"
module = "node-shim.wasm"

[[command]]
name = "bash"
module = "sharrattj/bash:bash"
```

**Test:**
```ts
const vm = new VirtualMachine();
vm.writeFile("/script.js", 'console.log("from node")');

// This should work end-to-end via IPC
const result = await vm.spawn("bash", ["-c", "node /script.js"]);
expect(result.stdout).toContain("from node");
```

## steps

1. Implement fs polyfill with basic sync methods
2. Add buffer, stream, assert polyfills
3. Upgrade package bundler to use esbuild
4. Build and include node-shim.webc
5. Integration test with real packages (ms, jsonfile)

## success criteria

This should work:

```ts
const vm = new VirtualMachine();
await vm.loadFromHost("/path/to/project"); // has ms, jsonfile installed

vm.writeFile("/script.js", `
  const ms = require("ms");
  const jsonfile = require("jsonfile");

  console.log("1 hour in ms:", ms("1h"));
  jsonfile.writeFileSync("/test.json", { hello: "world" });
`);

const result = await vm.spawn("node", ["/script.js"]);
console.log(result.stdout); // "1 hour in ms: 3600000"

const json = await vm.readFile("/test.json");
console.log(JSON.parse(json)); // { hello: "world" }
```
