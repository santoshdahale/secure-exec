import { describe } from "vitest";
import { allowAllNetwork } from "../../src/index.js";
import type { NodeRuntimeOptions } from "../../src/runtime.js";
import { runNodeCryptoSuite } from "./node/crypto.js";
import { runNodeNetworkSuite } from "./node/network.js";
import { runNodePolyfillSuite } from "./node/polyfills.js";
import {
	runNodeSuite,
	type NodeSuiteContext,
} from "./node/runtime.js";

type RuntimeOptions = Omit<NodeRuntimeOptions, "systemDriver" | "runtimeDriverFactory">;
type NodeSharedSuite = (context: NodeSuiteContext) => void;

type DisposableRuntime = {
	dispose(): void;
	terminate(): Promise<void>;
};

const NODE_SUITES: NodeSharedSuite[] = [runNodeSuite, runNodeNetworkSuite, runNodeCryptoSuite, runNodePolyfillSuite];

async function importNodeEntrypoint() {
	const entrypointUrl = new URL("../../src/index.js", import.meta.url).href;
	return import(/* @vite-ignore */ entrypointUrl);
}

function createSuiteContext(): NodeSuiteContext {
	const runtimes = new Set<DisposableRuntime>();

	return {
		target: "node",
		async createRuntime(options: RuntimeOptions = {}) {
			const {
				NodeRuntime: NodeRuntimeClass,
				createNodeDriver,
				createNodeRuntimeDriverFactory,
			} = await importNodeEntrypoint();
			const runtime = new NodeRuntimeClass({
				...options,
				systemDriver: createNodeDriver({
					useDefaultNetwork: true,
					permissions: allowAllNetwork,
				}),
				runtimeDriverFactory: createNodeRuntimeDriverFactory(),
			});
			runtimes.add(runtime);
			return runtime;
		},
		async teardown(): Promise<void> {
			const runtimeList = Array.from(runtimes);
			runtimes.clear();

			for (const runtime of runtimeList) {
				try {
					await runtime.terminate();
				} catch {
					runtime.dispose();
				}
			}
		},
	};
}

describe("node runtime integration suite", () => {
	const context = createSuiteContext();
	for (const runSuite of NODE_SUITES) {
		runSuite(context);
	}
});
