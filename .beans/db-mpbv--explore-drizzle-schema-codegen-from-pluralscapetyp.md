---
# db-mpbv
title: Explore Drizzle schema codegen from @pluralscape/types domain types
status: todo
type: task
priority: low
created_at: 2026-04-27T23:56:41Z
updated_at: 2026-04-27T23:56:41Z
parent: ps-9u4w
---

Investigate whether the three Drizzle schema sets — `schema/pg/`, `schema/sqlite/` (server self-host), and `schema/sqlite-local/` (client cache) — can be partially or fully generated from `@pluralscape/types` domain types instead of hand-written.

## Background

After the local-cache schema work (PR2 of the deferred-wiring closeout, see `docs/superpowers/specs/2026-04-27-deferred-wiring-closeout-design.md`), we will have ~30 hand-written sqlite-local schemas. They're mechanical projections of domain types:

- `string` → `text(...)`
- `string | null` → `text(...)` (no `.notNull()`)
- `boolean` → `integer(..., { mode: "boolean" })`
- `T[]` / object types → `sqliteJsonOf<T>(...)`
- `UnixMillis` → `sqliteTimestamp(...)`
- Branded IDs → `brandedId<T>(...)`
- FK relationships → `.references(...)` (derived from `Foo.fooId: FooId` patterns)

The mapping is mechanical enough to be candidate for codegen. A `pnpm db:gen` step could read domain types from `@pluralscape/types` and emit Drizzle schema files, dramatically reducing maintenance and eliminating the parity gate's reason to exist.

## Scope

- Audit which fields of which schemas are NOT mechanically derivable (likely: indexes, FTS columns, hot-path metadata, custom checks, JSON-encoding boundary decisions for fields whose runtime shape differs from canonical type).
- Evaluate generators: `drizzle-zod` (for runtime), `drizzle-kit` introspection (for migrations), or a custom AST-based generator using `ts-morph`.
- Decide whether to generate all three sets, only the cache, or none (manual-with-parity-gate is acceptable).
- ADR-worthy decision either way.

## Acceptance

- Audit doc summarising what's derivable / what's manual / what's hybrid.
- Recommendation: codegen, manual, or hybrid (with split criteria).
- If codegen recommended: prototype generating one entity's three schemas from a domain type and verify equivalence with hand-written.

## Related

- PR2 of M9a closeout (sqlite-local schema set + parity gate)
- ADR for the three-schema-set architecture (also part of that PR)
- types-ltel epic (types-as-SoT foundation)
