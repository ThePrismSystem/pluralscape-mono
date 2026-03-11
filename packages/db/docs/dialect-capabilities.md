# Dialect Capabilities

Pluralscape supports two database backends: **PostgreSQL** (cloud/hosted) and **SQLite** (self-hosted/offline). Each dialect has different capabilities that affect schema design and query strategies.

## Capability Matrix

| Capability               | PostgreSQL                                                                  | SQLite                                | Notes                                                             |
| ------------------------ | --------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------- |
| Row-Level Security (RLS) | Yes                                                                         | No                                    | PG uses `set_config` session variables; SQLite uses WHERE clauses |
| Native JSONB             | Yes                                                                         | No                                    | SQLite stores JSON as TEXT with application-level parsing         |
| Array columns            | Yes                                                                         | No                                    | SQLite uses JSON arrays or junction tables                        |
| pgcrypto extension       | Yes                                                                         | No                                    | Defense-in-depth encryption at rest                               |
| Native enum types        | Yes                                                                         | No                                    | Both use varchar + CHECK constraints for portability              |
| Full-text search         | tsvector/tsquery (server-side)                                              | FTS5 virtual tables (client-side)     | Different APIs, same conceptual role                              |
| Background jobs          | BullMQ + Valkey (server-side)                                               | SQLite `jobs` table (client-side)     | See ADR 010                                                       |
| Views / query helpers    | `pgViews.*` (async, PgDatabase; test: PgliteDatabase / prod: node-postgres) | `sqliteViews.*` (sync, BetterSQLite3) | Identical function names, matching return types                   |

## Runtime Detection

Use `getDialect()` for the raw dialect string, boolean helpers for simple checks, or `getDialectCapabilities()` for the full capability object.

```typescript
import { getDialect, getDialectCapabilities, isPostgreSQL, isSQLite } from "@pluralscape/db";

// Boolean checks — use when you need a single yes/no branch
if (isPostgreSQL()) {
  /* PG-specific logic */
}
if (isSQLite()) {
  /* SQLite-specific logic */
}

// Full capability object — use when checking multiple capabilities
const caps = getDialectCapabilities(getDialect());
if (caps.rls) {
  /* enable RLS policies */
}
if (caps.fullTextSearch) {
  /* use server-side tsvector search */
}
```

The dialect is determined by the `DB_DIALECT` environment variable (`"pg"` or `"sqlite"`). If the variable is missing or invalid, `getDialect()` throws immediately — fail-fast by design.

### When to use which

| Scenario                                                     | Use                                        |
| ------------------------------------------------------------ | ------------------------------------------ |
| Single-feature gate (e.g., "does this dialect support RLS?") | `getDialectCapabilities(getDialect()).rls` |
| Choosing between two code paths based on dialect             | `isPostgreSQL()` / `isSQLite()`            |
| Passing dialect to a factory or constructor                  | `getDialect()`                             |

Avoid scattering `isPostgreSQL()` checks throughout API route handlers. Instead, use the patterns described in the [Dialect API Guide](./dialect-api-guide.md).

## Tenant Isolation

### PostgreSQL: Row-Level Security

RLS policies enforce tenant isolation at the database level. Every table with a `system_id` or `account_id` column has an RLS policy that restricts visibility to the current tenant context.

```typescript
import { setTenantContext } from "@pluralscape/db";

// Within a transaction, set the tenant context
await setTenantContext(db, { systemId: "...", accountId: "..." });
// All subsequent queries in this transaction are scoped automatically
```

Session variables are transaction-scoped (`set_config` with `true` for is_local), so they reset when the transaction ends.

RLS scope types:

| Scope           | Session variable         | Tables                                                         |
| --------------- | ------------------------ | -------------------------------------------------------------- |
| `"system"`      | `app.current_system_id`  | Most data tables (members, fronting, groups, etc.)             |
| `"account"`     | `app.current_account_id` | Account-level tables (purge requests)                          |
| `"dual"`        | Both                     | Tables scoped to both (API keys, import jobs, export requests) |
| `"system-pk"`   | `app.current_system_id`  | Tables using system_id as primary key                          |
| `"account-pk"`  | `app.current_account_id` | Tables using account_id as primary key                         |
| `"join-system"` | `app.current_system_id`  | Join tables referencing system-scoped parents                  |

The full mapping is in `RLS_TABLE_POLICIES` — see `src/rls/policies.ts`.

### SQLite: Query-Layer Isolation

SQLite has no RLS. Isolation is enforced by adding WHERE conditions to every query.

```typescript
import { systemScope } from "@pluralscape/db";
import { members } from "@pluralscape/db/schema/sqlite";

// Add to every query's WHERE clause
const rows = await db.select().from(members).where(systemScope(members.systemId, currentSystemId));
```

The `systemScope()` and `accountScope()` helpers produce Drizzle `eq()` conditions that match the RLS policy scoping.

## Schema Portability

Both dialects share the same logical schema. Differences are handled by dialect-specific column type helpers:

| Concept      | PostgreSQL                            | SQLite                               |
| ------------ | ------------------------------------- | ------------------------------------ |
| Timestamps   | `pgTimestamp` (timestamptz -> number) | `sqliteTimestamp` (integer epoch ms) |
| Binary data  | `pgBinary` (bytea -> Uint8Array)      | `sqliteBinary` (blob -> Uint8Array)  |
| JSON columns | `pgJsonb` (jsonb -> parsed object)    | `sqliteJson` (text -> parsed object) |
| Boolean      | `boolean(...)`                        | `integer(..., { mode: "boolean" })`  |

All custom column types map to/from the same TypeScript types (number for timestamps, Uint8Array for binary, parsed objects for JSON), so application code is dialect-agnostic.

## Views and Query Helpers

Instead of database-level views, Pluralscape uses **query builder functions** that encapsulate common access patterns. Both dialects expose identical function signatures with shared return types.

```typescript
import { pgViews, sqliteViews } from "@pluralscape/db";
import type { CurrentFronter, ActiveApiKey } from "@pluralscape/db";

// PG (async — PgliteDatabase)
const fronters: CurrentFronter[] = await pgViews.getCurrentFronters(db, systemId);

// SQLite (sync — BetterSQLite3Database)
const fronters: CurrentFronter[] = sqliteViews.getCurrentFronters(db, systemId);
```

Available query helpers:

| Function                         | Scoping | Filter logic                                                                       |
| -------------------------------- | ------- | ---------------------------------------------------------------------------------- |
| `getCurrentFronters`             | system  | `end_time IS NULL`                                                                 |
| `getCurrentFrontersWithDuration` | system  | `end_time IS NULL` + computed duration (ms)                                        |
| `getActiveApiKeys`               | account | `revoked_at IS NULL`                                                               |
| `getPendingFriendRequests`       | system  | `status = 'pending'`                                                               |
| `getPendingWebhookRetries`       | system  | `status = 'failed'` AND `attempt_count < maxAttempts` AND `next_retry_at <= NOW()` |
| `getUnconfirmedAcknowledgements` | system  | `confirmed = false`                                                                |
| `getMemberGroupSummary`          | system  | GROUP BY with `count(*)`                                                           |
| `getActiveFriendConnections`     | system  | `status = 'accepted'`                                                              |
| `getActiveDeviceTokens`          | account | `revoked_at IS NULL`                                                               |
| `getCurrentFrontingComments`     | system  | JOIN on active sessions (`end_time IS NULL`)                                       |
| `getActiveDeviceTransfers`       | account | `status = 'pending'` AND `expires_at > NOW()`                                      |
| `getStructureCrossLinks`         | system  | UNION ALL of 3 link tables                                                         |

Duration calculation differs by dialect:

- **PG**: `(EXTRACT(EPOCH FROM (NOW() - start_time)) * 1000)::bigint`
- **SQLite**: `(strftime('%s', 'now') * 1000) - start_time`

Both return milliseconds as an integer.

## SQLite-Only Features

Some features exist only on SQLite because they serve the offline/client-side use case:

### FTS5 Search Index

Client-side full-text search uses an FTS5 virtual table. Drizzle has no FTS5 support, so this uses raw SQL with typed wrappers.

```typescript
import {
  createSearchIndex,
  insertSearchEntry,
  searchEntries,
} from "@pluralscape/db/schema/sqlite/search";

createSearchIndex(db);
insertSearchEntry(db, {
  entityType: "member",
  entityId: "...",
  title: "Name",
  content: "Bio text",
});
const results = searchEntries(db, "search query", { entityType: "member", limit: 20 });
```

On PG, full-text search would use tsvector/tsquery at the API layer (not yet implemented).

### Job Queue Table

SQLite uses a `jobs` table for background task processing (the only table with an autoincrement integer PK). On PG, the API uses BullMQ + Valkey instead.

```typescript
import { jobs } from "@pluralscape/db/schema/sqlite/jobs";

// Queue a job
db.insert(jobs)
  .values({
    type: "sync-push",
    payload: { entityId: "..." },
    status: "pending",
  })
  .run();
```
