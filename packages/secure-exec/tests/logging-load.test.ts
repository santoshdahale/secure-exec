import { afterEach, describe, expect, it } from "vitest";
import { NodeProcess } from "../src/index.js";

describe("logging load", () => {
	let proc: NodeProcess | undefined;

	afterEach(() => {
		proc?.dispose();
		proc = undefined;
	});

	it(
		"drops high-volume logs without exposing buffered stdout/stderr fields",
		async () => {
			proc = new NodeProcess();
			const lineCount = 40_000;
			const payloadChars = 256;

			const result = await proc.exec(`
					const lineCount = ${lineCount};
					const payload = "x".repeat(${payloadChars});
					for (let i = 0; i < lineCount; i += 1) {
						console.log(i + ":" + payload);
					}
				`);

			expect(result.code).toBe(0);
			expect(result).not.toHaveProperty("stdout");
			expect(result).not.toHaveProperty("stderr");
			expect(result.errorMessage).toBeUndefined();
		},
		20_000,
	);
});
