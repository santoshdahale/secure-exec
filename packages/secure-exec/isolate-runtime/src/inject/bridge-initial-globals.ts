import { getRuntimeExposeMutableGlobal } from "../common/global-exposure";

const __runtimeExposeMutableGlobal = getRuntimeExposeMutableGlobal();

const __bridgeSetupConfig = globalThis.__runtimeBridgeSetupConfig ?? {};

const __initialCwd =
	typeof __bridgeSetupConfig.initialCwd === "string"
		? __bridgeSetupConfig.initialCwd
		: "/";
const __jsonPayloadLimitBytes =
	typeof __bridgeSetupConfig.jsonPayloadLimitBytes === "number" &&
	Number.isFinite(__bridgeSetupConfig.jsonPayloadLimitBytes)
		? Math.max(0, Math.floor(__bridgeSetupConfig.jsonPayloadLimitBytes))
		: 4 * 1024 * 1024;
const __payloadLimitErrorCode =
	typeof __bridgeSetupConfig.payloadLimitErrorCode === "string" &&
	__bridgeSetupConfig.payloadLimitErrorCode.length > 0
		? __bridgeSetupConfig.payloadLimitErrorCode
		: "ERR_SANDBOX_PAYLOAD_TOO_LARGE";

__runtimeExposeMutableGlobal("_moduleCache", {});
globalThis._moduleCache = globalThis._moduleCache ?? {};

const __moduleCache = globalThis._moduleCache;
if (__moduleCache) {
	__moduleCache["v8"] = {
		getHeapStatistics: function () {
			return {
				total_heap_size: 67108864,
				total_heap_size_executable: 1048576,
				total_physical_size: 67108864,
				total_available_size: 67108864,
				used_heap_size: 52428800,
				heap_size_limit: 134217728,
				malloced_memory: 8192,
				peak_malloced_memory: 16384,
				does_zap_garbage: 0,
				number_of_native_contexts: 1,
				number_of_detached_contexts: 0,
				external_memory: 0,
			};
		},
		getHeapSpaceStatistics: function () {
			return [];
		},
		getHeapCodeStatistics: function () {
			return {};
		},
		setFlagsFromString: function () {},
		serialize: function (value: unknown) {
			return Buffer.from(JSON.stringify(value));
		},
		deserialize: function (buffer: Buffer) {
			const text = buffer.toString();
			if (Buffer.byteLength(text, "utf8") > __jsonPayloadLimitBytes) {
				throw new Error(
					__payloadLimitErrorCode +
						": v8.deserialize exceeds " +
						String(__jsonPayloadLimitBytes) +
						" bytes",
				);
			}
			return JSON.parse(text);
		},
		cachedDataVersionTag: function () {
			return 0;
		},
	};
}

__runtimeExposeMutableGlobal("_pendingModules", {});
__runtimeExposeMutableGlobal("_currentModule", { dirname: __initialCwd });
