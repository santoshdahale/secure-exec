// Bridge compilation
export { getRawBridgeCode, getBridgeAttachCode } from "./bridge-loader.js";

// Stdlib polyfill bundling
export {
	bundlePolyfill,
	getAvailableStdlib,
	hasPolyfill,
	prebundleAllPolyfills,
} from "./polyfills.js";

// Node execution driver
export { NodeExecutionDriver } from "./execution-driver.js";
export type { NodeExecutionDriverOptions } from "./isolate-bootstrap.js";

// Node system driver
export {
	createDefaultNetworkAdapter,
	createNodeDriver,
	createNodeRuntimeDriverFactory,
	NodeFileSystem,
	filterEnv,
	isPrivateIp,
} from "./driver.js";
export type {
	NodeDriverOptions,
	NodeRuntimeDriverFactoryOptions,
} from "./driver.js";

// Module access filesystem
export { ModuleAccessFileSystem } from "./module-access.js";
export type { ModuleAccessOptions } from "./module-access.js";

// Bridge handlers
export {
	emitConsoleEvent,
	stripDangerousEnv,
	createProcessConfigForExecution,
} from "./bridge-handlers.js";

// Timeout utilities (re-exported from core)
export {
	TIMEOUT_EXIT_CODE,
	TIMEOUT_ERROR_MESSAGE,
} from "@secure-exec/core";
