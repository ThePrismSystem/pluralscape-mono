---
# types-cfp6
title: "CI job: pnpm types:check-sot"
status: todo
type: task
priority: high
created_at: 2026-04-21T13:56:03Z
updated_at: 2026-04-21T13:56:25Z
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

- [ ] Add pnpm script types:check-sot to root package.json that runs typecheck on packages/types + packages/validation + packages/db + the OpenAPI reconcile script, and reports a unified success/failure
- [ ] Extend scripts/reconcile-openapi.ts (or add a sibling scripts/check-types-sot.ts) to also verify that OpenAPI-derived response types for each entity match <Entity> / <Entity>ServerMetadata
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
