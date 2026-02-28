import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	HOST_BRIDGE_GLOBAL_KEY_LIST,
	RUNTIME_BRIDGE_GLOBAL_KEY_LIST,
} from "../src/shared/bridge-contract.js";
import { NODE_CUSTOM_GLOBAL_INVENTORY } from "../src/shared/global-exposure.js";

function readSource(relativePath: string): string {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("bridge contract registry", () => {
	it("keeps canonical bridge key lists represented in custom-global inventory", () => {
		const inventoryNames = new Set(
			NODE_CUSTOM_GLOBAL_INVENTORY.map((entry) => entry.name),
		);
		for (const key of HOST_BRIDGE_GLOBAL_KEY_LIST) {
			expect(inventoryNames.has(key)).toBe(true);
		}
		for (const key of RUNTIME_BRIDGE_GLOBAL_KEY_LIST) {
			expect(inventoryNames.has(key)).toBe(true);
		}
	});

	it("uses shared host bridge key constants for jail wiring", () => {
		const source = readSource("src/index.ts");
		expect(source).toContain("HOST_BRIDGE_GLOBAL_KEYS.dynamicImport");
		expect(source).toContain("HOST_BRIDGE_GLOBAL_KEYS.networkFetchRaw");
		expect(source).toContain("HOST_BRIDGE_GLOBAL_KEYS.childProcessSpawnStart");
		expect(source).toContain("HOST_BRIDGE_GLOBAL_KEYS.processConfig");

		for (const key of HOST_BRIDGE_GLOBAL_KEY_LIST) {
			expect(source).not.toContain(`jail.set(\"${key}\"`);
		}
	});

	it("keeps bridge modules and isolate runtime declarations coupled to shared contracts", () => {
		const bridgeFiles = [
			"src/bridge/fs.ts",
			"src/bridge/module.ts",
			"src/bridge/process.ts",
			"src/bridge/network.ts",
			"src/bridge/child-process.ts",
		];
		for (const file of bridgeFiles) {
			expect(readSource(file)).toContain("../shared/bridge-contract.js");
		}

		const runtimeGlobals = readSource(
			"isolate-runtime/src/common/runtime-globals.d.ts",
		);
		expect(runtimeGlobals).toContain(
			'from "../../../src/shared/bridge-contract.js"',
		);
	});
});
