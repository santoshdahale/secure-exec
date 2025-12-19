# Wasmer VFS API Specification

---

## ⚠️ CRITICAL IMPLEMENTATION NOTE ⚠️

**`vm/virtual-filesystem.ts` MUST use `vm.vfs` directly. DO NOT use `/data` anywhere.**

### The Rule

```typescript
// ✅ CORRECT - Read directly from vm.vfs
const content = await vm.vfs.readTextFile('/app/script.js');

// ❌ WRONG - Do not use /data paths
const content = await vm.vfs.readTextFile('/data/script.js');

// ❌ WRONG - Do not use Directory objects
const dir = new Directory();
await dir.writeFile(...);

// ❌ WRONG - Do not mutate or transform paths
const newPath = path.replace('/app', '/data');
```

### Why This Matters

1. **`vm.vfs` IS the filesystem** - It gives direct access to the WASIX virtual filesystem. Use it.
2. **Mounts are separate from VFS access** - The existing mount structure (`/data` & `/ipc`) should remain unchanged, but `virtual-filesystem.ts` does NOT interact with mounts. It reads/writes via `vm.vfs` only.
3. **Keep paths as-is** - If the WASM code references `/app/script.js`, read from `/app/script.js`. No path transformation.
4. **Simplicity** - `vm.vfs.readTextFile(path)` is all you need. No path manipulation, no special handling for `/data` or `/ipc`.

### Implementation in `vm/virtual-filesystem.ts`

```typescript
// The ONLY pattern you should use:
export class VirtualFilesystem {
  constructor(private vm: WasixVM) {}

  async readFile(path: string): Promise<Uint8Array> {
    return this.vm.vfs.readFile(path);  // Direct. Simple. Correct.
  }

  async readTextFile(path: string): Promise<string> {
    return this.vm.vfs.readTextFile(path);  // No path manipulation.
  }

  // ... etc - always delegate to vm.vfs with the EXACT path given
}
```

**DO NOT (in `virtual-filesystem.ts`):**
- Reference `/data` or `/ipc` paths explicitly
- Transform or mutate paths in any way
- Create Directory objects for VFS operations
- Use any filesystem abstraction other than `vm.vfs`

**Note:** The mount structure (`/data` & `/ipc`) is configured elsewhere and remains unchanged. `virtual-filesystem.ts` simply uses `vm.vfs` to access whatever paths the WASM code requests - including files under `/data` or `/ipc` if requested. The point is: no special-casing, no path rewriting, just pass through to `vm.vfs`.

---

## Overview

The VFS (Virtual File System) API exposes the WASIX virtual filesystem to JavaScript, allowing the host to read and write files from any path inside the WASIX VM - not just mounted directories.

## Motivation

When running WASIX programs, the host often needs to:

1. **Pre-populate files** before execution (config, input data, scripts)
2. **Read output files** after execution (logs, results, generated artifacts)
3. **Monitor files** during execution (status files, progress indicators)
4. **Implement virtual commands** that need to read scripts/data from the VM's filesystem

Currently, the only way to share files is through mounted directories, which:
- Requires pre-planning which paths to mount
- Exposes host filesystem paths to the VM
- Doesn't allow access to files created in non-mounted locations (e.g., `/tmp`)

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  JavaScript                                                         │
│                                                                     │
│  const instance = await Wasmer.runWasix(wasm, { args: ['run'] });   │
│                                                                     │
│  // Write input before/during execution                             │
│  await instance.vfs.writeFile('/input/data.json', jsonData);        │
│                                                                     │
│  // Wait for completion                                             │
│  await instance.wait();                                             │
│                                                                     │
│  // Read output after execution                                     │
│  const result = await instance.vfs.readFile('/output/result.bin');  │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ wasm-bindgen
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  wasmer-js Instance (Rust/WASM)                                     │
│                                                                     │
│  pub struct Instance {                                              │
│      stdin: Option<WritableStream>,                                 │
│      stdout: ReadableStream,                                        │
│      stderr: ReadableStream,                                        │
│      exit: Receiver<ExitCondition>,                                 │
│      fs: Arc<dyn FileSystem + Send + Sync>,  // ← NEW               │
│  }                                                                  │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  WasiFsRoot (implements virtual_fs::FileSystem)                     │
│                                                                     │
│  enum WasiFsRoot {                                                  │
│      Sandbox(TmpFileSystem),           // In-memory FS              │
│      Overlay(OverlayFileSystem<...>),  // Layered FS (common)       │
│      Backing(Arc<dyn FileSystem>),     // Custom backing FS         │
│  }                                                                  │
│                                                                     │
│  The same filesystem the WASM program sees via WASI syscalls        │
└─────────────────────────────────────────────────────────────────────┘
```

## API Design

### JavaScript API

```typescript
interface Instance {
  // Existing fields
  stdin?: WritableStream<Uint8Array>;
  stdout: ReadableStream<Uint8Array>;
  stderr: ReadableStream<Uint8Array>;
  wait(): Promise<Output>;

  // VFS API - direct methods
  vfsReadFile(path: string): Promise<Uint8Array>;
  vfsReadTextFile(path: string): Promise<string>;
  vfsWriteFile(path: string, content: Uint8Array): Promise<void>;
  vfsWriteTextFile(path: string, content: string): Promise<void>;
  vfsExists(path: string): boolean;
  vfsStat(path: string): VfsStat;
  vfsReadDir(path: string): VfsDirEntry[];
  vfsMkdir(path: string): void;
  vfsRemoveFile(path: string): void;
  vfsRemoveDir(path: string): void;

  // VFS API - wrapper object (convenience)
  readonly vfs: VFS;
}

interface VFS {
  readFile(path: string): Promise<Uint8Array>;
  readTextFile(path: string): Promise<string>;
  writeFile(path: string, content: Uint8Array | string): Promise<void>;
  exists(path: string): boolean;
  stat(path: string): VfsStat;
  readDir(path: string): VfsDirEntry[];
  mkdir(path: string): void;
  removeFile(path: string): void;
  removeDir(path: string): void;
}

interface VfsStat {
  isFile: boolean;
  isDir: boolean;
  size: number;
  // Future: mtime, atime, mode, etc.
}

interface VfsDirEntry {
  name: string;
  path: string;
  // Future: isFile, isDir, size
}
```

### Method Specifications

#### `vfsReadFile(path: string): Promise<Uint8Array>`

Read the entire contents of a file as binary data.

**Parameters:**
- `path`: Absolute path in the WASIX filesystem (e.g., `/app/script.js`)

**Returns:** File contents as `Uint8Array`

**Errors:**
- File does not exist
- Path is a directory
- Permission denied (if capabilities restrict access)

**Example:**
```typescript
const data = await instance.vfsReadFile('/tmp/output.bin');
```

---

#### `vfsReadTextFile(path: string): Promise<string>`

Read the entire contents of a file as UTF-8 text.

**Parameters:**
- `path`: Absolute path in the WASIX filesystem

**Returns:** File contents as UTF-8 string

**Errors:**
- File does not exist
- Path is a directory
- File is not valid UTF-8

**Example:**
```typescript
const config = await instance.vfsReadTextFile('/etc/config.json');
const parsed = JSON.parse(config);
```

---

#### `vfsWriteFile(path: string, content: Uint8Array): Promise<void>`

Write binary data to a file, creating it if it doesn't exist, or truncating if it does.

**Parameters:**
- `path`: Absolute path in the WASIX filesystem
- `content`: Binary data to write

**Behavior:**
- Creates parent directories if they don't exist
- Truncates existing file
- Creates new file if it doesn't exist

**Errors:**
- Cannot create parent directory
- Path is a directory
- Filesystem is read-only

**Example:**
```typescript
const data = new Uint8Array([0x00, 0x01, 0x02]);
await instance.vfsWriteFile('/tmp/binary.dat', data);
```

---

#### `vfsWriteTextFile(path: string, content: string): Promise<void>`

Write a UTF-8 string to a file.

**Parameters:**
- `path`: Absolute path in the WASIX filesystem
- `content`: String to write (encoded as UTF-8)

**Example:**
```typescript
await instance.vfsWriteTextFile('/app/config.json', JSON.stringify({
  debug: true,
  port: 8080
}));
```

---

#### `vfsExists(path: string): boolean`

Check if a path exists (file or directory).

**Parameters:**
- `path`: Absolute path to check

**Returns:** `true` if path exists, `false` otherwise

**Note:** This is synchronous as it only checks metadata.

**Example:**
```typescript
if (instance.vfsExists('/tmp/ready.flag')) {
  console.log('Process is ready');
}
```

---

#### `vfsStat(path: string): VfsStat`

Get metadata about a file or directory.

**Parameters:**
- `path`: Absolute path to stat

**Returns:** `VfsStat` object with metadata

**Errors:**
- Path does not exist

**Example:**
```typescript
const stat = instance.vfsStat('/app/data.bin');
if (stat.isFile && stat.size > 0) {
  const content = await instance.vfsReadFile('/app/data.bin');
}
```

---

#### `vfsReadDir(path: string): VfsDirEntry[]`

List contents of a directory.

**Parameters:**
- `path`: Absolute path to directory

**Returns:** Array of directory entries

**Errors:**
- Path does not exist
- Path is not a directory

**Example:**
```typescript
const entries = instance.vfsReadDir('/app');
for (const entry of entries) {
  console.log(`${entry.name} -> ${entry.path}`);
}
```

---

#### `vfsMkdir(path: string): void`

Create a directory and all parent directories.

**Parameters:**
- `path`: Absolute path of directory to create

**Behavior:**
- Creates all missing parent directories (like `mkdir -p`)
- No error if directory already exists

**Errors:**
- Path exists as a file
- Filesystem is read-only

**Example:**
```typescript
instance.vfsMkdir('/app/data/cache');
```

---

#### `vfsRemoveFile(path: string): void`

Remove a file.

**Parameters:**
- `path`: Absolute path of file to remove

**Errors:**
- Path does not exist
- Path is a directory (use `vfsRemoveDir`)
- Filesystem is read-only

---

#### `vfsRemoveDir(path: string): void`

Remove an empty directory.

**Parameters:**
- `path`: Absolute path of directory to remove

**Errors:**
- Path does not exist
- Path is not a directory
- Directory is not empty
- Filesystem is read-only

---

## Implementation

### Files to Modify

#### wasmer-js

| File | Changes |
|------|---------|
| `src/instance.rs` | Add `fs` field, implement VFS methods |
| `src/run.rs` | Capture filesystem when creating Instance |
| `src-js/index.ts` | Export VFS types and wrapper |

#### wasmer (if needed)

| File | Changes |
|------|---------|
| `lib/wasix/src/state/env.rs` | Ensure `fs_root()` is accessible (already exists) |

### Rust Implementation

#### `src/instance.rs`

```rust
use std::sync::Arc;
use js_sys::Uint8Array;
use wasm_bindgen::prelude::*;
use virtual_fs::{FileSystem, AsyncReadExt, AsyncWriteExt};

use crate::utils::Error;

#[wasm_bindgen]
pub struct Instance {
    #[wasm_bindgen(getter_with_clone, readonly)]
    pub stdin: Option<web_sys::WritableStream>,
    #[wasm_bindgen(getter_with_clone, readonly)]
    pub stdout: web_sys::ReadableStream,
    #[wasm_bindgen(getter_with_clone, readonly)]
    pub stderr: web_sys::ReadableStream,
    pub(crate) exit: futures::channel::oneshot::Receiver<ExitCondition>,

    // NEW: Filesystem reference
    pub(crate) fs: Arc<dyn FileSystem + Send + Sync>,
}

#[wasm_bindgen]
impl Instance {
    // ... existing methods ...

    #[wasm_bindgen(js_name = "vfsReadFile")]
    pub async fn vfs_read_file(&self, path: &str) -> Result<Uint8Array, Error> {
        let path = std::path::Path::new(path);

        let mut file = self.fs
            .new_open_options()
            .read(true)
            .open(path)
            .map_err(|e| Error::msg(format!("Failed to open '{}': {:?}", path.display(), e)))?;

        let mut content = Vec::new();
        file.read_to_end(&mut content)
            .await
            .map_err(|e| Error::msg(format!("Failed to read '{}': {:?}", path.display(), e)))?;

        Ok(Uint8Array::from(&content[..]))
    }

    #[wasm_bindgen(js_name = "vfsReadTextFile")]
    pub async fn vfs_read_text_file(&self, path: &str) -> Result<String, Error> {
        let bytes = self.vfs_read_file(path).await?;
        String::from_utf8(bytes.to_vec())
            .map_err(|e| Error::msg(format!("File '{}' is not valid UTF-8: {}", path, e)))
    }

    #[wasm_bindgen(js_name = "vfsWriteFile")]
    pub async fn vfs_write_file(&self, path: &str, content: &[u8]) -> Result<(), Error> {
        let path = std::path::Path::new(path);

        // Create parent directories
        if let Some(parent) = path.parent() {
            self.create_dir_all(parent)?;
        }

        let mut file = self.fs
            .new_open_options()
            .write(true)
            .create(true)
            .truncate(true)
            .open(path)
            .map_err(|e| Error::msg(format!("Failed to create '{}': {:?}", path.display(), e)))?;

        file.write_all(content)
            .await
            .map_err(|e| Error::msg(format!("Failed to write '{}': {:?}", path.display(), e)))?;

        file.flush()
            .await
            .map_err(|e| Error::msg(format!("Failed to flush '{}': {:?}", path.display(), e)))?;

        Ok(())
    }

    #[wasm_bindgen(js_name = "vfsWriteTextFile")]
    pub async fn vfs_write_text_file(&self, path: &str, content: &str) -> Result<(), Error> {
        self.vfs_write_file(path, content.as_bytes()).await
    }

    #[wasm_bindgen(js_name = "vfsExists")]
    pub fn vfs_exists(&self, path: &str) -> bool {
        self.fs.metadata(std::path::Path::new(path)).is_ok()
    }

    #[wasm_bindgen(js_name = "vfsStat")]
    pub fn vfs_stat(&self, path: &str) -> Result<JsValue, Error> {
        let path = std::path::Path::new(path);
        let metadata = self.fs
            .metadata(path)
            .map_err(|e| Error::msg(format!("Failed to stat '{}': {:?}", path.display(), e)))?;

        let obj = js_sys::Object::new();
        js_sys::Reflect::set(&obj, &"isFile".into(), &metadata.is_file().into()).unwrap();
        js_sys::Reflect::set(&obj, &"isDir".into(), &metadata.is_dir().into()).unwrap();
        js_sys::Reflect::set(&obj, &"size".into(), &JsValue::from_f64(metadata.len() as f64)).unwrap();

        Ok(obj.into())
    }

    #[wasm_bindgen(js_name = "vfsReadDir")]
    pub fn vfs_read_dir(&self, path: &str) -> Result<js_sys::Array, Error> {
        let path = std::path::Path::new(path);
        let entries = self.fs
            .read_dir(path)
            .map_err(|e| Error::msg(format!("Failed to read dir '{}': {:?}", path.display(), e)))?;

        let arr = js_sys::Array::new();
        for entry in entries {
            let entry = entry.map_err(|e| Error::msg(format!("Read dir entry error: {:?}", e)))?;

            let obj = js_sys::Object::new();
            let name = entry.path.file_name()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();
            js_sys::Reflect::set(&obj, &"name".into(), &name.into()).unwrap();
            js_sys::Reflect::set(&obj, &"path".into(), &entry.path.to_string_lossy().into_owned().into()).unwrap();

            arr.push(&obj);
        }

        Ok(arr)
    }

    #[wasm_bindgen(js_name = "vfsMkdir")]
    pub fn vfs_mkdir(&self, path: &str) -> Result<(), Error> {
        self.create_dir_all(std::path::Path::new(path))
            .map_err(|e| Error::msg(format!("Failed to mkdir '{}': {:?}", path, e)))
    }

    #[wasm_bindgen(js_name = "vfsRemoveFile")]
    pub fn vfs_remove_file(&self, path: &str) -> Result<(), Error> {
        self.fs
            .remove_file(std::path::Path::new(path))
            .map_err(|e| Error::msg(format!("Failed to remove '{}': {:?}", path, e)))
    }

    #[wasm_bindgen(js_name = "vfsRemoveDir")]
    pub fn vfs_remove_dir(&self, path: &str) -> Result<(), Error> {
        self.fs
            .remove_dir(std::path::Path::new(path))
            .map_err(|e| Error::msg(format!("Failed to rmdir '{}': {:?}", path, e)))
    }

    fn create_dir_all(&self, path: &std::path::Path) -> Result<(), virtual_fs::FsError> {
        if path.as_os_str().is_empty() || self.fs.metadata(path).is_ok() {
            return Ok(());
        }
        if let Some(parent) = path.parent() {
            self.create_dir_all(parent)?;
        }
        match self.fs.create_dir(path) {
            Ok(()) => Ok(()),
            Err(virtual_fs::FsError::AlreadyExists) => Ok(()),
            Err(e) => Err(e),
        }
    }
}
```

#### `src/run.rs`

```rust
use std::sync::Arc;
use futures::channel::oneshot;
use virtual_fs::FileSystem;
use wasmer_wasix::{WasiEnvBuilder, Runtime as _};

use crate::{Instance, RunOptions, instance::ExitCondition, utils::Error};

#[tracing::instrument(level = "debug", skip_all)]
async fn run_wasix_inner(wasm_module: WasmModule, config: RunOptions) -> Result<Instance, Error> {
    let mut runtime = config.runtime().resolve()?.into_inner();
    runtime = Arc::new(runtime.with_default_pool());

    let program_name = config
        .program()
        .as_string()
        .unwrap_or_else(|| "wasm".to_string());

    let mut builder = WasiEnvBuilder::new(program_name.clone()).runtime(runtime.clone());
    let (stdin, stdout, stderr) = config.configure_builder(&mut builder)?;

    // Build init to capture filesystem BEFORE execution starts
    let init = builder.build_init()
        .map_err(|e| Error::msg(format!("Failed to build WASI env: {}", e)))?;

    // Clone the filesystem reference - this is what JS will access
    let fs: Arc<dyn FileSystem + Send + Sync> = Arc::new(init.state.fs.root_fs.clone());

    let (exit_code_tx, exit_code_rx) = oneshot::channel();

    let module: wasmer::Module = wasm_module.to_module(&*runtime).await?;
    let tasks = runtime.task_manager().clone();

    // Build the actual WasiEnv
    let env = wasmer_wasix::WasiEnv::from_init(init)
        .map_err(|e| Error::msg(format!("Failed to create WASI env: {}", e)))?;

    tasks.spawn_with_module(
        module.clone(),
        Box::new(move |module| {
            let result = crate::bin_factory::spawn_exec_module(module, env, &runtime)
                .and_then(|mut handle| {
                    runtime.task_manager().spawn_and_block_on(async move {
                        handle.wait_finished().await
                    })
                });

            let _ = exit_code_tx.send(ExitCondition::from_result(
                result.map(|r| r.map(|_| ()).map_err(|e| e.into())).unwrap_or(Ok(()))
            ));
        }),
    )?;

    Ok(Instance {
        stdin,
        stdout,
        stderr,
        exit: exit_code_rx,
        fs,  // Include filesystem reference
    })
}
```

### TypeScript Wrapper

#### `src-js/vfs.ts`

```typescript
import type { Instance as RawInstance } from '../pkg/wasmer_js';

export interface VfsStat {
  isFile: boolean;
  isDir: boolean;
  size: number;
}

export interface VfsDirEntry {
  name: string;
  path: string;
}

export interface VFS {
  /**
   * Read a file as binary data
   */
  readFile(path: string): Promise<Uint8Array>;

  /**
   * Read a file as UTF-8 text
   */
  readTextFile(path: string): Promise<string>;

  /**
   * Write data to a file (creates parent directories)
   */
  writeFile(path: string, content: Uint8Array | string): Promise<void>;

  /**
   * Check if a path exists
   */
  exists(path: string): boolean;

  /**
   * Get file/directory metadata
   */
  stat(path: string): VfsStat;

  /**
   * List directory contents
   */
  readDir(path: string): VfsDirEntry[];

  /**
   * Create a directory (and parents)
   */
  mkdir(path: string): void;

  /**
   * Remove a file
   */
  removeFile(path: string): void;

  /**
   * Remove an empty directory
   */
  removeDir(path: string): void;
}

/**
 * Create a VFS wrapper around a raw Instance
 */
export function createVFS(instance: RawInstance): VFS {
  return {
    readFile(path: string): Promise<Uint8Array> {
      return instance.vfsReadFile(path);
    },

    readTextFile(path: string): Promise<string> {
      return instance.vfsReadTextFile(path);
    },

    async writeFile(path: string, content: Uint8Array | string): Promise<void> {
      if (typeof content === 'string') {
        return instance.vfsWriteTextFile(path, content);
      }
      return instance.vfsWriteFile(path, content);
    },

    exists(path: string): boolean {
      return instance.vfsExists(path);
    },

    stat(path: string): VfsStat {
      return instance.vfsStat(path) as VfsStat;
    },

    readDir(path: string): VfsDirEntry[] {
      return Array.from(instance.vfsReadDir(path)) as VfsDirEntry[];
    },

    mkdir(path: string): void {
      instance.vfsMkdir(path);
    },

    removeFile(path: string): void {
      instance.vfsRemoveFile(path);
    },

    removeDir(path: string): void {
      instance.vfsRemoveDir(path);
    },
  };
}
```

---

## Usage Examples

### Example 1: Pre-populate input files

```typescript
import { Wasmer } from '@aspect/wasmer';

async function runWithInput() {
  const wasm = await fetch('/processor.wasm').then(r => r.arrayBuffer());

  const instance = await Wasmer.runWasix(wasm, {
    args: ['process', '/input/data.json', '-o', '/output/result.json'],
  });

  // Write input file BEFORE the WASM program tries to read it
  // (works because WASM runs asynchronously)
  await instance.vfs.writeFile('/input/data.json', JSON.stringify({
    records: [
      { id: 1, value: 'foo' },
      { id: 2, value: 'bar' },
    ]
  }));

  // Wait for completion
  const output = await instance.wait();

  if (output.ok) {
    // Read the output file
    const result = await instance.vfs.readTextFile('/output/result.json');
    console.log('Result:', JSON.parse(result));
  }
}
```

### Example 2: Read logs after execution

```typescript
async function runAndGetLogs() {
  const instance = await Wasmer.runWasix(wasm, {
    args: ['build', '--verbose'],
  });

  await instance.wait();

  // Check if log file was created
  if (instance.vfs.exists('/tmp/build.log')) {
    const log = await instance.vfs.readTextFile('/tmp/build.log');
    console.log('Build log:\n', log);
  }

  // List all files in /tmp
  const tmpFiles = instance.vfs.readDir('/tmp');
  console.log('Temp files:', tmpFiles.map(e => e.name));
}
```

### Example 3: Interactive file monitoring

```typescript
async function monitorProgress() {
  const instance = await Wasmer.runWasix(wasm, {
    args: ['long-running-task'],
  });

  // Poll for progress updates
  const checkProgress = async () => {
    while (true) {
      if (instance.vfs.exists('/tmp/progress.json')) {
        const progress = JSON.parse(
          await instance.vfs.readTextFile('/tmp/progress.json')
        );
        console.log(`Progress: ${progress.percent}%`);

        if (progress.percent >= 100) break;
      }
      await new Promise(r => setTimeout(r, 500));
    }
  };

  // Run monitoring in parallel with waiting
  await Promise.all([
    checkProgress(),
    instance.wait(),
  ]);
}
```

### Example 4: Virtual Node.js shim reading scripts

```typescript
// Used in conjunction with host_exec for the virtual node shim
const hostExecHandler = async (ctx) => {
  const { command, args, vfs } = ctx;

  if (command === 'node' && args[0] && !args[0].startsWith('-')) {
    // Read the script from the WASIX filesystem
    const scriptPath = args[0];
    const script = await vfs.readTextFile(scriptPath);

    // Execute with Node's vm module
    const vm = require('vm');
    const result = vm.runInNewContext(script, { console });

    ctx.stdout.getWriter().write(new TextEncoder().encode(String(result)));
    return 0;
  }

  return 1; // Unknown command
};
```

### Example 5: Filesystem exploration

```typescript
async function exploreFilesystem() {
  const instance = await Wasmer.runWasix(wasm, { args: [] });

  // Recursive directory listing
  function listRecursive(path: string, indent = 0): void {
    const entries = instance.vfs.readDir(path);

    for (const entry of entries) {
      const stat = instance.vfs.stat(entry.path);
      const prefix = '  '.repeat(indent);
      const suffix = stat.isDir ? '/' : ` (${stat.size} bytes)`;
      console.log(`${prefix}${entry.name}${suffix}`);

      if (stat.isDir) {
        listRecursive(entry.path, indent + 1);
      }
    }
  }

  console.log('Filesystem contents:');
  listRecursive('/');
}
```

---

## Filesystem Behavior

### Path Resolution

All paths are absolute paths within the WASIX virtual filesystem:
- `/app/script.js` - File in /app directory
- `/tmp/cache/data.bin` - Nested path
- `/` - Root directory

Relative paths are **not supported**. Always use absolute paths.

### Filesystem Layers

The WASIX filesystem (`WasiFsRoot`) can be:

1. **Sandbox** (`TmpFileSystem`) - Pure in-memory filesystem
2. **Overlay** - Layered filesystem with:
   - Primary: Writable `TmpFileSystem`
   - Secondary: Read-only `UnionFileSystem` of package contents
3. **Backing** - Custom `FileSystem` implementation

When reading, the overlay checks the primary (writable) layer first, then falls back to secondary layers.

When writing, changes go to the primary (writable) layer.

### Concurrency

The VFS API provides **shared access** to the filesystem:
- Multiple JS calls can read/write concurrently
- The WASM program reads/writes to the same filesystem
- No automatic locking - caller is responsible for coordination

For safe concurrent access:
- Use unique file paths per operation
- Use a "ready" flag file pattern for synchronization
- Consider file-based locking if needed

### Persistence

The filesystem is **ephemeral** - it exists only for the lifetime of the `Instance`:
- Files written by WASM are available via VFS API
- Files written via VFS API are visible to WASM
- When the Instance is dropped, all data is lost

To persist data:
- Read files via VFS API before dropping Instance
- Mount a host directory for automatic persistence

---

## Error Handling

All VFS methods throw JavaScript errors on failure:

```typescript
try {
  const content = await instance.vfs.readFile('/nonexistent');
} catch (error) {
  console.error('VFS error:', error.message);
  // "Failed to open '/nonexistent': EntityNotFound"
}
```

Common error types:
- **EntityNotFound** - File or directory doesn't exist
- **AlreadyExists** - File/directory already exists (for exclusive create)
- **NotADirectory** - Expected directory, found file
- **NotAFile** - Expected file, found directory
- **DirectoryNotEmpty** - Cannot remove non-empty directory
- **PermissionDenied** - Operation not allowed
- **ReadOnly** - Filesystem is read-only

---

## Comparison with host_exec VFS

| Aspect | Instance VFS (this spec) | host_exec Session VFS |
|--------|-------------------------|----------------------|
| Scope | Per-Instance | Per-Session |
| Lifetime | Instance lifetime | Session lifetime |
| Access | Anytime | During host_exec handler |
| Use case | General file I/O | Virtual command handlers |
| Isolation | Shared with WASM | Same, but session-scoped |

Both APIs access the same underlying `WasiFsRoot`. The host_exec session VFS is a convenience for handlers that need filesystem access during command execution.

---

## Security Considerations

1. **Full Access**: The VFS API provides unrestricted access to the entire WASIX filesystem. The host can read/write any file the WASM program can access.

2. **No Sandbox Escape**: The VFS is contained within the WASIX virtual filesystem. It cannot access host files unless explicitly mounted.

3. **Capability Alignment**: Consider whether VFS access should respect WASIX capabilities. Currently, JS has full access regardless of WASM capabilities.

4. **Sensitive Data**: Be cautious when WASM programs store sensitive data (credentials, keys) in the filesystem - JS has full visibility.

---

## Future Enhancements

1. **Streaming reads/writes** for large files
2. **Watch/notify** for file changes
3. **Extended metadata** (mtime, atime, mode, owner)
4. **Symbolic links** support
5. **File locking** primitives
6. **Capability-based access control**
7. **Async directory iteration** for large directories

