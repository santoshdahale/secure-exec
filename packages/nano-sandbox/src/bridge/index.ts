// Bridge module entry point
// This file is compiled to a single JS bundle that gets injected into the isolate
//
// Note: Only fs is currently used from the bridge. Other modules (os, zlib) now use
// node-stdlib-browser polyfills for better compatibility. Network, child_process,
// module, and process polyfills are generated at runtime by node-process/*.

import fs from "./fs.js";

// Export fs as the main bridge module
export { fs };

// Make fs available as the default export for convenience
export default fs;
