## ADDED Requirements

### Requirement: Maintain Canonical Sandboxed-Node Security Model Documentation
The project MUST maintain `docs/security-model.mdx` as the canonical security model for sandboxed-node runtime behavior and deployment assumptions.

#### Scenario: Security model document covers required security-contract topics
- **WHEN** the canonical security model document is authored or updated
- **THEN** it MUST describe isolate architecture, timing-side-channel posture, execution timeout and memory-limit controls, and host hardening assumptions for untrusted workloads

#### Scenario: User-facing security model language stays implementation-agnostic
- **WHEN** `docs/security-model.mdx` is authored or updated
- **THEN** it MUST describe the secure-exec contract without naming backend implementation dependencies directly

#### Scenario: Canonical security model page is discoverable in docs navigation
- **WHEN** `docs/security-model.mdx` is added or moved as the canonical security model page
- **THEN** `docs/docs.json` MUST include navigation for the page in the same change

#### Scenario: Cloudflare/browser alignment is described without over-claiming parity
- **WHEN** the canonical security model explains isolation architecture
- **THEN** it MUST describe how sandboxed-node uses the same isolate-style security primitives as Cloudflare Workers and modern browsers while explicitly distinguishing production hardening layers that are outside sandboxed-node runtime scope

### Requirement: Security-Contract Changes Must Synchronize Security Model Guidance
Changes to security-relevant runtime contracts MUST update canonical security model guidance in the same change.

#### Scenario: Runtime security contract changes trigger documentation updates
- **WHEN** a change modifies timing mitigation behavior/defaults, execution-timeout contract, memory-limit contract, or host trust-boundary assumptions
- **THEN** that change MUST update `docs/security-model.mdx` with the new contract details before completion

#### Scenario: Security-first compatibility trade-offs remain explicit
- **WHEN** a security mitigation intentionally diverges from default Node.js compatibility behavior
- **THEN** the canonical security model and compatibility/friction artifacts MUST explicitly document that security requirements take precedence and MUST describe any supported compatibility mode or opt-out path
