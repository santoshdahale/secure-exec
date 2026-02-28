## MODIFIED Requirements

### Requirement: Isolate-Executed Bootstrap Sources MUST Be Static TypeScript Modules
Any source code evaluated inside the isolate for runtime/bootstrap setup MUST originate from static files under `packages/secure-exec/isolate-runtime/src/` and MUST be tracked as normal TypeScript source with inject entrypoints rooted in `packages/secure-exec/isolate-runtime/src/inject/`.

#### Scenario: Runtime injects require and bridge bootstrap code
- **WHEN** secure-exec prepares isolate bootstrap code for `require` setup, bridge setup, or related runtime helpers
- **THEN** the injected source MUST come from static isolate-runtime module files rather than ad-hoc inline source assembly in host runtime files

#### Scenario: New isolate injection path is introduced
- **WHEN** a change adds a new host-to-isolate code injection path
- **THEN** the injected code MUST be added as a static `.ts` file under `packages/secure-exec/isolate-runtime/src/inject/` in the same change

#### Scenario: Existing template-generated bootstrap helper is migrated
- **WHEN** secure-exec migrates helpers such as `getRequireSetupCode`, `getBridgeWithConfig`, or `createInitialBridgeGlobalsCode`
- **THEN** the executable isolate source for those helpers MUST come from static isolate-runtime files rather than template-literal code builders in host runtime modules

### Requirement: Isolate-Runtime Compilation MUST Be a Build Prerequisite
The secure-exec package build MUST execute isolate-runtime compilation before producing final runtime artifacts, and build orchestration MUST treat isolate-runtime compilation and isolate-runtime typecheck as explicit validation dependencies.

#### Scenario: Package build runs with clean outputs
- **WHEN** `packages/secure-exec` is built from a clean workspace
- **THEN** the build MUST run a dedicated isolate-runtime compile step before final package build output is produced

#### Scenario: Turbo build graph resolves secure-exec build dependencies
- **WHEN** turbo runs `build` for secure-exec
- **THEN** the task graph MUST enforce `build:isolate-runtime` as a dependency of secure-exec `build`

#### Scenario: Isolate runtime source typing regresses
- **WHEN** isolate-runtime inject/common source introduces type errors against the declared runtime global contracts
- **THEN** repository type validation MUST fail before changes are considered complete
