import { describe, expect, it, beforeAll } from "vitest";
import { Runtime } from "../src/runtime/index.js";

/**
 * WASIX POSIX Compliance Tests.
 * Tests POSIX/libc compliance through shell features and syscalls.
 */
describe("WASIX POSIX Compliance", () => {
	let runtime: Runtime;

	beforeAll(async () => {
		runtime = await Runtime.load();
	});

	describe("Pipes and Redirections", () => {
		it("should pipe output between commands", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "echo 'hello world' | tr ' ' '\\n'"],
			});
			expect(vm.stdout).toContain("hello");
			expect(vm.stdout).toContain("world");
			expect(vm.code).toBe(0);
		});

		it("should chain pipes with bash builtins", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "echo -e 'line1\\nline2\\nline3' | while read line; do echo \"got: $line\"; done"],
			});
			expect(vm.stdout).toContain("got: line1");
			expect(vm.stdout).toContain("got: line2");
			expect(vm.code).toBe(0);
		});

		it("should append to files with >>", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "echo 'first' > /data/append.txt && echo 'second' >> /data/append.txt && cat /data/append.txt"],
			});
			expect(vm.stdout.trim()).toBe("first\nsecond");
			expect(vm.code).toBe(0);
		});

		it("should redirect stderr with 2>", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "ls /nonexistent 2>/data/err.txt; cat /data/err.txt"],
			});
			// stderr should be captured in the file
			expect(vm.stdout.toLowerCase()).toContain("no such file");
			expect(vm.code).toBe(0);
		});

		it("should use here-strings with <<<", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "cat <<< 'hello here-string'"],
			});
			expect(vm.stdout.trim()).toBe("hello here-string");
			expect(vm.code).toBe(0);
		});
	});

	describe("Environment Variables", () => {
		it("should set and read environment variables", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "export MYVAR=hello && echo $MYVAR"],
			});
			expect(vm.stdout.trim()).toBe("hello");
			expect(vm.code).toBe(0);
		});

		it("should have PATH set", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "echo $PATH"],
			});
			expect(vm.stdout).toContain("/bin");
			expect(vm.code).toBe(0);
		});

		it("should allow setting HOME", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "export HOME=/home/user && echo $HOME"],
			});
			expect(vm.stdout.trim()).toBe("/home/user");
			expect(vm.code).toBe(0);
		});

		it("should expand variables in strings", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", 'NAME=World && echo "Hello, $NAME!"'],
			});
			expect(vm.stdout.trim()).toBe("Hello, World!");
			expect(vm.code).toBe(0);
		});

		it("should handle variable substitution with default", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", 'echo ${UNDEFINED_VAR:-default_value}'],
			});
			expect(vm.stdout.trim()).toBe("default_value");
			expect(vm.code).toBe(0);
		});
	});

	describe("Command Substitution", () => {
		it("should handle $() command substitution", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "echo $(echo hello)"],
			});
			expect(vm.stdout.trim()).toBe("hello");
			expect(vm.code).toBe(0);
		});

		it("should handle backtick command substitution", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "echo `echo world`"],
			});
			expect(vm.stdout.trim()).toBe("world");
			expect(vm.code).toBe(0);
		});

		it("should handle nested command substitution", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "echo $(echo $(echo nested))"],
			});
			expect(vm.stdout.trim()).toBe("nested");
			expect(vm.code).toBe(0);
		});

		it("should capture command output in variable", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "result=$(echo captured) && echo $result"],
			});
			expect(vm.stdout.trim()).toBe("captured");
			expect(vm.code).toBe(0);
		});

		it("should use command substitution with pipes", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "count=$(echo -e 'a\\nb\\nc' | wc -l) && echo $count"],
			});
			expect(vm.stdout.trim()).toBe("3");
			expect(vm.code).toBe(0);
		});
	});

	describe("Control Flow", () => {
		it("should handle if/then/else", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", 'if [ 1 -eq 1 ]; then echo yes; else echo no; fi'],
			});
			expect(vm.stdout.trim()).toBe("yes");
			expect(vm.code).toBe(0);
		});

		it("should handle for loops", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "for i in 1 2 3; do echo $i; done"],
			});
			expect(vm.stdout.trim()).toBe("1\n2\n3");
			expect(vm.code).toBe(0);
		});

		it("should handle while loops", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "i=0; while [ $i -lt 3 ]; do echo $i; i=$((i+1)); done"],
			});
			expect(vm.stdout.trim()).toBe("0\n1\n2");
			expect(vm.code).toBe(0);
		});

		it("should handle case statements", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", 'x=b; case $x in a) echo first;; b) echo second;; *) echo other;; esac'],
			});
			expect(vm.stdout.trim()).toBe("second");
			expect(vm.code).toBe(0);
		});

		it("should handle command chaining with &&", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "echo first && echo second && echo third"],
			});
			expect(vm.stdout.trim()).toBe("first\nsecond\nthird");
			expect(vm.code).toBe(0);
		});

		it("should handle command chaining with ||", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "false || echo fallback"],
			});
			expect(vm.stdout.trim()).toBe("fallback");
			expect(vm.code).toBe(0);
		});
	});

	describe("Exit Codes", () => {
		it("should return 0 for successful commands", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "echo success"],
			});
			expect(vm.code).toBe(0);
		});

		it("should return non-zero for failed commands", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "exit 42"],
			});
			expect(vm.code).toBe(42);
		});

		it("should capture $? from previous command", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "true; echo $?"],
			});
			expect(vm.stdout.trim()).toBe("0");
			expect(vm.code).toBe(0);
		});

		it("should capture non-zero $? from failed command", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "false; echo $?"],
			});
			expect(vm.stdout.trim()).toBe("1");
			expect(vm.code).toBe(0);
		});
	});

	describe("Working Directory", () => {
		it("should print working directory with pwd", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "pwd"],
			});
			expect(vm.stdout.trim().length).toBeGreaterThan(0);
			expect(vm.code).toBe(0);
		});

		it("should change directory with cd", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "cd /tmp && pwd"],
			});
			expect(vm.stdout.trim()).toBe("/tmp");
			expect(vm.code).toBe(0);
		});

		it("should handle paths with subdirectories", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "mkdir -p /data/subdir && echo test > /data/subdir/file.txt && cat /data/subdir/file.txt"],
			});
			expect(vm.stdout.trim()).toBe("test");
			expect(vm.code).toBe(0);
		});
	});

	describe("Arithmetic", () => {
		it("should evaluate arithmetic with $(())", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "echo $((5 + 3))"],
			});
			expect(vm.stdout.trim()).toBe("8");
			expect(vm.code).toBe(0);
		});

		it("should handle multiplication and division", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "echo $((10 * 3 / 2))"],
			});
			expect(vm.stdout.trim()).toBe("15");
			expect(vm.code).toBe(0);
		});

		it("should handle modulo", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "echo $((17 % 5))"],
			});
			expect(vm.stdout.trim()).toBe("2");
			expect(vm.code).toBe(0);
		});

		it("should handle variables in arithmetic", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "a=10; b=3; echo $((a + b))"],
			});
			expect(vm.stdout.trim()).toBe("13");
			expect(vm.code).toBe(0);
		});
	});

	describe("String Operations", () => {
		it("should get string length with ${#var}", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", 'str="hello"; echo ${#str}'],
			});
			expect(vm.stdout.trim()).toBe("5");
			expect(vm.code).toBe(0);
		});

		it("should extract substring with ${var:start:len}", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", 'str="hello world"; echo ${str:0:5}'],
			});
			expect(vm.stdout.trim()).toBe("hello");
			expect(vm.code).toBe(0);
		});

		it("should replace in string with ${var/pattern/replacement}", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", 'str="hello world"; echo ${str/world/bash}'],
			});
			expect(vm.stdout.trim()).toBe("hello bash");
			expect(vm.code).toBe(0);
		});
	});

	describe("Glob Patterns", () => {
		it("should expand * glob pattern", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "echo /bin/e*"],
			});
			expect(vm.stdout).toContain("echo");
			expect(vm.code).toBe(0);
		});

		it("should expand ? glob pattern", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "mkdir -p /data/glob && touch /data/glob/a1 /data/glob/a2 /data/glob/b1 && ls /data/glob/a?"],
			});
			expect(vm.stdout).toContain("a1");
			expect(vm.stdout).toContain("a2");
			expect(vm.stdout).not.toContain("b1");
			expect(vm.code).toBe(0);
		});
	});

	describe("Bash-specific Features", () => {
		// Note: tail is not available in wasmer/coreutils multi-call binary
		// Using bash builtin to read last lines instead
		it("should read last lines with bash mapfile", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "echo -e 'a\\nb\\nc\\nd\\ne' > /data/lines.txt && mapfile -t lines < /data/lines.txt && echo ${lines[-2]}; echo ${lines[-1]}"],
			});
			expect(vm.stdout).toContain("d");
			expect(vm.stdout).toContain("e");
			expect(vm.code).toBe(0);
		});

		// Note: sort/uniq/tac spawn as separate processes and have issues with stdin in WASM
		// These tests use bash builtins or simpler patterns instead
		it("should iterate with for loop over pipe output", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "for item in cherry apple banana; do echo $item; done | while read line; do echo $line; done"],
			});
			expect(vm.stdout).toContain("cherry");
			expect(vm.stdout).toContain("apple");
			expect(vm.stdout).toContain("banana");
			expect(vm.code).toBe(0);
		});

		it("should filter with case pattern matching", async () => {
			const vm = await runtime.run("bash", {
				args: ["-c", "echo -e 'apple\\nbanana\\napricot' > /data/fruits.txt && cat /data/fruits.txt | while read line; do case $line in a*) echo $line;; esac; done"],
			});
			expect(vm.stdout).toContain("apple");
			expect(vm.stdout).toContain("apricot");
			expect(vm.stdout).not.toContain("banana");
			expect(vm.code).toBe(0);
		});
	});
});
