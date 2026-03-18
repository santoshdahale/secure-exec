import { afterEach, describe, expect, it } from "vitest";
import { allowAllEnv, allowAllChildProcess } from "../../../src/index.js";
import { createTestNodeRuntime } from "../../test-utils.js";
import type { NodeRuntime, CommandExecutor } from "../../../src/index.js";
import type { SpawnedProcess } from "../../../src/types.js";

type CapturedConsoleEvent = {
	channel: "stdout" | "stderr";
	message: string;
};

function createConsoleCapture() {
	const events: CapturedConsoleEvent[] = [];
	return {
		onStdio: (event: CapturedConsoleEvent) => {
			events.push(event);
		},
		stdout: () =>
			events
				.filter((e) => e.channel === "stdout")
				.map((e) => e.message)
				.join(""),
	};
}

describe("runtime driver specific: node env leakage", () => {
	let proc: NodeRuntime | undefined;

	afterEach(async () => {
		if (proc) {
			try {
				await proc.terminate();
			} catch {
				proc.dispose();
			}
			proc = undefined;
		}
	});

	it("sandboxed code cannot read process.env.PATH from host", async () => {
		const capture = createConsoleCapture();
		proc = createTestNodeRuntime({ onStdio: capture.onStdio });
		const result = await proc.exec(
			`console.log(JSON.stringify({ path: process.env.PATH }));`,
		);
		expect(result.code).toBe(0);
		const parsed = JSON.parse(capture.stdout().trim());
		expect(parsed.path).toBeUndefined();
	});

	it("sandboxed code cannot read process.env.HOME from host", async () => {
		const capture = createConsoleCapture();
		proc = createTestNodeRuntime({ onStdio: capture.onStdio });
		const result = await proc.exec(
			`console.log(JSON.stringify({ home: process.env.HOME }));`,
		);
		expect(result.code).toBe(0);
		const parsed = JSON.parse(capture.stdout().trim());
		expect(parsed.home).toBeUndefined();
	});

	it("exec env override only exposes specified vars", async () => {
		const capture = createConsoleCapture();
		proc = createTestNodeRuntime({
			permissions: { ...allowAllEnv },
			onStdio: capture.onStdio,
		});
		const result = await proc.exec(
			`console.log(JSON.stringify({
				custom: process.env.CUSTOM_TEST_VAR,
				path: process.env.PATH,
			}));`,
			{ env: { CUSTOM_TEST_VAR: "hello-secure-exec" } },
		);
		expect(result.code).toBe(0);
		const parsed = JSON.parse(capture.stdout().trim());
		expect(parsed.custom).toBe("hello-secure-exec");
		// No host env was passed via processConfig, so PATH should not appear
		expect(parsed.path).toBeUndefined();
	});

	it("with allowAllEnv permission, host env IS accessible", async () => {
		const capture = createConsoleCapture();
		proc = createTestNodeRuntime({
			permissions: { ...allowAllEnv },
			processConfig: {
				env: {
					PATH: process.env.PATH ?? "/usr/bin",
					HOME: process.env.HOME ?? "/root",
					SECURE_EXEC_TEST_MARKER: "env-positive-control",
				},
			},
			onStdio: capture.onStdio,
		});
		const result = await proc.exec(
			`console.log(JSON.stringify({
				path: process.env.PATH,
				home: process.env.HOME,
				marker: process.env.SECURE_EXEC_TEST_MARKER,
			}));`,
		);
		expect(result.code).toBe(0);
		const parsed = JSON.parse(capture.stdout().trim());
		expect(parsed.path).toBe(process.env.PATH ?? "/usr/bin");
		expect(parsed.home).toBe(process.env.HOME ?? "/root");
		expect(parsed.marker).toBe("env-positive-control");
	});

	// ---------------------------------------------------------------
	// Dangerous env var filtering for child process spawn
	// ---------------------------------------------------------------

	function createCapturingExecutor() {
		const calls: { command: string; args: string[]; env?: Record<string, string> }[] = [];
		const executor: CommandExecutor = {
			spawn(command, args, options): SpawnedProcess {
				calls.push({ command, args, env: options?.env });
				return {
					writeStdin: () => {},
					closeStdin: () => {},
					kill: () => {},
					wait: () => Promise.resolve(0),
				};
			},
		};
		return { executor, calls };
	}

	it("strips LD_PRELOAD from child process spawn env", async () => {
		const { executor, calls } = createCapturingExecutor();
		proc = createTestNodeRuntime({
			permissions: { ...allowAllChildProcess },
			commandExecutor: executor,
		});
		await proc.run(`
			const cp = require('child_process');
			cp.spawnSync('echo', ['hi'], {
				env: { LD_PRELOAD: '/evil/lib.so', SAFE_VAR: 'ok' },
			});
		`);
		expect(calls.length).toBe(1);
		expect(calls[0].env).toBeDefined();
		expect(calls[0].env!.LD_PRELOAD).toBeUndefined();
		expect(calls[0].env!.SAFE_VAR).toBe("ok");
	});

	it("strips NODE_OPTIONS from child process spawn env", async () => {
		const { executor, calls } = createCapturingExecutor();
		proc = createTestNodeRuntime({
			permissions: { ...allowAllChildProcess },
			commandExecutor: executor,
		});
		await proc.run(`
			const cp = require('child_process');
			cp.spawnSync('echo', ['hi'], {
				env: { NODE_OPTIONS: '--require=evil.js', PATH: '/usr/bin' },
			});
		`);
		expect(calls.length).toBe(1);
		expect(calls[0].env!.NODE_OPTIONS).toBeUndefined();
		expect(calls[0].env!.PATH).toBe("/usr/bin");
	});

	it("normal env vars pass through child process spawn correctly", async () => {
		const { executor, calls } = createCapturingExecutor();
		proc = createTestNodeRuntime({
			permissions: { ...allowAllChildProcess },
			commandExecutor: executor,
		});
		await proc.run(`
			const cp = require('child_process');
			cp.spawnSync('echo', ['hi'], {
				env: { PATH: '/usr/bin', HOME: '/home/test', CUSTOM: 'value' },
			});
		`);
		expect(calls.length).toBe(1);
		expect(calls[0].env).toEqual({
			PATH: "/usr/bin",
			HOME: "/home/test",
			CUSTOM: "value",
		});
	});
});
