# @pluralscape/db

Drizzle ORM schema, client factory, and query helpers for the Pluralscape database layer.

## Overview

This package defines the complete Pluralscape database schema across two SQL dialects:
PostgreSQL for hosted deployments and SQLite (via `better-sqlite3-multiple-ciphers`) for
self-hosted deployments. The schema covers all application domains — members, fronting
sessions, journals, groups, custom fields, communication, innerworld, blob metadata,
notifications, key rotation, import/export, audit logging, and more — spanning 40+ tables.

Each dialect has its own Drizzle schema definition under `src/schema/pg/` and
`src/schema/sqlite/`, exported via the `./pg` and `./sqlite` sub-entry points. The main
entry point (`@pluralscape/db`) exports the client factory, dialect and deployment
detection utilities, RLS helpers, shared query helpers, enumeration constants, and view
types that are dialect-agnostic.

Row-Level Security (RLS) is enforced on the PostgreSQL dialect. Every table is protected
by tenant-scoped policies keyed on `system_id` and `account_id`. The RLS migration is
generated from the schema and must be regenerated whenever the schema changes (see
[Migrations](#migrations)).

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

**Schema sub-entry points** — `@pluralscape/db/pg` and `@pluralscape/db/sqlite` expose
the full Drizzle table definitions for each dialect. Import from these when constructing
Drizzle queries directly.

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

Migration files live in `migrations/pg/` and `migrations/sqlite/`.

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
