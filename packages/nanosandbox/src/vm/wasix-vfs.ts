/**
 * WasixVFS - An async VFS implementation that provides access to the WASM filesystem.
 *
 * This VFS handles:
 * - /data/* paths via the Directory (mounted at /data in WASM)
 * - Other paths via shell commands (for reading WASM system files like /bin/*)
 *
 * All methods are async to properly work with the async Directory API.
 */
import type { Directory } from "@wasmer/sdk/node";

/**
 * Type for shell command callback.
 */
export type ShellCallback = (
	command: string,
	args: string[],
) => Promise<{ stdout: string; stderr: string; code: number }>;

/**
 * Async VFS interface for nanosandbox.
 * All methods are async to work with the async Directory API.
 */
export interface AsyncVFS {
	readFile(path: string): Promise<Uint8Array>;
	readTextFile(path: string): Promise<string>;
	writeFile(path: string, content: Uint8Array | string): Promise<void>;
	exists(path: string): Promise<boolean>;
	readDir(path: string): Promise<string[]>;
	mkdir(path: string): Promise<void>;
	removeFile(path: string): Promise<void>;
	removeDir(path: string): Promise<void>;
}

const DATA_MOUNT_PATH = "/data";

/**
 * Check if a path is under the data mount path.
 */
function isDataPath(path: string): boolean {
	return path.startsWith(DATA_MOUNT_PATH + "/") || path === DATA_MOUNT_PATH;
}

/**
 * Convert a WASM path to a Directory path.
 * E.g., /data/foo.txt → /foo.txt
 */
function toDirectoryPath(path: string): string {
	if (path.startsWith(DATA_MOUNT_PATH + "/")) {
		return path.slice(DATA_MOUNT_PATH.length);
	}
	if (path === DATA_MOUNT_PATH) {
		return "/";
	}
	return path;
}

/**
 * Create an async VFS that provides access to the WASM filesystem.
 *
 * @param directory - The Directory (mounted at /data in WASM)
 * @param shellCallback - Callback for shell commands (for non-/data paths)
 * @returns An AsyncVFS implementation
 */
export function createWasixVFS(
	directory: Directory,
	shellCallback?: ShellCallback,
): AsyncVFS {
	return {
		async readFile(path: string): Promise<Uint8Array> {
			if (isDataPath(path)) {
				return directory.readFile(toDirectoryPath(path));
			}
			// Shell fallback for non-/data paths
			if (shellCallback) {
				const result = await shellCallback("cat", [path]);
				if (result.code !== 0) {
					throw new Error(`Failed to read file: ${path}`);
				}
				return new TextEncoder().encode(result.stdout);
			}
			throw new Error(`Path not accessible: ${path}`);
		},

		async readTextFile(path: string): Promise<string> {
			if (isDataPath(path)) {
				return directory.readTextFile(toDirectoryPath(path));
			}
			// Shell fallback for non-/data paths
			if (shellCallback) {
				const result = await shellCallback("cat", [path]);
				if (result.code !== 0) {
					throw new Error(`Failed to read file: ${path}`);
				}
				return result.stdout;
			}
			throw new Error(`Path not accessible: ${path}`);
		},

		async writeFile(path: string, content: Uint8Array | string): Promise<void> {
			if (!isDataPath(path)) {
				throw new Error(`Cannot write to ${path}. Only paths under ${DATA_MOUNT_PATH}/ are writable.`);
			}
			const dirPath = toDirectoryPath(path);
			// HACK: Workaround for wasmer-js Directory.writeFile missing truncate(true)
			try {
				await directory.removeFile(dirPath);
			} catch {
				// Ignore errors - file may not exist
			}
			await directory.writeFile(dirPath, content);
		},

		async exists(path: string): Promise<boolean> {
			if (isDataPath(path)) {
				const dirPath = toDirectoryPath(path);
				try {
					// Try to read as directory first
					await directory.readDir(dirPath);
					return true;
				} catch {
					// Not a directory, try as file
					try {
						await directory.readFile(dirPath);
						return true;
					} catch {
						return false;
					}
				}
			}
			// Shell fallback for non-/data paths
			if (shellCallback) {
				const result = await shellCallback("ls", ["-d", path]);
				return result.code === 0;
			}
			return false;
		},

		async readDir(path: string): Promise<string[]> {
			if (isDataPath(path)) {
				const entries = await directory.readDir(toDirectoryPath(path));
				return entries.map((entry) =>
					typeof entry === "string" ? entry : (entry as { name: string }).name,
				);
			}
			// Shell fallback for non-/data paths
			if (shellCallback) {
				const result = await shellCallback("ls", ["-1", path]);
				if (result.code !== 0) {
					throw new Error(`Failed to read directory: ${path}`);
				}
				return result.stdout
					.trim()
					.split("\n")
					.filter((name) => name.length > 0);
			}
			throw new Error(`Path not accessible: ${path}`);
		},

		async mkdir(path: string): Promise<void> {
			if (!isDataPath(path)) {
				throw new Error(`Cannot create directory at ${path}. Only paths under ${DATA_MOUNT_PATH}/ are writable.`);
			}
			// Recursively create directories
			const parts = toDirectoryPath(path).split("/").filter(Boolean);
			let currentPath = "";
			for (const part of parts) {
				currentPath += `/${part}`;
				try {
					await directory.createDir(currentPath);
				} catch {
					// Directory may already exist
				}
			}
		},

		async removeFile(path: string): Promise<void> {
			if (!isDataPath(path)) {
				throw new Error(`Cannot remove ${path}. Only paths under ${DATA_MOUNT_PATH}/ are writable.`);
			}
			await directory.removeFile(toDirectoryPath(path));
		},

		async removeDir(path: string): Promise<void> {
			if (!isDataPath(path)) {
				throw new Error(`Cannot remove ${path}. Only paths under ${DATA_MOUNT_PATH}/ are writable.`);
			}
			await directory.removeDir(toDirectoryPath(path));
		},
	};
}
