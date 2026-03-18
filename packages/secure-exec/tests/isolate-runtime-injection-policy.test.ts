import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

function readNodeSource(relativePath: string): string {
	return readFileSync(
		new URL(`../../secure-exec-node/${relativePath}`, import.meta.url),
		"utf8",
	);
}

function readBrowserSource(relativePath: string): string {
	return readFileSync(
		new URL(`../../secure-exec-browser/${relativePath}`, import.meta.url),
		"utf8",
	);
}

describe("isolate runtime injection policy", () => {
	it("avoids template-literal isolate eval snippets in Node runtime loader", () => {
		// The Node runtime loader spans execution-driver.ts (facade) and its
		// extracted modules; canonical source is in @secure-exec/node.
		const nodeModulePaths = [
			"src/execution-driver.ts",
			"src/isolate-bootstrap.ts",
			"src/module-resolver.ts",
			"src/esm-compiler.ts",
			"src/bridge-setup.ts",
			"src/execution-lifecycle.ts",
		];
		const loaderSource = nodeModulePaths.map(readNodeSource).join("\n");
		expect(loaderSource).not.toMatch(/context\.eval\(\s*`/);
		expect(loaderSource).not.toContain(
			"${ISOLATE_GLOBAL_EXPOSURE_HELPER_SOURCE}",
		);
		expect(loaderSource).toContain(
			'getIsolateRuntimeSource("globalExposureHelpers")',
		);
		expect(loaderSource).toContain(
			'getIsolateRuntimeSource("setupDynamicImport")',
		);
		expect(loaderSource).toContain('getIsolateRuntimeSource("setupFsFacade")');
		expect(loaderSource).toContain(
			'getIsolateRuntimeSource("initCommonjsModuleGlobals")',
		);
	});

	it("keeps bridge/require setup loaders on static isolate-runtime sources", () => {
		// bridge-loader.ts canonical source is in @secure-exec/node
		const bridgeLoader = readFileSync(
			new URL("../../secure-exec-node/src/bridge-loader.ts", import.meta.url),
			"utf8",
		);
		// bridge-setup.ts canonical source is in @secure-exec/core
		const bridgeSetup = readFileSync(
			new URL("../../secure-exec-core/src/bridge-setup.ts", import.meta.url),
			"utf8",
		);
		// require-setup.ts canonical source is in @secure-exec/core
		const requireSetup = readFileSync(
			new URL("../../secure-exec-core/src/shared/require-setup.ts", import.meta.url),
			"utf8",
		);

		expect(bridgeLoader).not.toMatch(/return\s*`/);
		expect(bridgeSetup).not.toMatch(/return\s*`/);
		expect(requireSetup).not.toMatch(/return\s*`/);

		expect(bridgeLoader).toContain("getIsolateRuntimeSource");
		expect(bridgeSetup).toContain("getIsolateRuntimeSource");
		expect(requireSetup).toContain('getIsolateRuntimeSource("requireSetup")');
	});

	it("browser worker no longer injects fs module code via code strings", () => {
		// Canonical source is now in @secure-exec/browser.
		const workerSource = readBrowserSource("src/worker.ts");
		expect(workerSource).not.toContain("_fsModuleCode");
		expect(workerSource).toContain('getIsolateRuntimeSource("globalExposureHelpers")');
	});

	it("builds isolate runtime from src/inject entrypoints with shared common modules", () => {
		const buildScript = readFileSync(
			new URL("../../secure-exec-core/scripts/build-isolate-runtime.mjs", import.meta.url),
			"utf8",
		);
		expect(buildScript).toContain('path.join(process.cwd(), "isolate-runtime", "src")');
		expect(buildScript).toContain('path.join(runtimeSourceDir, "inject")');
		expect(buildScript).toContain("bundle: true");
	});
});
