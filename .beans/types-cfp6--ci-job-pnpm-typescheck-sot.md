---
# types-cfp6
title: "CI job: pnpm types:check-sot"
status: completed
type: task
priority: high
created_at: 2026-04-21T13:56:03Z
updated_at: 2026-04-24T19:18:53Z
parent: types-ltel
blocked_by:
  - types-f62m
  - db-j1nv
  - types-p2b0
---

Add a single pnpm script and CI step that runs all three types-SoT parity gates. Drift anywhere fails CI.

## Context

Three parity mechanisms land across sibling tasks:

1. Drizzle-to-types structural-equality integration tests (db-j1nv)
2. Zod-to-types z.infer equality assertions (types-p2b0)
3. OpenAPI-to-types structural check (extension of existing scripts/reconcile-openapi.ts)

This task ties them into a single gated pipeline so the SoT contract becomes a first-class CI check rather than three separate jobs that could be individually missed.

## Scope

- [x] Add pnpm script types:check-sot to root package.json that runs typecheck on packages/types + packages/validation + packages/db + the OpenAPI reconcile script, and reports a unified success/failure
- [x] Extend scripts/reconcile-openapi.ts (or add a sibling scripts/check-types-sot.ts) to also verify that OpenAPI-derived response types for each entity match <Entity> / <Entity>ServerMetadata
- [ ] Add a CI step in .github/workflows/ci.yml running pnpm types:check-sot after the existing typecheck step
- [ ] Document the command in CLAUDE.md under the Commands table

## Out of scope

- The parity tests themselves (sibling tasks)
- Other ADR updates (sibling ADR-023 refresh)

## Acceptance

- pnpm types:check-sot exits 0 on a clean main
- Deliberately breaking a type (e.g. renaming a field in packages/types) causes the command to exit non-zero
- CI fails on the same drift

## Blocked-by

- types-f62m (publish pairs)
- db-j1nv (Drizzle parity tests)
- types-p2b0 (Zod parity assertions)

## Priority

High — gates the rest of the SoT enforcement.

## Phase 1 pilot progress (2026-04-22)

`pnpm types:check-sot` now runs four sequential steps:

1. typecheck @pluralscape/types
2. typecheck Drizzle parity tests (@pluralscape/db)
3. typecheck Zod parity tests (@pluralscape/validation)
4. typecheck OpenAPI-Wire parity

All four green on clean main; gate bites on each when drift is introduced (verified Task 18). Not yet wired to `.github/workflows/ci.yml` as a required blocking check — Phase 4 (lock-in) flips it to blocking after fleet coverage reaches 100%.

Remaining: Phase 4 CI wiring. No more code changes to the orchestrator expected until fleet completeness drives additions.

## Progress 2026-04-24

Script + OpenAPI parity step landed:

- scripts/check-types-sot.ts runs 4 typecheck steps (types, db parity, validation parity, openapi-wire-parity)
- package.json script pnpm types:check-sot wired
- scripts/openapi-wire-parity.type-test.ts covers all 20 entity wire shapes via split-form encrypted parity

Remaining:

- [x] Wire pnpm types:check-sot as a dedicated step in .github/workflows/ci.yml (typecheck job, runs after pnpm typecheck in the same job to share the setup)
- [x] Document pnpm types:check-sot in CLAUDE.md Commands table

## Summary of Changes

- `.github/workflows/ci.yml`: added "Types SoT parity gate" step in the `typecheck` job, runs `pnpm types:check-sot` after `pnpm typecheck`.
- `CLAUDE.md`: Commands table row added for `pnpm types:check-sot`.

Script + OpenAPI parity step (landed 2026-04-22) unchanged. Gate now blocking on every PR.
