# Child Process Streaming Implementation Spec

Enable full `child_process` support in `sandboxed-node` by bridging through the `CommandExecutor` interface to nanosandbox's `HostExecContext`.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│ WASIX bash/shell                                                        │
│   Runs "node -e 'code...'" via host_exec syscall                       │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ host_exec syscall
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ wasmer-js scheduler                                                     │
│   Creates HostExecContext, calls hostExecHandler                        │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ hostExecHandler callback
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ nanosandbox (packages/nanosandbox/src/vm/index.ts)                      │
│   hostExecHandler detects "node" command                                │
│   Creates NodeProcess (sandboxed-node) with CommandExecutor             │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ NodeProcess.exec(code)
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ sandboxed-node isolate                                                  │
│   User code runs: child_process.spawn('cmd', ['args'])                  │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ ivm.Reference call
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ sandboxed-node host (src/index.ts)                                      │
│   Receives spawn request, calls commandExecutor.spawn()                 │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ CommandExecutor.spawn()
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ nanosandbox CommandExecutor implementation                              │
│   Calls ctx.spawnChildStreaming() to route through wasmer-js            │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ ctx.spawnChildStreaming()
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ wasmer-js scheduler                                                     │
│   Creates new WASIX process for the child command                       │
│   Streams stdin/stdout between parent and child                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow Example

1. WASIX shell runs: `node -e "require('child_process').spawn('echo', ['hi'])"`
2. WASIX calls `host_exec("node", ["-e", "..."])`
3. wasmer-js scheduler invokes `hostExecHandler(ctx)`
4. nanosandbox `hostExecHandler` creates `NodeProcess` with `CommandExecutor(ctx)`
5. `NodeProcess.exec()` runs the code in isolated-vm
6. User code calls `spawn('echo', ['hi'])`
7. Bridge calls `_childProcessSpawnStart` Reference back to host
8. Host's `CommandExecutor.spawn()` is invoked
9. `CommandExecutor` calls `ctx.spawnChildStreaming('echo', ['hi'], ...)`
10. wasmer-js scheduler creates new WASIX process for `echo`
11. stdout/stderr stream back through the chain to user code

---

## Part 1: sandboxed-node - CommandExecutor Interface

### 1.1 Define SpawnedProcess interface

**File:** `packages/sandboxed-node/src/index.ts`

```typescript
/**
 * Handle for a spawned child process with streaming I/O.
 */
export interface SpawnedProcess {
  /** Write to process stdin */
  writeStdin(data: Uint8Array | string): void;
  /** Close stdin (signal EOF) */
  closeStdin(): void;
  /** Kill the process with optional signal (default SIGTERM=15) */
  kill(signal?: number): void;
  /** Wait for process to exit, returns exit code */
  wait(): Promise<number>;
}

/**
 * Interface for executing commands from sandboxed code.
 * Implemented by nanosandbox to handle child process requests.
 *
 * Only spawn() is required - exec/run can be built on top by collecting
 * stdout/stderr and waiting for exit.
 */
export interface CommandExecutor {
  /** Spawn command with streaming I/O */
  spawn(
    command: string,
    args: string[],
    options: {
      cwd?: string;
      env?: Record<string, string>;
      onStdout?: (data: Uint8Array) => void;
      onStderr?: (data: Uint8Array) => void;
    }
  ): SpawnedProcess;
}
```

### 1.2 Add spawn References in NodeProcess

**File:** `packages/sandboxed-node/src/index.ts` (in setupBridge)

```typescript
// Child process streaming support
if (this.commandExecutor?.spawn) {
  const executor = this.commandExecutor;
  let nextSessionId = 1;
  const sessions = new Map<number, SpawnedProcess>();

  // Get dispatcher reference from isolate (set by bridge code)
  const dispatchRef = context.global.getSync('_childProcessDispatch', { reference: true });

  // Start a spawn - returns session ID
  const spawnStartRef = new ivm.Reference(
    (command: string, argsJson: string, optionsJson: string): number => {
      const args = JSON.parse(argsJson) as string[];
      const options = JSON.parse(optionsJson) as { cwd?: string; env?: Record<string, string> };
      const sessionId = nextSessionId++;

      const proc = executor.spawn(command, args, {
        cwd: options.cwd,
        env: options.env,
        onStdout: (data) => {
          dispatchRef.applySync(undefined, [sessionId, 'stdout', data], { arguments: { copy: true } });
        },
        onStderr: (data) => {
          dispatchRef.applySync(undefined, [sessionId, 'stderr', data], { arguments: { copy: true } });
        },
      });

      proc.wait().then(code => {
        dispatchRef.applySync(undefined, [sessionId, 'exit', code]);
        sessions.delete(sessionId);
      });

      sessions.set(sessionId, proc);
      return sessionId;
    }
  );

  // Stdin write
  const stdinWriteRef = new ivm.Reference((sessionId: number, data: Uint8Array): void => {
    sessions.get(sessionId)?.writeStdin(data);
  });

  // Stdin close
  const stdinCloseRef = new ivm.Reference((sessionId: number): void => {
    sessions.get(sessionId)?.closeStdin();
  });

  // Kill
  const killRef = new ivm.Reference((sessionId: number, signal: number): void => {
    sessions.get(sessionId)?.kill(signal);
  });

  await jail.set('_childProcessSpawnStart', spawnStartRef);
  await jail.set('_childProcessStdinWrite', stdinWriteRef);
  await jail.set('_childProcessStdinClose', stdinCloseRef);
  await jail.set('_childProcessKill', killRef);
}
```

### 1.3 Update bridge/child-process.ts

**File:** `packages/sandboxed-node/bridge/child-process.ts`

```typescript
// Host bridge declarations for streaming mode
declare const _childProcessSpawnStart: {
  applySyncPromise(ctx: undefined, args: [string, string, string]): number;
} | undefined;

declare const _childProcessStdinWrite: {
  applySyncPromise(ctx: undefined, args: [number, Uint8Array]): void;
} | undefined;

declare const _childProcessStdinClose: {
  applySyncPromise(ctx: undefined, args: [number]): void;
} | undefined;

declare const _childProcessKill: {
  applySyncPromise(ctx: undefined, args: [number, number]): void;
} | undefined;

// Active children registry
const activeChildren = new Map<number, ChildProcess>();

// Global dispatcher - host calls this when data arrives
(globalThis as Record<string, unknown>)._childProcessDispatch = (
  sessionId: number,
  type: 'stdout' | 'stderr' | 'exit',
  data: Uint8Array | number
): void => {
  const child = activeChildren.get(sessionId);
  if (!child) return;

  if (type === 'stdout') {
    child.stdout.emit('data', Buffer.from(data as Uint8Array));
  } else if (type === 'stderr') {
    child.stderr.emit('data', Buffer.from(data as Uint8Array));
  } else if (type === 'exit') {
    child.exitCode = data as number;
    child.stdout.emit('end');
    child.stderr.emit('end');
    child.emit('close', data, null);
    child.emit('exit', data, null);
    activeChildren.delete(sessionId);
  }
};

// spawn() implementation using streaming when available
function spawn(command: string, args?: string[], options?: SpawnOptions): ChildProcess {
  const child = new ChildProcess();

  if (typeof _childProcessSpawnStart !== 'undefined') {
    // Streaming mode
    const sessionId = _childProcessSpawnStart.applySyncPromise(undefined, [
      command,
      JSON.stringify(args || []),
      JSON.stringify({ cwd: options?.cwd, env: options?.env })
    ]);

    activeChildren.set(sessionId, child);

    child.stdin.write = (data) => {
      const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
      _childProcessStdinWrite!.applySyncPromise(undefined, [sessionId, bytes]);
      return true;
    };

    child.stdin.end = () => {
      _childProcessStdinClose!.applySyncPromise(undefined, [sessionId]);
    };

    child.kill = (signal) => {
      const sig = signal === 'SIGKILL' ? 9 : 15;
      _childProcessKill!.applySyncPromise(undefined, [sessionId, sig]);
      child.killed = true;
      return true;
    };

    return child;
  }

  // Fallback to batch mode...
}
```

---

## Part 2: nanosandbox - CommandExecutor Implementation

### 2.1 Create CommandExecutor adapter

**File:** `packages/nanosandbox/src/command-executor.ts`

```typescript
import type { CommandExecutor, SpawnedProcess } from 'sandboxed-node';
import type { HostExecContext } from './vm/index.js';

/**
 * CommandExecutor that passes spawn requests through HostExecContext.
 * This keeps child processes sandboxed by routing them through wasmer-js.
 */
export function createCommandExecutor(ctx: HostExecContext): CommandExecutor {
  return {
    spawn(command, args, options): SpawnedProcess {
      return ctx.spawnChildStreaming(command, args, {
        cwd: options.cwd,
        env: options.env,
        onStdout: options.onStdout,
        onStderr: options.onStderr,
      });
    },
  };
}
```

### 2.2 Extend HostExecContext with child spawn support

**File:** `packages/nanosandbox/src/vm/index.ts`

```typescript
interface HostExecContext {
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd: string;

  // Existing streaming callbacks
  onStdout?: (data: Uint8Array) => void;
  onStderr?: (data: Uint8Array) => void;
  setStdinWriter?: (writer: (data: Uint8Array) => void, closer: () => void) => void;
  setKillFunction?: (killFn: (signal: number) => void) => void;

  // NEW: Child process spawning (for nested spawns from sandboxed code)
  spawnChildStreaming(
    command: string,
    args: string[],
    options: {
      cwd?: string;
      env?: Record<string, string>;
      onStdout?: (data: Uint8Array) => void;
      onStderr?: (data: Uint8Array) => void;
    }
  ): SpawnedProcess;
}
```

### 2.3 wasmer-js scheduler provides spawnChildStreaming

The `spawnChildStreaming` method is provided by wasmer-js when it creates the HostExecContext. It routes spawn requests back through the wasmer-js scheduler to create new sandboxed WASIX processes.

### 2.4 Pass CommandExecutor to NodeProcess

**File:** `packages/nanosandbox/src/vm/index.ts` (in handleNodeCommand)

```typescript
import { createCommandExecutor } from '../command-executor.js';

async function handleNodeCommand(ctx: HostExecContext): Promise<number> {
  // ... existing code ...

  const nodeProcess = new NodeProcess({
    memoryLimit: 128,
    processConfig: { /* ... */ },
    commandExecutor: createCommandExecutor(ctx), // Pass ctx for sandboxed spawns
  });

  // ... rest of existing code ...
}
```

---

## Part 3: wasmer-js - HostExecContext child spawn support

The HostExecContext needs to be extended in wasmer-js to provide `spawnChild` and `spawnChildStreaming` methods.

### 3.1 Update HostExecContext creation in scheduler

**File:** `wasmer-js/src/tasks/scheduler.rs`

When creating the HostExecContext JS object, add:

```rust
// spawnChildStreaming - streaming spawn, returns SpawnedProcess handle
let spawn_child_streaming = Closure::wrap(Box::new(move |command: String, args_json: String, options: JsValue| -> JsValue {
    // Parse args/options, create new host_exec session
    // Return object with writeStdin/closeStdin/kill/wait methods
}) as Box<dyn Fn(String, String, JsValue) -> JsValue>);

js_sys::Reflect::set(&ctx, &"spawnChildStreaming".into(), spawn_child_streaming.as_ref())?;
```

This reuses the existing host_exec infrastructure to spawn nested WASIX processes.

---

## Implementation Order

### Phase 1: sandboxed-node
1. Add `SpawnedProcess` interface
2. Add `spawn()` to `CommandExecutor` interface
3. Add session management and References in NodeProcess
4. Update bridge `spawn()` to use streaming mode
5. Test with mock CommandExecutor

### Phase 2: nanosandbox
1. Create `createCommandExecutor(ctx)`
2. Pass CommandExecutor to NodeProcess in handleNodeCommand
3. Integration tests

### Phase 3: Tests
1. stdout streaming test
2. stdin write test
3. kill test
4. Interactive process test

---

## Testing

```typescript
describe('child_process streaming', () => {
  it('should stream stdout', async () => {
    const result = await nodeProcess.exec(`
      const { spawn } = require('child_process');
      const child = spawn('echo', ['hello']);
      child.stdout.on('data', (d) => console.log('got:', d.toString().trim()));
    `);
    expect(result.stdout).toContain('got: hello');
  });

  it('should write to stdin', async () => {
    const result = await nodeProcess.exec(`
      const { spawn } = require('child_process');
      const child = spawn('cat');
      child.stdin.write('hello\\n');
      child.stdin.end();
      child.stdout.on('data', (d) => console.log(d.toString()));
    `);
    expect(result.stdout).toContain('hello');
  });

  it('should kill process', async () => {
    const result = await nodeProcess.exec(`
      const { spawn } = require('child_process');
      const child = spawn('sleep', ['10']);
      setTimeout(() => child.kill(), 100);
      child.on('close', () => console.log('killed'));
    `);
    expect(result.stdout).toContain('killed');
  });
});
```
