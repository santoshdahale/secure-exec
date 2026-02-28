import { getRuntimeExposeCustomGlobal } from "../common/global-exposure";

const __runtimeExposeCustomGlobal = getRuntimeExposeCustomGlobal();

const __fsFacade: Record<string, unknown> = {
	readFile: globalThis._fsReadFile,
	writeFile: globalThis._fsWriteFile,
	readFileBinary: globalThis._fsReadFileBinary,
	writeFileBinary: globalThis._fsWriteFileBinary,
	readDir: globalThis._fsReadDir,
	mkdir: globalThis._fsMkdir,
	rmdir: globalThis._fsRmdir,
	exists: globalThis._fsExists,
	stat: globalThis._fsStat,
	unlink: globalThis._fsUnlink,
	rename: globalThis._fsRename,
};

__runtimeExposeCustomGlobal("_fs", __fsFacade);
