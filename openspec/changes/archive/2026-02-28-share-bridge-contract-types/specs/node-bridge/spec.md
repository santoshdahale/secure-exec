## ADDED Requirements

### Requirement: Bridge Boundary Contracts SHALL Be Defined In A Canonical Shared Type Module
Bridge global keys and host/isolate boundary type contracts SHALL be defined in one canonical shared type module under `packages/secure-exec/src/shared/` and reused across host runtime setup and bridge modules.

#### Scenario: Host runtime injects bridge globals
- **WHEN** host runtime code wires bridge globals into the isolate
- **THEN** global key names MUST come from the canonical shared bridge contract constants rather than ad-hoc string literals

#### Scenario: Bridge module consumes host bridge globals
- **WHEN** a bridge module declares host-provided bridge globals
- **THEN** declaration shapes MUST reuse canonical shared contract types instead of redefining per-file ad-hoc reference interfaces

### Requirement: Bridge Global Key Registry SHALL Stay Consistent Across Runtime Layers
The bridge global key registry consumed by host runtime setup, bridge modules, and isolate runtime typing declarations SHALL remain consistent and covered by automated verification.

#### Scenario: Bridge key mismatch is introduced
- **WHEN** a change modifies host injection or bridge usage with a mismatched key name
- **THEN** automated verification MUST fail and report the key consistency violation

#### Scenario: New bridge global is introduced
- **WHEN** contributors add a new bridge global used by host/isolate boundary wiring
- **THEN** that global MUST be added to the canonical shared key registry and corresponding shared contract typing in the same change
