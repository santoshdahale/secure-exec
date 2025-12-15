// Test 11: Attempt to intercept WASIX syscalls
// Explore all possible ways to hook into WASIX proc_spawn, proc_exec, etc.
import { init, Wasmer, Directory, runWasix, wat2wasm, Runtime } from "@wasmer/sdk/node";

async function main(): Promise<void> {
  console.log("Test 11: WASIX Syscall Interception Attempts");
  console.log("=============================================\n");

  await init();

  // Test 1: Check Runtime for any hidden customization
  console.log("--- Test 11a: Inspect Runtime class ---\n");
  const runtime = new Runtime();
  console.log("Runtime instance created");
  console.log("Runtime prototype methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(runtime)));
  console.log("Runtime own properties:", Object.getOwnPropertyNames(runtime));

  // Check if there's anything hidden on the constructor
  console.log("Runtime static properties:", Object.getOwnPropertyNames(Runtime));
  console.log("Runtime.prototype:", Object.getOwnPropertyNames(Runtime.prototype));

  // Test 2: Check if Wasmer class has any hook methods
  console.log("\n--- Test 11b: Inspect Wasmer class ---\n");
  console.log("Wasmer static properties:", Object.getOwnPropertyNames(Wasmer));
  console.log("Wasmer prototype:", Object.getOwnPropertyNames(Wasmer.prototype || {}));

  // Test 3: Load a package and inspect the command/instance objects
  console.log("\n--- Test 11c: Inspect loaded package ---\n");
  const pkg = await Wasmer.fromRegistry("sharrattj/bash");
  console.log("Package loaded");
  console.log("Package properties:", Object.getOwnPropertyNames(pkg));
  console.log("Entrypoint:", pkg.entrypoint);
  console.log("Commands:", Object.keys(pkg.commands || {}));

  if (pkg.entrypoint) {
    console.log("\nEntrypoint properties:", Object.getOwnPropertyNames(pkg.entrypoint));
    console.log("Entrypoint prototype:", Object.getOwnPropertyNames(Object.getPrototypeOf(pkg.entrypoint)));
  }

  // Test 4: Try to access the underlying WASM module
  console.log("\n--- Test 11d: Try to access WASM binary ---\n");
  if (pkg.entrypoint) {
    try {
      const binary = pkg.entrypoint.binary();
      console.log("Got binary! Length:", binary.length);

      // Try to find proc_spawn import in the binary
      const decoder = new TextDecoder();
      const text = decoder.decode(binary.slice(0, 1000));
      console.log("Binary starts with:", text.slice(0, 100));

      // Search for proc_spawn string in binary
      const binaryStr = decoder.decode(binary);
      if (binaryStr.includes("proc_spawn")) {
        console.log("Binary contains 'proc_spawn' - this is a WASIX binary!");
      }
    } catch (e: unknown) {
      const err = e as Error;
      console.log("Could not get binary:", err.message);
    }
  }

  // Test 5: Try running with custom runtime to see if we can hook
  console.log("\n--- Test 11e: Try custom runtime ---\n");
  try {
    // See if runtime accepts any undocumented options
    const customRuntime = new Runtime({
      registry: null, // Disable registry
      // Try some undocumented options
      // @ts-ignore - trying undocumented properties
      syscalls: {
        proc_spawn: (name: string) => {
          console.log("[HOOK] proc_spawn called:", name);
          return 0;
        }
      },
      // @ts-ignore
      onSyscall: (name: string, args: unknown[]) => {
        console.log("[HOOK] syscall:", name, args);
      }
    } as any);
    console.log("Custom runtime created (undocumented options likely ignored)");
  } catch (e: unknown) {
    const err = e as Error;
    console.log("Custom runtime failed:", err.message);
  }

  // Test 6: Try to see what happens when proc_spawn is called
  console.log("\n--- Test 11f: Test proc_spawn behavior ---\n");
  console.log("Running bash to spawn a subprocess (this will likely timeout or fail)...");

  const dir = new Directory();
  await dir.writeFile("/test.sh", `#!/bin/bash
echo "Starting subprocess test"
# Try to spawn a subprocess
sh -c "echo hello from subprocess"
echo "Done"
`);

  try {
    const instance = await pkg.entrypoint!.run({
      args: ["-c", "echo 'testing subprocess'; sh -c 'echo inner'"],
      mount: { "/app": dir },
    });

    // Try to inspect the instance
    console.log("Instance properties:", Object.getOwnPropertyNames(instance));
    console.log("Instance prototype:", Object.getOwnPropertyNames(Object.getPrototypeOf(instance)));

    // Check for any event emitters or callbacks
    // @ts-ignore
    if (instance.on) console.log("Instance has 'on' method!");
    // @ts-ignore
    if (instance.addEventListener) console.log("Instance has 'addEventListener'!");

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Timeout after 5s")), 5000);
    });

    const result = await Promise.race([instance.wait(), timeoutPromise]);
    console.log("Exit code:", result.code);
    console.log("Stdout:", result.stdout);
    console.log("Stderr:", result.stderr);
  } catch (e: unknown) {
    const err = e as Error;
    console.log("Subprocess test failed:", err.message);
  }

  // Test 7: Try using runWasix with modified imports
  console.log("\n--- Test 11g: Can we modify imports in runWasix? ---\n");

  // Create a simple WASIX module that imports proc_spawn
  const wasixWat = `
    (module
      ;; Import WASIX proc_spawn
      ;; Note: WASIX uses different signature than shown in docs
      ;; We'll try the basic WASI preview1 imports first

      (import "wasi_snapshot_preview1" "fd_write"
        (func $fd_write (param i32 i32 i32 i32) (result i32)))
      (import "wasi_snapshot_preview1" "proc_exit"
        (func $proc_exit (param i32)))

      (memory (export "memory") 1)
      (data (i32.const 0) "Hello from WASIX test!\\n")
      (data (i32.const 100) "\\00\\00\\00\\00\\17\\00\\00\\00")
      (data (i32.const 200) "\\00\\00\\00\\00")

      (func (export "_start")
        i32.const 1
        i32.const 100
        i32.const 1
        i32.const 200
        call $fd_write
        drop
        i32.const 0
        call $proc_exit
      )
    )
  `;

  try {
    console.log("Creating WASI module...");
    const wasmBytes = wat2wasm(wasixWat);
    console.log("WASM size:", wasmBytes.length);

    // runWasix doesn't accept custom imports
    // But let's try anyway to see the error
    const instance = await runWasix(wasmBytes, {
      args: ["test"],
      env: {},
      // @ts-ignore - trying undocumented
      imports: {
        custom: {
          intercept: () => console.log("INTERCEPTED!")
        }
      }
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Timeout")), 5000);
    });

    const result = await Promise.race([instance.wait(), timeoutPromise]);
    console.log("WASIX module output:", result.stdout);
  } catch (e: unknown) {
    const err = e as Error;
    console.log("WASIX test error:", err.message);
  }

  console.log("\n=== Summary ===\n");
  console.log("Based on this investigation:");
  console.log("1. Runtime class has no syscall hooks");
  console.log("2. Wasmer class has no syscall hooks");
  console.log("3. Instance has no event system for syscalls");
  console.log("4. runWasix doesn't accept custom imports");
  console.log("5. @wasmer/sdk is locked down - no syscall interception possible");
  console.log("\nThe only viable approach is using Node.js native WASI with custom bridge imports (test 9)");
}

main().catch(console.error);
