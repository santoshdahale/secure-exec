## Why

Our sandbox security posture is currently spread across runtime code, friction logs, and comparison research notes, which makes the trust boundary and threat model hard to audit. We need one canonical security model page in user-facing docs that states our isolate architecture, timing-attack stance, resource limits, and host hardening assumptions, with security requirements taking precedence over strict Node compatibility.

## What Changes

- Add a dedicated security model document at `docs/security-model.mdx`.
- Define the sandbox threat model and trust boundaries, including:
  - isolate-based multi-tenant architecture and why it is analogous to Cloudflare Workers and browser process/isolate models;
  - timing side-channel mitigation posture (default frozen timing mode, compatibility opt-out);
  - execution resource controls (`cpuTimeLimitMs` and isolate `memoryLimit`) and their security role;
  - explicit assumption that host execution is additionally sandboxed/hardened in serverless environments (for example AWS Lambda, Google Cloud Run, and equivalent hardened runtimes).
- Document the enforced runtime security contract and deployment assumptions.
- Add the new security model page to Mintlify navigation in `docs/docs.json`.
- Keep user-facing security-model language library-focused and implementation-agnostic (no direct backend dependency naming).
- Link this document from existing comparison/research notes so recommendations and the canonical security model stay aligned.
- Add governance requirements so future security-relevant runtime contract changes must update this document in the same change.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `compatibility-governance`: require maintaining a canonical sandbox security model document and keeping it synchronized with timing mitigation, resource-limit contracts, isolate architecture guidance, and host-hardening assumptions.

## Impact

- Affected docs: `docs/security-model.mdx` (new), `docs/docs.json` (navigation update), `docs-internal/research/comparison/cloudflare-workers-isolates.md`, and `docs-internal/friction/sandboxed-node.md` (cross-links/alignment notes as needed).
- Affected specs: `openspec/specs/compatibility-governance/spec.md` (new governance requirement for security model synchronization).
- No runtime code behavior changes are proposed in this change; this is a documentation and governance-contract update.
