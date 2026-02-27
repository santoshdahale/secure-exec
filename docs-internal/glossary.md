# Glossary

- **Isolate** — a V8 isolate. The unit of code execution and memory isolation. Each sandbox execution gets its own isolate.
- **Runtime** — the sandbox. The full `secure-exec` execution environment including the isolate, bridge, and resource controls.
- **Bridge** — the narrow layer between the isolate and the host that mediates all privileged operations. Untrusted code can only reach host capabilities through the bridge.
- **Driver** — a host-side capability provider (filesystem, network, process, env) that the bridge delegates to. Drivers are configured per-sandbox and enforce permission checks.
