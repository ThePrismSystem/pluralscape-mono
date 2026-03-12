# Dialect API Guide

How to write API code that works across both PostgreSQL and SQLite without scattering dialect checks everywhere.

## Decision Tree

When writing code that touches the database, follow this flow:

```
Is the query a common access pattern (active fronters, pending requests, etc.)?
├── Yes → Use pgViews.* or sqliteViews.* (see views table below)
│
Does the code need tenant isolation?
├── PG → RLS handles it automatically (just set tenant context in middleware)
├── SQLite → Add systemScope() or accountScope() to WHERE clause
│
Does the code use JSON querying?
├── PG → Use Drizzle's jsonb operators or raw SQL with ->>, @>
├── SQLite → Use json_extract() via sql`` template
│
Does the code need full-text search?
├── PG → Use tsvector/tsquery at the API layer
├── SQLite → Use searchEntries() from schema/sqlite/search
│
Does the code need background job scheduling?
├── PG → Use BullMQ with Valkey
├── SQLite → Use the jobs table
│
Everything else?
└── Use Drizzle query builders — they generate correct SQL for both dialects
```

## Pattern 1: Dialect-Specific Service Injection

The recommended pattern for API routes is to inject the correct service at startup, not branch on dialect in every handler.

```typescript
// services/fronting.ts
import type { CurrentFronter } from "@pluralscape/db";

export interface FrontingService {
  getCurrentFronters(systemId: string): Promise<CurrentFronter[]>;
}

// services/fronting.pg.ts
import { pgViews } from "@pluralscape/db";

export function createPgFrontingService(db: PgDb): FrontingService {
  return {
    getCurrentFronters: (systemId) => pgViews.getCurrentFronters(db, systemId),
  };
}

// services/fronting.sqlite.ts
import { sqliteViews } from "@pluralscape/db";

export function createSqliteFrontingService(db: SqliteDb): FrontingService {
  return {
    // Wrap sync call in Promise.resolve for interface consistency
    getCurrentFronters: (systemId) => Promise.resolve(sqliteViews.getCurrentFronters(db, systemId)),
  };
}

// app.ts — one dialect check at startup
const frontingService = isPostgreSQL()
  ? createPgFrontingService(pgDb)
  : createSqliteFrontingService(sqliteDb);

// routes/fronting.ts — no dialect awareness needed
app.get("/fronters", async (c) => {
  const fronters = await frontingService.getCurrentFronters(c.get("systemId"));
  return c.json(fronters);
});
```

## Pattern 2: JSON Query Differences

JSON is stored differently between dialects. Use Drizzle's `sql` template for cross-dialect queries.

```typescript
// PG: jsonb with native operators
const pgQuery = sql`${table.metadata}->>'displayName'`;
const pgContains = sql`${table.tags} @> ${JSON.stringify(["important"])}::jsonb`;

// SQLite: text with json_extract
const sqliteQuery = sql`json_extract(${table.metadata}, '$.displayName')`;
const sqliteContains = sql`json_each.value = 'important'`;
```

When possible, avoid JSON queries entirely — use dedicated columns for frequently queried fields.

## Pattern 3: Timestamp Handling

Both `pgTimestamp` and `sqliteTimestamp` map to TypeScript `number` (Unix milliseconds). Application code treats timestamps identically:

```typescript
// Works on both dialects — timestamps are always numbers
const isExpired = row.expiresAt < Date.now();
const duration = Date.now() - row.startTime;
```

SQL-level timestamp operations differ:

```typescript
// PG: timestamptz arithmetic
const pgNow = sql`NOW()`;
const pgInterval = sql`${table.createdAt} + interval '1 hour'`;

// SQLite: integer arithmetic (epoch milliseconds)
const sqliteNow = sql`(strftime('%s', 'now') * 1000)`;
const sqliteInterval = sql`${table.createdAt} + 3600000`;
```

## Pattern 4: Enum Validation

Both dialects use `varchar`/`text` columns with CHECK constraints for enum validation. The same enum arrays power both:

```typescript
import { FRIEND_CONNECTION_STATUSES } from "@pluralscape/db";

// Schema definition (both dialects)
// PG:     check("status_check", enumCheck(t.status, FRIEND_CONNECTION_STATUSES))
// SQLite: check("status_check", enumCheck(t.status, FRIEND_CONNECTION_STATUSES))

// Application code — same validation regardless of dialect
if (!FRIEND_CONNECTION_STATUSES.includes(input.status)) {
  throw new Error("Invalid status");
}
```

## Pattern 5: Binary Data

Both `pgBinary` and `sqliteBinary` map to `Uint8Array`. Application code is identical:

```typescript
// Encrypt and store — works on both dialects
const encrypted = encrypt(plaintext); // returns Uint8Array
await db.insert(table).values({ encryptedData: encrypted });

// Read and decrypt — works on both dialects
const row = await db.select().from(table).where(...);
const plaintext = decrypt(row.encryptedData); // receives Uint8Array
```

## Anti-Patterns

### Don't: Scatter dialect checks in handlers

```typescript
// Bad — every handler has dialect branches
app.get("/fronters", async (c) => {
  if (isPostgreSQL()) {
    return c.json(await pgViews.getCurrentFronters(db, systemId));
  } else {
    return c.json(sqliteViews.getCurrentFronters(db, systemId));
  }
});
```

### Don't: Use raw SQL when Drizzle works

```typescript
// Bad — raw SQL that may not work across dialects
db.execute(sql`SELECT * FROM members WHERE system_id = ${systemId}`);

// Good — Drizzle generates correct SQL for both
db.select().from(members).where(eq(members.systemId, systemId));
```

### Don't: Check capabilities for schema differences

```typescript
// Bad — capabilities are for runtime feature gates, not schema selection
const caps = getDialectCapabilities(getDialect());
const timestampCol = caps.jsonb ? pgTimestamp("ts") : sqliteTimestamp("ts");

// Good — use the correct schema import for each dialect
// PG schema:    import { members } from "schema/pg/members"
// SQLite schema: import { members } from "schema/sqlite/members"
```

## SQLite Single-Tenant Isolation Model

SQLite is designed for the minimal self-hosted tier (ADR 012): one user, one system, one database file. Tenant isolation works fundamentally differently from PostgreSQL:

- **PG**: Row-Level Security (RLS) enforces isolation at the database layer. Even buggy application code cannot leak data across tenants.
- **SQLite**: Isolation is advisory. `systemScope()` and `accountScope()` add `WHERE system_id = ?` clauses, but nothing prevents a query from omitting them.

This is acceptable because the SQLite deployment model is inherently single-tenant — the database file belongs to one user. The WHERE clauses exist for code consistency with the PG path, not for security enforcement.

### FTS5 search_index

The `search_index` FTS5 virtual table has no `system_id` column. This is safe because:

- SQLite is single-tenant: all rows belong to the same system
- Adding `system_id` would waste storage and complicate queries for no security benefit

If SQLite is ever used in a multi-tenant context, the FTS5 table and all raw-SQL query paths would need tenant columns added. This is a documented architectural boundary, not a bug.

### Implications for contributors

- Do not rely on SQLite WHERE clauses for security — they are for API parity, not enforcement
- Do not add `system_id` to FTS5 unless the single-tenant assumption changes
- If building a multi-tenant SQLite deployment, audit every raw SQL path for tenant leakage

## Adding New Dialect-Specific Features

1. **Define the interface** in a shared types file
2. **Implement for each dialect** in separate files (`pg.ts` / `sqlite.ts` for views, `.pg.ts` / `.sqlite.ts` for services)
3. **Inject at startup** using `isPostgreSQL()` / `isSQLite()` — exactly once
4. **Add to `DialectCapabilities`** only if API code needs to feature-gate at runtime
5. **Document** in this guide and update the capability matrix
