# Secure Exec

**Secure Node.js Execution Without a Sandbox**

A lightweight library for secure Node.js execution. No containers, no VMs — just npm-compatible sandboxing out of the box. Powered by the same tech as Cloudflare Workers.

```
npm install secure-exec
```

## Give your AI agent secure code execution

Expose secure-exec as a tool with the Vercel AI SDK. Your agent can execute arbitrary code without risking your infrastructure.

```typescript
import { generateText, tool } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { NodeRuntime, createNodeDriver, createNodeRuntimeDriverFactory } from "secure-exec";
import { z } from "zod";

const runtime = new NodeRuntime({
  systemDriver: createNodeDriver({ permissions: { fs: true, network: true } }),
  runtimeDriverFactory: createNodeRuntimeDriverFactory(),
  memoryLimit: 64,
  cpuTimeLimitMs: 5000,
});

const result = await generateText({
  model: anthropic("claude-sonnet-4-20250514"),
  tools: {
    execute: tool({
      description: "Run JavaScript in a secure sandbox",
      parameters: z.object({ code: z.string() }),
      execute: async ({ code }) => {
        const logs: string[] = [];
        const res = await runtime.exec(code, {
          onStdio: (e) => logs.push(e.message),
        });
        return { exitCode: res.code, output: logs.join("\n") };
      },
    }),
  },
  prompt: "Calculate the first 20 fibonacci numbers",
});
```

## Why Secure Exec

Give your AI agent the ability to write and run code safely.

- **No infrastructure required** — No Docker daemon, no hypervisor, no orchestrator. Runs anywhere Node.js, Bun, or an HTML5 browser runs. Deploy to Lambda, a VPS, or a static site — your existing deployment works.
- **Node.js & npm compatibility** — fs, child_process, http, dns, process, os — bridged to real host capabilities, not stubbed. Run Express, Hono, Next.js, and any npm package. [Compatibility matrix →](https://secure-exec.dev/docs/node-compatability)
- **Built for AI agents** — Give your AI agent the ability to write and run code safely. Works with the Vercel AI SDK, LangChain, and any tool-use framework.
- **Deny-by-default permissions** — Filesystem, network, child processes, and env vars are all blocked unless explicitly allowed. Permissions are composable functions — grant read but not write, allow fetch but block spawn.
- **Configurable resource limits** — CPU time budgets and memory caps. Runaway code is terminated deterministically with exit code 124 — no OOM crashes, no infinite loops, no host exhaustion.
- **Powered by V8 isolates** — The same isolation primitive behind Cloudflare Workers for Platforms and every browser tab. Battle-tested at scale by the infrastructure you already trust.

## Benchmarks

V8 isolates vs. sandboxes.

### Cold start

| Percentile | Secure Exec | Fastest sandbox |
|------------|-------------|-----------------|
| p50        | 16.2 ms     | 440 ms          |
| p95        | 17.9 ms     | 950 ms          |
| p99        | 17.9 ms     | 3,150 ms        |

**What's measured:** Time from requesting an execution to first code running. Secure Exec spins up a V8 isolate inside the host process — no container, no VM, no network hop. Sandbox baseline: [e2b](https://www.computesdk.com/benchmarks/), the fastest provider on ComputeSDK as of March 18, 2026. Secure Exec numbers: median of 10,000 runs (100 iterations × 100 samples) on Intel i7-12700KF.

### Memory per instance

| Runtime                  | Memory    |
|--------------------------|-----------|
| Secure Exec              | ~3.4 MB   |
| Sandbox provider minimum | ~256 MB   |

**75x smaller.** V8 isolates share the host process and its V8 engine. Each additional execution only adds its own heap and stack. On a 1 GB server, you can run ~210 concurrent Secure Exec executions vs. ~4 sandboxes.

### Cost per execution-second

| Hardware     | Secure Exec      | vs. cheapest sandbox ($0.000625/s) |
|--------------|------------------|------------------------------------|
| AWS ARM      | $0.000011/s      | 56x cheaper                        |
| AWS x86      | $0.000014/s      | 45x cheaper                        |
| Hetzner ARM  | $0.0000016/s     | 380x cheaper                       |
| Hetzner x86  | $0.0000027/s     | 232x cheaper                       |

Each execution uses ~3.4 MB instead of a 256 MB container minimum, and you run on your own hardware. Sandbox baseline: Cloudflare Containers, billed at $0.0000025/GiB·s with 256 MB minimum.

## Secure Exec vs. Sandboxes

Same isolation guarantees, without the infrastructure overhead.

**Secure Exec:**
- ✓ Native V8 performance
- ✓ Granular deny-by-default permissions
- ✓ Just npm install — no vendor account
- ✓ No API keys to manage
- ✓ Run on any cloud or hardware
- ✓ No egress fees

**Sandbox:**
- ✓ Native container performance
- ✗ Coarse-grained permissions
- ✗ Vendor account required
- ✗ API keys to manage
- ✗ Hardware lock-in
- ✗ Per-GB egress fees

[Full comparison →](https://secure-exec.dev/docs/sandbox-vs-secure-exec)

## FAQ

<details>
<summary>How does it work?</summary>

Secure Exec runs untrusted code inside [V8 isolates](https://v8.dev/docs/embed) — the same isolation primitive that powers every Chromium tab and Cloudflare Workers. Each execution gets its own heap, its own globals, and a deny-by-default permission boundary. There is no container, no VM, and no Docker daemon — just fast, lightweight isolation using battle-tested web technology. [Architecture →](https://secure-exec.dev/docs/sdk-overview)
</details>

<details>
<summary>Does this require Docker, nested virtualization, or a hypervisor?</summary>

No. Secure Exec is a pure npm package — `npm install secure-exec` is all you need. It has zero infrastructure dependencies: no Docker daemon, no hypervisor, no orchestrator, no sidecar. It runs anywhere Node.js or Bun runs.
</details>

<details>
<summary>Can it run in serverless environments?</summary>

We are actively validating serverless platforms, but Secure Exec should work everywhere that provides a standard Node.js-like runtime. This includes Vercel Fluid Compute, AWS Lambda, and Google Cloud Run. Cloudflare Workers is not supported because it does not expose the V8 APIs that Secure Exec relies on.
</details>

<details>
<summary>When should I use a sandbox vs. Secure Exec?</summary>

Use **Secure Exec** when you need fast, lightweight code execution — AI tool calls, code evaluation, user-submitted scripts — without provisioning infrastructure. Use a **sandbox** (e2b, Modal, Daytona) when you need a full operating-system environment with persistent disk, root access, or GPU passthrough. [Full comparison →](https://secure-exec.dev/docs/sandbox-vs-secure-exec)
</details>

<details>
<summary>Can I run npm install in Secure Exec to dynamically install modules?</summary>

Yes. Secure Exec supports dynamic module installation via npm inside the execution environment.
</details>

<details>
<summary>Can I use it to run dev servers like Express, Hono, or Next.js?</summary>

Yes. Secure Exec bridges Node.js APIs including http, net, and child_process, so frameworks like Express, Hono, and Next.js work out of the box.
</details>

<details>
<summary>Can it be used for long-running tasks?</summary>

Yes. For orchestrating stateful, long-running processes efficiently, we recommend pairing Secure Exec with [Rivet Actors](https://rivet.dev/docs/actors).
</details>

<details>
<summary>What are common use cases?</summary>

- AI agent code evaluation and tool use
- User-facing dev servers (Express, Hono, Next.js)
- MCP tool-code execution
- Sandboxed plugin / extension systems
- Interactive coding playgrounds
</details>

<details>
<summary>Does this have Node.js compatibility?</summary>

Yes. Most Node.js core modules work — including fs, child_process, http, dns, process, and os. These are bridged to real host capabilities, not stubbed. [Compatibility matrix →](https://secure-exec.dev/docs/node-compatability)
</details>

<details>
<summary>Does this have access to a full operating system?</summary>

Yes. Secure Exec includes a virtual kernel with a system bridge that supports a granular permission model. Filesystem, network, child processes, and environment variables are all available — gated behind deny-by-default permissions.
</details>

<details>
<summary>How does Secure Exec compare to WASM-based JavaScript runtimes like QuickJS?</summary>

WASM-based runtimes like [QuickJS](https://bellard.org/quickjs/) (via quickjs-emscripten) compile a separate JS engine to WebAssembly, which means your code runs through an interpreter inside WASM — not native V8. Secure Exec uses native V8 isolates directly, so you get the same JIT-compiled performance as JavaScript running on the host. No interpretation overhead, no WASM translation layer, and full Node.js API compatibility.
</details>

## Links

- [Documentation](https://secure-exec.dev/docs)
- [Changelog](https://github.com/rivet-dev/secure-exec/releases)
- [Discord](https://rivet.dev/discord)
- [GitHub](https://github.com/rivet-dev/secure-exec)

## License

Apache-2.0
