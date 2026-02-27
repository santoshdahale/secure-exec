## Context

`sandboxed-node` already enforces core runtime controls (capability-scoped drivers, configurable isolate memory limits, optional CPU execution budgets, and default timing mitigation), but the security narrative is fragmented across implementation code and comparison notes. The Cloudflare Workers security model provides a useful reference shape for communicating layered isolate security: isolate boundary, side-channel posture, runtime limits, and assumptions about outer process hardening.

This change is documentation-focused and must preserve the project rule that intentional Node compatibility deviations are explicit. It also needs to make trust assumptions unambiguous: isolate protections are necessary but not sufficient if the host process is not itself sandboxed in production.

## Goals / Non-Goals

**Goals:**
- Create a canonical user-facing security model page for sandboxed-node under `docs/`.
- Document isolate architecture in terms that map to Cloudflare Workers and browser isolation mental models.
- Document timing-attack mitigations and the security-first default posture.
- Document execution guardrails (`cpuTimeLimitMs`, `memoryLimit`) as part of DoS/containment posture.
- Document deployment assumption that host runtime is additionally hardened/sandboxed (for example serverless/container environments with strict controls).
- Add governance requirements so security-contract changes cannot land without corresponding security model updates.

**Non-Goals:**
- Introduce new runtime hardening features in this change.
- Claim parity with Cloudflare’s full production hardening stack (for example perf-counter Spectre detection or dynamic process isolation).
- Define provider-specific deployment runbooks for every platform.

## Decisions

### 1. Add a dedicated canonical docs page under `docs/`

Decision:
- Add `docs/security-model.mdx` as the single canonical narrative for runtime security posture and expose it in `docs/docs.json` navigation.

Rationale:
- Security assumptions are currently discoverable only by reading multiple files. A single canonical document lowers audit friction and reduces stale guidance risk.

Alternatives considered:
- Keep security notes distributed across friction and research docs only: rejected because those docs are change-log/comparison oriented, not a canonical contract.

### 2. Use “similar model, different depth” framing relative to Cloudflare Workers and browsers

Decision:
- Explicitly describe shared architectural primitives (V8 isolates, per-execution capability mediation, timing hardening concepts) while calling out where our model stops short of Cloudflare production-only layers.

Rationale:
- This keeps the document accurate and useful without over-claiming security properties.

Alternatives considered:
- Avoid Cloudflare/browsers comparison entirely: rejected because operators already use these models as intuition and the request requires this comparison.

### 3. Make trust-boundary assumptions explicit

Decision:
- State that sandboxed-node assumes a sufficiently hardened outer host environment (for example Lambda, Cloud Run, or equivalent hardened serverless/container runtime) for internet-facing untrusted workloads.

Rationale:
- Host hardening remains a required deployment assumption for internet-facing untrusted workloads.

Alternatives considered:
- Present isolate containment as self-sufficient: rejected as misleading for real-world threat modeling.

### 4. Govern doc synchronization via compatibility-governance requirement

Decision:
- Add a governance requirement requiring security model updates whenever timing mitigation defaults/behavior, timeout or memory limit contracts, or trust-boundary assumptions change, and require docs navigation updates when the canonical page location changes.

Rationale:
- This makes the doc part of the required delivery contract rather than optional follow-up.

Alternatives considered:
- Rely on reviewer convention without spec enforcement: rejected due repeated drift risk.

### 5. Keep public docs focused on secure-exec contract, not backend dependency internals

Decision:
- User-facing docs in `docs/` describe secure-exec behavior and guarantees without naming backend implementation dependencies.

Rationale:
- Public docs should present stable library contracts and avoid coupling to swap-able internal runtime packaging details.

Alternatives considered:
- Include dependency-level implementation details in public docs: rejected because it adds churn and distracts from the secure-exec contract surface.

## Risks / Trade-offs

- [Risk] The Cloudflare comparison could be read as a parity claim. -> Mitigation: include explicit “same primitives, not same production stack” wording.
- [Risk] Security model guidance can become stale as runtime options evolve. -> Mitigation: add spec-governed synchronization scenarios tied to contract changes.
- [Risk] Security-first framing may be interpreted as a universal override for all behavior differences. -> Mitigation: scope wording to security-relevant runtime constraints and require explicit documentation of compatibility trade-offs.
