import { setGlobalValue } from "../common/global-access";

const __timingConfig = globalThis.__runtimeTimingMitigationConfig ?? {};

const __frozenTimeMs =
	typeof __timingConfig.frozenTimeMs === "number" &&
	Number.isFinite(__timingConfig.frozenTimeMs)
		? __timingConfig.frozenTimeMs
		: Date.now();
const __frozenDateNow = () => __frozenTimeMs;

try {
	Object.defineProperty(Date, "now", {
		value: __frozenDateNow,
		configurable: true,
		writable: true,
	});
} catch {
	Date.now = __frozenDateNow;
}

const __frozenPerformanceNow = () => 0;
const __performance = globalThis.performance;
if (typeof __performance !== "undefined" && __performance !== null) {
	try {
		Object.defineProperty(__performance, "now", {
			value: __frozenPerformanceNow,
			configurable: true,
			writable: true,
		});
	} catch {
		try {
			Object.assign(__performance, { now: __frozenPerformanceNow });
		} catch {}
	}
} else {
	setGlobalValue("performance", {
		now: __frozenPerformanceNow,
	});
}

if (!Reflect.deleteProperty(globalThis, "SharedArrayBuffer")) {
	setGlobalValue("SharedArrayBuffer", undefined);
}
