# Wasmer-JS 0.10.0 Scheduler Hang Bug

## Summary

Wasmer-JS 0.10.0 has a regression that causes flaky scheduler hangs when running 3+ sequential WASM commands on Node.js.

## Affected Versions

| Package | Version | Status |
|---------|---------|--------|
| @wasmer/sdk | 0.10.0 | ❌ BROKEN - flaky scheduler hangs |
| @wasmer/sdk | 0.9.0 | ✅ WORKS - stable, no hangs |

**Note:** This project is branched off @wasmer/sdk 0.9.0 to avoid this bug.

## Environment

- Node.js: 24.3.0 (also reproduced on 22.x)
- OS: Linux
- Platform: x64

## Symptoms

- Running 3+ sequential WASM commands causes the process to hang indefinitely
- The hang is flaky/racy - sometimes works, sometimes hangs
- When it hangs, it's stuck waiting for a worker thread response that never comes

## Minimal Reproduction

```javascript
/**
 * Minimal reproduction of wasmer-js 0.10.0 scheduler hang bug
 * 
 * Setup:
 *   mkdir wasmer-bug-test && cd wasmer-bug-test
 *   npm init -y
 *   npm install @wasmer/sdk@0.10.0
 *   # Copy a .webc file (e.g., runtime.webc with echo command)
 *   node test.mjs
 * 
 * Expected: All 3 commands complete
 * Actual: Flaky hang on 3rd command (or sometimes 2nd)
 */

import { init, Wasmer } from '@wasmer/sdk/node';
import fs from 'fs/promises';

// Required: wasmer workers don't keep the event loop alive
const keepAlive = setInterval(() => {}, 1000);

await init();
const pkg = await Wasmer.fromFile(await fs.readFile("runtime.webc"));

async function runEcho(msg) {
  const instance = await pkg.commands.echo.run({ args: [msg] });
  const result = await instance.wait();
  return result.stdout.trim();
}

console.log("1:", await runEcho("one"));   // works
console.log("2:", await runEcho("two"));   // works  
console.log("3:", await runEcho("three")); // HANGS (flaky)

clearInterval(keepAlive);
console.log("Done!");
```

## Test Results

### With @wasmer/sdk 0.9.0
```
20/20 runs: PASS
```

### With @wasmer/sdk 0.10.0
```
Flaky - hangs ~30-50% of the time on 3rd command
```

## Root Cause

Unknown. Appears to be related to the worker thread scheduler in wasmer-js. The scheduler seems to get into a deadlock state when:
1. Multiple sequential commands are run
2. Workers become idle and try to signal back

The "Scheduler is closed, dropping message" warning appears in 0.9.0 but doesn't cause hangs. In 0.10.0, similar conditions cause actual deadlocks.

## Workaround

Stay on @wasmer/sdk 0.9.0 until the bug is fixed upstream.

```json
{
  "dependencies": {
    "@wasmer/sdk": "^0.9.0"
  }
}
```

The `^0.9.0` semver range will not upgrade to 0.10.x (different minor version).

## Git References

### wasmer-js Repository

| Version | Git Commit | Notes |
|---------|------------|-------|
| 0.9.0 | `358be55b2bd23df63ed35d1dc44c4898e001c6a0` | Last working version |
| 0.10.0 | `93b8b738ebd3ee57e118da0f0eb795b97d5b999e` | Introduces scheduler bug |

### Commits Between 0.9.0 and 0.10.0

The following commits were introduced between 0.9.0 and 0.10.0:

```
93b8b73 More improvements
cf89e23 Updated corosensei
d0e6fc0 Use latest Wasmer
d7738cb Updated SDK version
92100ab Iterated further
8fba79f Make example more detailed
245585c One more!
7d339f1 Update code to work with latest Wasmer
0354ff2 Updated pnpm lock
b17085e Updated example
2084efc Updated example
2f96ef0 Updated package
4284abd Updated based on latest schema
0f01ab3 Improved WordPress example
4c2d6fa Various improvements
b6cedac Added typescript dependency
7276bec Revert
fa78793 Use commonjs
b260bed Fix import
1de9931 Use local dist
e4aa6e8 Added example
4937a82 Added sdk lite
905e9a8 Merge pull request #445 from c0per/fix/worker-sdk-url
7942a6b fix: pass sdkUrl into init() in worker
```

**Suspect commits:**
- `d0e6fc0 Use latest Wasmer` - likely changed wasmer dependency versions
- `cf89e23 Updated corosensei` - corosensei is the scheduler/coroutine library
- `7d339f1 Update code to work with latest Wasmer`

### Wasmer Versions in wasmer-js 0.9.0

From `Cargo.toml` at commit 358be55:
- wasmer = "4.4.0"
- wasmer-wasix = "0.28.0"
- wasmer-types = "4.4.0"

Note: These are patched via `[patch.crates-io]` to use local paths:
- `../wasmer/lib/api`
- `../wasmer/lib/wasix`

## Building from Source

To test with local wasmer changes:

```bash
# Clone wasmer-js at 0.9.0
git clone https://github.com/wasmerio/wasmer-js.git
cd wasmer-js
git checkout 358be55

# Clone wasmer (need to find commit used for 0.9.0)
cd ..
git clone https://github.com/wasmerio/wasmer.git

# Build wasmer-js
cd wasmer-js
npm install
npm run build
```

### rust-toolchain.toml at 0.9.0

```toml
[toolchain]
channel = "nightly-2024-09-23"
targets = ["wasm32-unknown-unknown", "wasm32-wasi"]
components = ["rust-src", "rustfmt", "clippy"]
```
