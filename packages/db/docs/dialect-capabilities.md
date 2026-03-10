# Dialect Capabilities

Pluralscape supports two database backends: **PostgreSQL** (cloud/hosted) and **SQLite** (self-hosted/offline). Each dialect has different capabilities that affect schema design and query strategies.

## Capability Matrix

| Capability               | PostgreSQL | SQLite | Notes                                                             |
| ------------------------ | ---------- | ------ | ----------------------------------------------------------------- |
| Row-Level Security (RLS) | Yes        | No     | PG uses `set_config` session variables; SQLite uses WHERE clauses |
| Native JSONB             | Yes        | No     | SQLite stores JSON as TEXT with application-level parsing         |
| Array columns            | Yes        | No     | SQLite uses JSON arrays or junction tables                        |
| pgcrypto extension       | Yes        | No     | Defense-in-depth encryption at rest                               |
| Native enum types        | Yes        | No     | Both use varchar + CHECK constraints for portability              |
| Full-text search         | Yes        | No     | PG uses tsvector/tsquery; SQLite would need FTS5 extension        |

## Runtime Detection

```typescript
import { getDialect, getDialectCapabilities, isPostgreSQL, isSQLite } from "@pluralscape/db";

// Boolean checks
if (isPostgreSQL()) {
  /* PG-specific logic */
}
if (isSQLite()) {
  /* SQLite-specific logic */
}

// Full capability object
const caps = getDialectCapabilities(getDialect());
if (caps.rls) {
  /* enable RLS policies */
}
```

The dialect is determined by the `DB_DIALECT` environment variable (`"pg"` or `"sqlite"`).

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

### SQLite: Query-Layer Isolation

SQLite has no RLS. Isolation is enforced by adding WHERE conditions to every query.

```typescript
import { systemScope } from "@pluralscape/db";
import { members } from "@pluralscape/db/schema/sqlite";

// Add to every query's WHERE clause
const rows = await db.select().from(members).where(systemScope(members.systemId, currentSystemId));
```

## Schema Portability

Both dialects share the same logical schema. Differences are handled by dialect-specific column type helpers:

| Concept      | PostgreSQL                               | SQLite                                               |
| ------------ | ---------------------------------------- | ---------------------------------------------------- |
| Timestamps   | `timestamp(..., { withTimezone: true })` | Custom `sqliteTimestamp` (integer epoch ms)          |
| Binary data  | `bytea(...)`                             | Custom `sqliteBinary` (blob)                         |
| JSON columns | `jsonb(...)`                             | Custom `sqliteJson` (text with JSON parse/stringify) |
| Boolean      | `boolean(...)`                           | `integer(..., { mode: "boolean" })`                  |
