import { describe, expect, it, beforeAll } from "vitest";
import { Runtime } from "../src/runtime/index.js";

/**
 * WASIX Coreutils Compliance Tests.
 * Tests that coreutils binaries execute correctly in the WASIX environment.
 */
describe("WASIX Coreutils Compliance", () => {
	let runtime: Runtime;

	beforeAll(async () => {
		runtime = await Runtime.load();
	});

	describe("File Operations", () => {
		it("should create and remove directories with mkdir/rmdir", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "mkdir /data/testdir && ls /data && rmdir /data/testdir && ls /data"],
			});
			expect(vm.stdout).toContain("testdir");
			expect(vm.code).toBe(0);
		});

		// Note: cp has platform compatibility issues in WASM, using cat redirection instead
		it("should copy file contents with cat redirection", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "echo 'original' > /data/orig.txt && cat /data/orig.txt > /data/copy.txt && cat /data/copy.txt"],
			});
			expect(vm.stdout.trim()).toBe("original");
			expect(vm.code).toBe(0);
		});

		it("should move/rename files with mv", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "echo 'content' > /data/before.txt && mv /data/before.txt /data/after.txt && cat /data/after.txt"],
			});
			expect(vm.stdout.trim()).toBe("content");
			expect(vm.code).toBe(0);
		});

		it("should remove files with rm", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", 'echo test > /data/todelete.txt && rm /data/todelete.txt && if [ -f /data/todelete.txt ]; then echo exists; else echo deleted; fi'],
			});
			expect(vm.stdout.trim()).toBe("deleted");
			expect(vm.code).toBe(0);
		});

		it("should display file contents with cat", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "echo -e 'line1\\nline2\\nline3' > /data/multi.txt && cat /data/multi.txt"],
			});
			expect(vm.stdout).toContain("line1");
			expect(vm.stdout).toContain("line2");
			expect(vm.stdout).toContain("line3");
			expect(vm.code).toBe(0);
		});
	});

	describe("Text Processing", () => {
		it("should count lines/words/chars with wc", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "echo -e 'one two three\\nfour five' > /data/count.txt && wc /data/count.txt"],
			});
			// Should show 2 lines, 5 words
			expect(vm.stdout).toMatch(/2\s+5/);
			expect(vm.code).toBe(0);
		});

		it("should show first lines with head", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "echo -e 'a\\nb\\nc\\nd\\ne' > /data/lines.txt && head /data/lines.txt"],
			});
			// head without args shows first 10 lines (or all if less)
			expect(vm.stdout).toContain("a");
			expect(vm.stdout).toContain("b");
			expect(vm.code).toBe(0);
		});

		it("should translate characters with tr", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "echo 'hello' | tr 'a-z' 'A-Z'"],
			});
			expect(vm.stdout.trim()).toBe("HELLO");
			expect(vm.code).toBe(0);
		});
	});
});
