# Host Exec Specification

## Overview

`host_exec` is a set of WASIX syscalls that enable WASM programs to delegate execution to the JavaScript host with full streaming stdin/stdout/stderr support. This allows WASM "shim" programs to act as proxies that forward execution to JS while maintaining proper I/O streaming.

## Motivation

When building virtual commands (e.g., a `node` shim that delegates to actual JS execution), the WASM program needs to:

1. Send execution context (command, args, env, cwd) to JS
2. Stream stdin from the WASM process to JS
3. Stream stdout/stderr from JS back to the WASM process
4. Receive the exit code when JS execution completes

This must work even when the WASM shim is spawned as a subprocess by another WASM program, where stdio is connected to the parent rather than JS.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Parent WASM (optional)                                             │
│  - Spawns shim as subprocess                                        │
│  - Reads shim's stdout/stderr                                       │
│  - Writes to shim's stdin                                           │
└───────────────────────┬─────────────────────────────────────────────┘
                        │ stdio (pipes)
                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│  WASM Shim                                                          │
│  1. Calls host_exec_start() with request                            │
│  2. Spawns thread to forward stdin via host_exec_write()            │
│  3. Loops on host_exec_read() for stdout/stderr/exit                │
│  4. Forwards stdout/stderr to its own stdio                         │
│  5. Exits with received exit code                                   │
└───────────────────────┬─────────────────────────────────────────────┘
                        │ host_exec channels (side channel to JS)
                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│  wasmer-js Runtime                                                  │
│  - Manages sessions (HashMap<session_id, channels>)                 │
│  - Routes syscalls to appropriate session                           │
│  - Calls JS handler with Web Streams                                │
└───────────────────────┬─────────────────────────────────────────────┘
                        │ Web Streams API
                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│  JavaScript Handler                                                 │
│  - Receives context with stdin/stdout/stderr streams                │
│  - Executes requested operation                                     │
│  - Writes output to streams                                         │
│  - Returns exit code via Promise                                    │
└────────────────────────────────────────────────────────────────────┘
```

## Syscall Definitions

### `host_exec_start`

Starts a new host execution session.

**Signature:**
```rust
fn host_exec_start(
    request_ptr: *const u8,    // Pointer to JSON request
    request_len: usize,        // Length of request
    session_ptr: *mut u64,     // Out: session handle
) -> Errno;
```

**Request Format (JSON):**
```json
{
  "command": "node",
  "args": ["script.js", "--flag"],
  "env": {"NODE_ENV": "production"},
  "cwd": "/app"
}
```

**Returns:**
- `Errno::Success` (0) on success, session handle written to `session_ptr`
- `Errno::Inval` (28) if request is malformed
- `Errno::Io` (29) if handler not registered or failed to start

**Behavior:**
1. Parses the JSON request
2. Creates new channels for stdin input and stdout/stderr/exit output
3. Allocates unique session ID (atomic counter)
4. Calls JS handler with Web Streams connected to channels
5. Returns immediately (does not wait for JS execution to complete)

---

### `host_exec_read`

Reads the next output chunk from the host execution. Blocks until data is available.

**Signature:**
```rust
fn host_exec_read(
    session: u64,              // Session handle from host_exec_start
    type_ptr: *mut u32,        // Out: message type (1=stdout, 2=stderr, 3=exit)
    data_ptr: *mut u8,         // Out: data buffer
    data_len_ptr: *mut usize,  // In: max buffer size, Out: actual data length (or exit code)
) -> Errno;
```

**Message Types:**
| Value | Constant | Description |
|-------|----------|-------------|
| 1 | `HOST_EXEC_STDOUT` | Stdout data chunk |
| 2 | `HOST_EXEC_STDERR` | Stderr data chunk |
| 3 | `HOST_EXEC_EXIT` | Execution complete, `data_len` contains exit code |

**Returns:**
- `Errno::Success` (0) on success
- `Errno::Badf` (8) if session handle is invalid
- `Errno::Io` (29) if session was closed unexpectedly

**Behavior:**
1. Blocks until JS sends stdout chunk, stderr chunk, or exit
2. Writes message type to `type_ptr`
3. For stdout/stderr: writes data to `data_ptr`, actual length to `data_len_ptr`
4. For exit: writes exit code to `data_len_ptr` (data buffer unused)
5. On exit message, session is automatically cleaned up

---

### `host_exec_write`

Sends stdin data to the host execution.

**Signature:**
```rust
fn host_exec_write(
    session: u64,              // Session handle
    data_ptr: *const u8,       // Stdin data to send
    data_len: usize,           // Length of data
) -> Errno;
```

**Returns:**
- `Errno::Success` (0) on success
- `Errno::Badf` (8) if session handle is invalid
- `Errno::Io` (29) if JS stdin stream is closed

**Behavior:**
1. Sends data to JS handler's stdin ReadableStream
2. Returns immediately (non-blocking on JS side)

---

### `host_exec_close_stdin`

Signals EOF on stdin to the host execution.

**Signature:**
```rust
fn host_exec_close_stdin(session: u64) -> Errno;
```

**Returns:**
- `Errno::Success` (0) on success
- `Errno::Badf` (8) if session handle is invalid

**Behavior:**
1. Closes the stdin channel
2. JS handler's stdin ReadableStream will signal EOF

---

## Runtime Trait Extensions

```rust
// In wasmer_wasix::Runtime

/// Request to start a host execution
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct HostExecRequest {
    pub command: String,
    pub args: Vec<String>,
    pub env: HashMap<String, String>,
    pub cwd: String,
}

/// Output message from host to WASM
#[derive(Debug, Clone)]
pub enum HostExecOutput {
    Stdout(Vec<u8>),
    Stderr(Vec<u8>),
    Exit(i32),
}

/// Input message from WASM to host
#[derive(Debug, Clone)]
pub enum HostExecInput {
    Stdin(Vec<u8>),
    StdinClose,
}

pub type HostExecSession = u64;

pub trait Runtime: fmt::Debug {
    // ... existing methods ...

    /// Start a host execution with streaming I/O
    fn host_exec_start(
        &self,
        request: HostExecRequest,
    ) -> BoxFuture<'_, Result<HostExecSession, anyhow::Error>>;

    /// Read next output from host execution (blocks until data available)
    fn host_exec_read(
        &self,
        session: HostExecSession,
    ) -> BoxFuture<'_, Result<HostExecOutput, anyhow::Error>>;

    /// Write stdin data to host execution
    fn host_exec_write(
        &self,
        session: HostExecSession,
        data: Vec<u8>,
    ) -> BoxFuture<'_, Result<(), anyhow::Error>>;

    /// Close stdin for host execution
    fn host_exec_close_stdin(
        &self,
        session: HostExecSession,
    ) -> BoxFuture<'_, Result<(), anyhow::Error>>;
}
```

---

## wasmer-js Implementation

### Session Management

```rust
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use parking_lot::Mutex;
use tokio::sync::Mutex as AsyncMutex;
use tokio::sync::mpsc;

struct HostExecSessionState {
    /// Channel to send stdin data to JS
    stdin_tx: mpsc::Sender<HostExecInput>,
    /// Channel to receive stdout/stderr/exit from JS
    output_rx: Arc<AsyncMutex<mpsc::Receiver<HostExecOutput>>>,
}

pub struct Runtime {
    // ... existing fields ...

    /// Handler function for host_exec calls
    host_exec_handler: Option<js_sys::Function>,

    /// Active sessions
    host_exec_sessions: Mutex<HashMap<u64, HostExecSessionState>>,

    /// Counter for unique session IDs
    next_session_id: AtomicU64,
}
```

### JavaScript API

**TypeScript Definitions:**
```typescript
/**
 * Context passed to host exec handlers.
 */
interface HostExecContext {
    /** Command name (e.g., "node") */
    command: string;

    /** Command arguments */
    args: string[];

    /** Environment variables */
    env: Record<string, string>;

    /** Current working directory */
    cwd: string;

    /**
     * Stdin stream from WASM.
     * Read from this to get stdin data sent by the WASM process.
     */
    stdin: ReadableStream<Uint8Array>;

    /**
     * Stdout stream to WASM.
     * Write to this to send stdout data to the WASM process.
     */
    stdout: WritableStream<Uint8Array>;

    /**
     * Stderr stream to WASM.
     * Write to this to send stderr data to the WASM process.
     */
    stderr: WritableStream<Uint8Array>;
}

/**
 * Handler for host exec calls.
 *
 * The handler should:
 * 1. Read from ctx.stdin as needed
 * 2. Write output to ctx.stdout and ctx.stderr
 * 3. Return the exit code (or a Promise resolving to it)
 *
 * The streams are automatically closed when the Promise resolves.
 */
type HostExecHandler = (ctx: HostExecContext) => number | Promise<number>;

interface Runtime {
    /**
     * Register a handler for host_exec syscalls.
     */
    setHostExecHandler(handler: HostExecHandler): void;
}
```

**Usage Example:**
```javascript
import { init, Wasmer, Runtime } from '@aspect/wasmer';

await init();

const runtime = new Runtime();

runtime.setHostExecHandler(async (ctx) => {
    console.log(`Executing: ${ctx.command} ${ctx.args.join(' ')}`);

    const encoder = new TextEncoder();
    const stdoutWriter = ctx.stdout.getWriter();
    const stderrWriter = ctx.stderr.getWriter();

    try {
        if (ctx.command === 'node') {
            if (ctx.args[0] === '-e') {
                // Eval mode
                const code = ctx.args[1];
                const result = eval(code);
                await stdoutWriter.write(encoder.encode(String(result) + '\n'));
            } else {
                // Script mode - could stream output
                const scriptPath = ctx.args[0];
                const script = await readScript(scriptPath, ctx);

                // Execute with streaming output
                for await (const output of executeWithStreaming(script)) {
                    if (output.type === 'stdout') {
                        await stdoutWriter.write(encoder.encode(output.data));
                    } else {
                        await stderrWriter.write(encoder.encode(output.data));
                    }
                }
            }
        }

        await stdoutWriter.close();
        await stderrWriter.close();
        return 0;

    } catch (error) {
        await stderrWriter.write(encoder.encode(`Error: ${error.message}\n`));
        await stdoutWriter.close();
        await stderrWriter.close();
        return 1;
    }
});

// Run a package that uses the shim
const pkg = await Wasmer.fromFile(shimPackageBytes, runtime);
const instance = await pkg.commands.node.run({
    args: ['-e', 'console.log("Hello from JS!")'],
});
const output = await instance.wait();
console.log('Exit code:', output.code);
```

---

## WASM Shim Implementation

### Cargo.toml

```toml
[package]
name = "host-exec-shim"
version = "0.1.0"
edition = "2021"

[dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[lib]
crate-type = ["cdylib"]
```

### src/main.rs

```rust
use std::collections::HashMap;
use std::env;
use std::io::{self, Read, Write};
use std::process::exit;
use std::thread;

// Syscall imports
#[link(wasm_import_module = "wasix_32v1")]
extern "C" {
    fn host_exec_start(
        request_ptr: *const u8,
        request_len: usize,
        session_ptr: *mut u64,
    ) -> i32;

    fn host_exec_read(
        session: u64,
        type_ptr: *mut u32,
        data_ptr: *mut u8,
        data_len_ptr: *mut usize,
    ) -> i32;

    fn host_exec_write(
        session: u64,
        data_ptr: *const u8,
        data_len: usize,
    ) -> i32;

    fn host_exec_close_stdin(session: u64) -> i32;
}

// Message type constants
const HOST_EXEC_STDOUT: u32 = 1;
const HOST_EXEC_STDERR: u32 = 2;
const HOST_EXEC_EXIT: u32 = 3;

#[derive(serde::Serialize)]
struct Request {
    command: String,
    args: Vec<String>,
    env: HashMap<String, String>,
    cwd: String,
}

fn main() {
    let args: Vec<String> = env::args().collect();
    let command = env::var("HOST_EXEC_COMMAND").unwrap_or_else(|_| "node".to_string());

    // Build request
    let request = Request {
        command,
        args: args[1..].to_vec(),
        env: env::vars().collect(),
        cwd: env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| "/".to_string()),
    };

    let request_json = match serde_json::to_vec(&request) {
        Ok(j) => j,
        Err(e) => {
            eprintln!("[shim] Failed to serialize request: {}", e);
            exit(1);
        }
    };

    // Start host execution
    let mut session: u64 = 0;
    let errno = unsafe {
        host_exec_start(
            request_json.as_ptr(),
            request_json.len(),
            &mut session,
        )
    };

    if errno != 0 {
        eprintln!("[shim] host_exec_start failed with errno {}", errno);
        exit(1);
    }

    // Spawn thread to forward stdin to host
    let stdin_session = session;
    thread::spawn(move || {
        let mut stdin = io::stdin();
        let mut buf = [0u8; 8192];

        loop {
            match stdin.read(&mut buf) {
                Ok(0) => {
                    // EOF - close stdin on host side
                    unsafe { host_exec_close_stdin(stdin_session) };
                    break;
                }
                Ok(n) => {
                    let errno = unsafe {
                        host_exec_write(stdin_session, buf.as_ptr(), n)
                    };
                    if errno != 0 {
                        // Host closed stdin or error
                        break;
                    }
                }
                Err(e) => {
                    eprintln!("[shim] stdin read error: {}", e);
                    break;
                }
            }
        }
    });

    // Main loop: read output from host and forward to our stdio
    let mut stdout = io::stdout();
    let mut stderr = io::stderr();
    let mut buf = vec![0u8; 64 * 1024]; // 64KB buffer

    loop {
        let mut msg_type: u32 = 0;
        let mut data_len = buf.len();

        let errno = unsafe {
            host_exec_read(
                session,
                &mut msg_type,
                buf.as_mut_ptr(),
                &mut data_len,
            )
        };

        if errno != 0 {
            eprintln!("[shim] host_exec_read failed with errno {}", errno);
            exit(1);
        }

        match msg_type {
            HOST_EXEC_STDOUT => {
                if let Err(e) = stdout.write_all(&buf[..data_len]) {
                    eprintln!("[shim] stdout write error: {}", e);
                }
                let _ = stdout.flush();
            }
            HOST_EXEC_STDERR => {
                if let Err(e) = stderr.write_all(&buf[..data_len]) {
                    eprintln!("[shim] stderr write error: {}", e);
                }
                let _ = stderr.flush();
            }
            HOST_EXEC_EXIT => {
                // data_len contains the exit code
                let exit_code = data_len as i32;
                exit(exit_code);
            }
            _ => {
                eprintln!("[shim] Unknown message type: {}", msg_type);
                exit(1);
            }
        }
    }
}
```

### wasmer.toml

```toml
[package]
name = "myorg/node-shim"
version = "0.1.0"
description = "Node.js shim using host_exec"

[dependencies]
"sharrattj/coreutils" = "1.0.16"

[[module]]
name = "node-shim"
source = "target/wasm32-wasip1/release/host_exec_shim.wasm"
abi = "wasi"

[[command]]
name = "node"
module = "node-shim"
runner = "wasi"
```

---

## Concurrency

The design supports multiple concurrent host executions:

1. **Unique Session IDs**: Each `host_exec_start` call gets a unique session ID via atomic counter
2. **Isolated Channels**: Each session has its own mpsc channels
3. **Independent JS Handlers**: Each session triggers a separate JS handler invocation

```
Process A                    Process B                    Process C
    │                            │                            │
    ▼                            ▼                            ▼
session=1                   session=2                   session=3
    │                            │                            │
    ▼                            ▼                            ▼
┌─────────┐                ┌─────────┐                ┌─────────┐
│ State 1 │                │ State 2 │                │ State 3 │
│ tx/rx   │                │ tx/rx   │                │ tx/rx   │
└────┬────┘                └────┬────┘                └────┬────┘
     │                          │                          │
     ▼                          ▼                          ▼
JS Handler 1              JS Handler 2              JS Handler 3
(async, independent)      (async, independent)      (async, independent)
```

---

## Error Handling

| Scenario | Errno | Recovery |
|----------|-------|----------|
| Invalid session ID | `Errno::Badf` (8) | Check session is valid |
| No handler registered | `Errno::Io` (29) | Register handler before running |
| Handler threw exception | `Errno::Io` (29) | Check JS console for errors |
| Session closed unexpectedly | `Errno::Io` (29) | Handler may have crashed |
| Malformed request JSON | `Errno::Inval` (28) | Fix request format |

---

## Session Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. WASM calls host_exec_start(request)                          │
│    → Session created, channels allocated                        │
│    → JS handler called with streams                             │
│    → Returns session ID                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. WASM loops:                                                  │
│    - host_exec_write(session, stdin_data) → JS stdin stream     │
│    - host_exec_read(session) blocks → receives stdout/stderr    │
│    - WASM forwards to its own stdio                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. JS handler completes:                                        │
│    → Promise resolves with exit code                            │
│    → Exit message sent to output channel                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. WASM receives HOST_EXEC_EXIT:                                │
│    → Session automatically cleaned up                           │
│    → WASM exits with received code                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Files to Modify

### wasmer (main library)

| File | Changes |
|------|---------|
| `lib/wasix/src/runtime/mod.rs` | Add `HostExecRequest`, `HostExecOutput`, `HostExecInput`, session methods to `Runtime` trait |
| `lib/wasix/src/runtime/host_exec.rs` | New file with types |
| `lib/wasix/src/syscalls/wasix/host_exec_start.rs` | New syscall |
| `lib/wasix/src/syscalls/wasix/host_exec_read.rs` | New syscall |
| `lib/wasix/src/syscalls/wasix/host_exec_write.rs` | New syscall |
| `lib/wasix/src/syscalls/wasix/host_exec_close_stdin.rs` | New syscall |
| `lib/wasix/src/syscalls/wasix/mod.rs` | Export new syscalls |
| `lib/wasix/src/lib.rs` | Add syscalls to `wasix_exports_32` and `wasix_exports_64` |

### wasmer-js

| File | Changes |
|------|---------|
| `src/runtime.rs` | Implement `Runtime` trait methods for host_exec, session management |
| `src/js_runtime.rs` | Add `setHostExecHandler` method, TypeScript types |

---

## Testing

### Unit Test: Session Management

```rust
#[test]
fn test_concurrent_sessions() {
    let runtime = Runtime::new();
    runtime.set_host_exec_handler(/* mock handler */);

    // Start multiple sessions
    let s1 = runtime.host_exec_start(req1).await.unwrap();
    let s2 = runtime.host_exec_start(req2).await.unwrap();
    let s3 = runtime.host_exec_start(req3).await.unwrap();

    // All should have unique IDs
    assert_ne!(s1, s2);
    assert_ne!(s2, s3);

    // Each should work independently
    // ...
}
```

### Integration Test: Full Flow

```javascript
// test/host_exec.test.js
describe('host_exec', () => {
    it('streams stdout correctly', async () => {
        const chunks = [];
        runtime.setHostExecHandler(async (ctx) => {
            const writer = ctx.stdout.getWriter();
            await writer.write(new TextEncoder().encode('chunk1'));
            await writer.write(new TextEncoder().encode('chunk2'));
            await writer.close();
            return 0;
        });

        const instance = await pkg.commands.shim.run();
        const output = await instance.wait();

        expect(output.code).toBe(0);
        expect(new TextDecoder().decode(output.stdout)).toBe('chunk1chunk2');
    });

    it('handles concurrent executions', async () => {
        // Run 5 instances simultaneously
        const instances = await Promise.all([
            pkg.commands.shim.run({ args: ['1'] }),
            pkg.commands.shim.run({ args: ['2'] }),
            pkg.commands.shim.run({ args: ['3'] }),
            pkg.commands.shim.run({ args: ['4'] }),
            pkg.commands.shim.run({ args: ['5'] }),
        ]);

        const outputs = await Promise.all(instances.map(i => i.wait()));

        // All should complete successfully
        outputs.forEach(o => expect(o.code).toBe(0));
    });
});
```

