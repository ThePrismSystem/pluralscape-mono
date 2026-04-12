# ADR 034: Import Core Extraction

## Status

Accepted

## Context

With PluralKit import joining Simply Plural import, both engines share identical orchestration logic: dependency-ordered collection walks, checkpoint-based resumption, error classification (fatal/recoverable/non-fatal), bounded warning buffers, and a persistence boundary (`Persister` interface). This logic currently lives entirely in `packages/import-sp/`.

## Decision

Extract the shared import engine into `packages/import-core/`. Refactor `import-sp` to depend on it. Build `import-pk` on top.

Rationale:

- Two concrete consumers exist now (SP and PK import), validating the abstraction boundary.
- The engine/mapper separation is already clean in `import-sp` — extraction is a mechanical move, not a redesign.
- Other third-party plural apps exist (Octocon, PluralNest, etc.) that could become future import sources. Establishing the shared engine now creates an easier path to adding them later without rebuilding orchestration each time.
- Avoids divergent copies of battle-tested checkpoint, resume, and error handling logic.

Alternatives rejected:

1. Copy-paste engine into `import-pk` — leads to drift, requires duplicate bug fixes.
2. Wait for a third import source — two consumers is sufficient to validate the abstraction, and delaying increases the cost of extraction as `import-sp` continues to evolve.

## Consequences

- Refactoring `import-sp` carries regression risk — mitigated by its comprehensive test suite (unit, integration, E2E).
- `import-core` becomes a shared dependency; breaking changes affect both import packages.
- Source-specific behaviours (SP's legacy bucket synthesis, SP's `supplyParentIds`) are handled via engine hooks rather than living in the core loop.
