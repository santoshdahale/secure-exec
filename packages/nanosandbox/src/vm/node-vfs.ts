/**
 * VirtualFileSystem implementation for nanosandbox.
 *
 * CRITICAL: This module MUST use vfs directly with NO path transformation.
 * - NO /data path handling in this file
 * - NO Directory objects in this file
 * - Just pass paths through as-is to the VFS
 *
 * The path handling logic is in wasix-vfs.ts, not here.
 *
 * @see wasmer_vfs_api.md for the specification
 */
import type { VirtualFileSystem } from "sandboxed-node";
import type { AsyncVFS } from "./wasix-vfs.js";

/**
 * Create a VirtualFileSystem that delegates directly to an AsyncVFS.
 * Paths are passed through as-is - no transformation.
 *
 * @param vfs - The AsyncVFS to delegate to
 * @returns A VirtualFileSystem implementation
 */
export function createVirtualFileSystem(vfs: AsyncVFS): VirtualFileSystem {
	return {
		readFile: async (path: string): Promise<Uint8Array> => {
			return vfs.readFile(path);
		},

		readTextFile: async (path: string): Promise<string> => {
			return vfs.readTextFile(path);
		},

		readDir: async (path: string): Promise<string[]> => {
			return vfs.readDir(path);
		},

		writeFile: async (path: string, content: string | Uint8Array): Promise<void> => {
			await vfs.writeFile(path, content);
		},

		createDir: async (path: string): Promise<void> => {
			await vfs.mkdir(path);
		},

		removeFile: async (path: string): Promise<void> => {
			await vfs.removeFile(path);
		},

		removeDir: async (path: string): Promise<void> => {
			await vfs.removeDir(path);
		},

		exists: async (path: string): Promise<boolean> => {
			return vfs.exists(path);
		},

		mkdir: async (path: string): Promise<void> => {
			await vfs.mkdir(path);
		},
	};
}
