# @pluralscape/db

Drizzle ORM schema, client factory, and query helpers for the Pluralscape database layer.

## Overview

This package defines the Pluralscape database schema as **three Drizzle schema sets**
(see [ADR-038](../../docs/adr/038-three-drizzle-schema-sets.md)):

- **`src/schema/pg/`** — hosted production server. PostgreSQL with encrypted blobs and
  structural columns. Zero-knowledge: the server never sees plaintext entity bodies.
- **`src/schema/sqlite/`** — self-hosted server and the queue package. Same
  encrypted-blob shape as PG, on SQLite via `better-sqlite3-multiple-ciphers`.
- **`src/schema/sqlite-client-cache/`** — mobile/web local cache. Stores plaintext
  columns projected from CRDT documents by the materializer; the UI reads from here via
  TanStack Query subscriptions.

The two server schema sets share a structural mixin layer in `src/helpers/entity-shape.{pg,sqlite}.ts`
(`entityIdentity<TIdBrand>()`, `encryptedPayload()`, `serverEntityChecks()`). The
client-cache schemas reuse `entityIdentity()` and use per-entity decrypted columns.

The schema covers all application domains — members, fronting sessions, journals,
groups, custom fields, communication, innerworld, blob metadata, notifications, key
rotation, import/export, audit logging, and more.

The three sets are exposed as sub-entry points: `./pg`, `./sqlite`, and
`./sqlite-client-cache`. The main entry point (`@pluralscape/db`) exports the client
factory, dialect and deployment detection utilities, RLS helpers, shared query helpers,
enumeration constants, and view types that are dialect-agnostic.

A three-way parity gate in `src/__tests__/schema-three-way-parity.test.ts` asserts that
PG and server-SQLite columns match, that server structural columns match the cache
schemas, and that cache decrypted columns track the canonical domain types per the
encoding rules in ADR-038.

Row-Level Security (RLS) is enforced on the PostgreSQL dialect. Every tenant table is
protected by policies keyed on `system_id`, `account_id`, or both — including sync
tables (`sync_docs`, `sync_events`, `sync_cursors`) and bidirectional friend
connections. The RLS migration is generated from `RLS_TABLE_POLICIES` in
`src/rls/policies.ts` and must be regenerated whenever tables are added, removed, or
change scope (see [Migrations](#migrations)).

Several high-volume tables use PostgreSQL range partitioning by timestamp —
`fronting_sessions` (by `start_time`), `messages` (by `timestamp`), and `audit_log`
(by `timestamp`). Partition creation and detachment are handled by the helpers in
`src/queries/partition-maintenance.ts` (`pgEnsureFuturePartitions`,
`pgDetachOldPartitions`); only `audit_log` partitions may be detached destructively.

## Key Exports

**Client factory** — `createDatabase(config)` and `createDatabaseFromEnv()` return a
`DatabaseClient` (either `PgDatabaseClient` or `SqliteDatabaseClient`). Both implement
`Closeable`.

**Dialect and deployment detection** — `getDialect()`, `isPostgreSQL()`, `isSQLite()`,
`getDialectCapabilities()`, `getDeploymentMode()`. Use these to branch on runtime
environment.

**RLS utilities** — `setTenantContext()`, `setSystemId()`, `setAccountId()`,
`accountScope()`, `systemScope()`, `enableRls()`, `applyAllRls()`,
`generateRlsStatements()`, `RLS_TABLE_POLICIES`. Used by the API to set per-request
tenant context before executing queries.

**Schema sub-entry points** — `@pluralscape/db/pg`, `@pluralscape/db/sqlite`, and
`@pluralscape/db/sqlite-client-cache` expose the full Drizzle table definitions for each
schema set. Import from these when constructing Drizzle queries directly.

**Column helpers** — `brandedId<B>()` (`src/columns/{pg,sqlite}.ts`) declares a
brand-typed id column so `InferSelectModel` returns the domain branded type rather than
a raw `string`. `pgTimestamp` / `sqliteTimestamp` are `UnixMillis` customTypes — server
PG stores `timestamptz` (string at the driver, `UnixMillis` at the model), SQLite
passes the integer through. Cache schemas additionally use `sqliteJsonOf<T>()` to give
JSON-encoded columns a typed shape.

**Query helpers** — maintenance queries for audit log cleanup (`pgCleanupAuditLog`,
`sqliteCleanupAuditLog`), orphaned tag cleanup, and device transfer cleanup.

**View types and helpers** — `pgViews`, `sqliteViews`, and mapped row types such as
`CurrentFronter`, `CurrentFronterWithDuration`, `MemberGroupSummary`,
`ActiveFriendConnection`, and others.

**Enumeration constants** — domain enums used across the API and schema: `ENTITY_TYPES`,
`AUDIT_EVENT_TYPES`, `FRONTING_REPORT_FORMATS`, `CHANNEL_TYPES`, `BLOB_PURPOSES`,
`IMPORT_SOURCES`, `ROTATION_STATES`, and many others.

**Pool and retention constants** — `PG_POOL_MAX_CONNECTIONS`, `PG_POOL_IDLE_TIMEOUT_SECONDS`,
`PG_POOL_CONNECT_TIMEOUT_SECONDS`, `PG_POOL_MAX_LIFETIME_SECONDS`,
`AUDIT_LOG_RETENTION_DAYS`.

**Test helpers** — `@pluralscape/db/test-helpers/pg-helpers` provides PGlite-backed
helpers for integration tests.

## Usage

Creating a client from explicit config:

```ts
import { createDatabase } from "@pluralscape/db";

const db = createDatabase({
  dialect: "pg",
  connectionString: process.env.DATABASE_URL!,
});
```

Creating a client from environment variables:

```ts
import { createDatabaseFromEnv } from "@pluralscape/db";

// Reads DIALECT, DATABASE_URL (pg) or DATABASE_PATH + DATABASE_KEY (sqlite)
const db = createDatabaseFromEnv();
```

Importing schema tables for Drizzle queries (PostgreSQL):

```ts
import { members, frontingSessions } from "@pluralscape/db/pg";
import { eq } from "drizzle-orm";

const rows = await db.drizzle.select().from(members).where(eq(members.systemId, systemId));
```

## Dependencies

**Internal**

- `@pluralscape/crypto` — encryption utilities used in SQLCipher key handling
- `@pluralscape/types` — shared TypeScript types including `Logger`, `BucketContentEntityType`

**External**

- `drizzle-orm` — query builder and schema definition
- `postgres` — PostgreSQL driver (postgres.js)
- `better-sqlite3-multiple-ciphers` — SQLite driver with SQLCipher encryption support

**Dev**

- `drizzle-kit` — migration generation CLI
- `@electric-sql/pglite` — in-process PostgreSQL for integration tests
- `tsx` — runs TypeScript scripts (migration generation, RLS application)

## Migrations

Migration files live in `migrations/pg/` and `migrations/sqlite/`. The
`sqlite-client-cache` schema does not produce a migration directory: the materializer
emits its DDL at runtime by introspecting the Drizzle schema (`getTableConfig`).

**Pre-release migration policy:** Pluralscape is pre-production, so generated migration
files are regularly nuked and regenerated from scratch. The Drizzle schema files under
`src/schema/pg/`, `src/schema/sqlite/`, and `src/schema/sqlite-client-cache/` are the
single source of truth for table shape — never treat a migration file as authoritative.
Changes to column names, constraints, or indexes land in the schema files first;
migrations are then regenerated to reflect them.

Generate the Drizzle schema migration after schema changes:

```bash
# PostgreSQL
pnpm --filter @pluralscape/db db:generate:pg

# SQLite
pnpm --filter @pluralscape/db db:generate:sqlite
```

**After any schema change that adds or removes tables, you must also regenerate the RLS
migration:**

```bash
pnpm --filter @pluralscape/db exec tsx scripts/generate-rls-migration.ts \
  > packages/db/migrations/pg/0001_rls_all_tables.sql
```

The RLS migration must always be `0001_rls_all_tables.sql` (after the `0000` Drizzle
schema migration). Update the filename reference in
`src/__tests__/rls-migrations.integration.test.ts` if the migration file changes.

To apply RLS to a live PostgreSQL database (for example from a deploy script), use:

```bash
pnpm --filter @pluralscape/db db:apply-rls
```

## Testing

Unit tests (no external infrastructure required):

```bash
pnpm vitest run --project db
```

Integration tests (requires a running PostgreSQL instance — PGlite is used automatically
in the test environment):

```bash
pnpm vitest run --project db-integration
```

Integration tests cover RLS policy enforcement, schema migrations, CRUD for all entity
types, audit log cleanup, and client factory behaviour across both dialects.
