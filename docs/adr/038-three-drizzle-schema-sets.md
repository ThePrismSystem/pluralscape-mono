# ADR 038: Three Drizzle Schema Sets — Server-PG, Server-SQLite, Client-SQLite-Local

## Status

Accepted

## Context

Pluralscape has three logically distinct on-disk representations of the same domain entities:

1. **Server PG** (`packages/db/src/schema/pg/`) — production API server. Stores encrypted-blob + structural columns. Zero-knowledge: server never sees plaintext entity bodies.
2. **Server SQLite** (`packages/db/src/schema/sqlite/`) — divergent path for self-hosted deployments and the queue package. Same shape as PG: encrypted blobs.
3. **Client SQLite Cache** (`packages/db/src/schema/sqlite-client-cache/`) — mobile/web local cache. Stores decrypted plaintext columns projected from CRDT documents. The materializer writes here; the UI reads from here via TanStack Query subscriptions.

Before this ADR, sets 1 and 2 were Drizzle schemas with a parity gate; set 3 was hand-rolled in `packages/sync/src/materializer/entity-registry.ts`, violating the types-as-SoT principle established by the types-ltel epic.

The hand-rolled registry meant:

- Schema drift between domain types and cache columns went uncaught.
- DDL generation was hand-emitted instead of derived from a typed schema.
- `crdt-query-bridge` and any future TanStack Query subscriptions could not get typed access to local-cache rows.
- Three sources of truth for the same row shape (domain type + Drizzle PG + hand-rolled registry) with no enforced parity.

## Decision

All three schema sets are Drizzle schemas. They are differentiated by their encryption boundary and use a shared mixin layer for structural columns and indexes.

### Mixin layer

`packages/db/src/helpers/entity-shape.{sqlite,pg}.ts` provides:

- `entityIdentity<TIdBrand>()` — branded id PK + systemId FK to systems
- `encryptedPayload()` — encryptedData blob column (server-only)
- `serverEntityChecks(name, t)` — version + archivable consistency checks (server-only)

Both server schema sets (PG + SQLite) consume these mixins. The client cache schemas use `entityIdentity()` plus per-entity decrypted columns; cache tables intentionally declare zero indexes today (callers reach a cache row by id or via FTS5, both of which are already indexed by the materializer's DDL emitter).

### Encoding rules (domain field → cache column)

| Domain type                                | Cache column                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------- |
| `string`                                   | `text("col").notNull()`                                                         |
| `string \| null`                           | `text("col")`                                                                   |
| `boolean`                                  | `integer("col", { mode: "boolean" }).notNull()`                                 |
| `boolean \| null`                          | `integer("col", { mode: "boolean" })`                                           |
| `UnixMillis`                               | `sqliteTimestamp("col").notNull()` (via `timestamps()` mixin)                   |
| `BrandedId<T>`                             | `brandedId<T>("col")`                                                           |
| `readonly T[]` (any T)                     | `sqliteJsonOf<readonly T[]>("col").notNull()`                                   |
| `Record<K,V>` / object                     | `sqliteJsonOf<T>("col")`                                                        |
| Discriminated union with `archived: false` | `integer("archived", { mode: "boolean" }).notNull()` (cache stores both states) |
| String literal union (enum)                | `text("col").$type<MyEnum>()`                                                   |

`sqliteJsonOf<T>(name)` is a typed wrapper around the existing `sqliteJson` customType — same runtime behaviour, just adds `.$type<T>()` so `InferSelectModel` returns `T` instead of `unknown`.

### Three-way parity gate

`packages/db/src/__tests__/schema-three-way-parity.test.ts` asserts, covering every `SyncedEntityType`:

1. `pg.X.columns ≡ sqlite.X.columns` (existing — server-side parity)
2. Server-side structural columns ≡ cache-side structural columns (id, systemId, timestamps, archivable). Variant columns (encryptedData, version on server; decrypted fields on cache) are skipped via an explicit `skip` list.
3. Cache variant columns ↔ domain-type fields per the encoding rules table above.

Schema authors who deviate from the encoding rules must justify it explicitly with a code comment referencing this ADR.

### CRDT shapes are NOT in this regime

`CrdtMember`, `CrdtFrontingSession`, etc. in `packages/sync/src/schemas/` use `Automerge.Text` runtime types and JSON-encoded representations of complex fields. These are not derivable from domain types — the choice of which fields are `Automerge.Text` (collaborative-text) vs JSON-stringified (LWW-replaced) is a per-field judgment about merge semantics that cannot be derived mechanically.

CRDT shapes remain hand-maintained, and the parity story for CrdtMember ↔ Member is a separate concern out of scope for this ADR.

## Consequences

**Positive:**

- Types-as-SoT extended to the local cache. Drift between domain types and cache schema fails the parity gate at CI time.
- Drizzle introspection (`getTableConfig`) drives DDL generation; no hand-rolled DDL emitter to maintain.
- Reads from the cache (TanStack Query subscriptions, future query layer) get typed access via `InferSelectModel`.
- One mental model for "where do schemas come from": Drizzle.
- Mixin layer reduces duplication across the two server schema sets (~600 lines reclaimed in the PR2 refactor).

**Negative:**

- Three Drizzle schema sets to maintain. Each new entity needs three schema files (PG server, SQLite server, SQLite cache).
- Mitigated by: shared mixins reduce duplication; future codegen (db-mpbv) may eliminate hand-writing.

**Mitigation: future codegen.** Bean db-mpbv (M15) tracks the audit on whether the three sets can be generated from domain types. If yes, the hand-written schemas become emit targets and this ADR's hand-authoring posture relaxes.

## References

- Implementation: PR2 of the deferred-wiring closeout (bean db-jv3w under M9a)
- Spec: `docs/superpowers/specs/2026-04-27-deferred-wiring-closeout-design.md`
- Foundation: types-ltel epic (types-as-SoT principle), ADR-023 (encrypted-payload boundaries)
- Follow-up: db-mpbv (codegen exploration in M15)
