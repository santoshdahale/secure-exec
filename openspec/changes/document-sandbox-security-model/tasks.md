## 1. Canonical Security Model Document

- [x] 1.1 Create `docs/security-model.mdx` with sections for threat model, trust boundaries, isolate architecture, timing attacks, and residual risks.
- [x] 1.2 Document timing-side-channel posture, including default `timingMitigation: "freeze"`, compatibility mode (`"off"`), and security-over-compatibility rationale.
- [x] 1.3 Document execution resource controls (`cpuTimeLimitMs` timeout behavior and `memoryLimit` isolate cap) and their operational/security implications.
- [x] 1.4 Document explicit deployment assumption that host processes are already sandboxed/hardened (for example Lambda, Cloud Run, or equivalent hardened serverless/container environments).
- [x] 1.5 Add `security-model` to `docs/docs.json` navigation so the page is discoverable.
- [x] 1.6 Keep `docs/security-model.mdx` library-focused and remove direct backend dependency naming from user-facing wording.

## 2. Cross-Document Alignment

- [x] 2.1 Update `docs-internal/research/comparison/cloudflare-workers-isolates.md` to reference the canonical security model doc and align terminology.
- [x] 2.2 Update `docs-internal/friction/sandboxed-node.md` with any compatibility/security notes needed to keep governance artifacts aligned.

## 3. Governance And Quality Checks

- [x] 3.1 Ensure `openspec/changes/document-sandbox-security-model/specs/compatibility-governance/spec.md` scenarios are fully reflected by documentation content and links.
- [x] 3.2 Run targeted formatting/lint checks for touched Markdown files (or repository-standard doc checks) and record any follow-up issues.
  - `2026-02-27`: `pnpm exec biome check <touched docs files>` reported all provided docs paths are ignored by current Biome configuration (no files processed).
  - `2026-02-27`: `pnpm lint` failed on pre-existing repository lint issues outside this docs change (for example large generated file size and pre-existing style/import diagnostics under `packages/sandboxed-node`).
