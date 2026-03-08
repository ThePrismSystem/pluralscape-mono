---
# db-9f6f
title: Drizzle project setup
status: todo
type: task
priority: critical
created_at: 2026-03-08T13:32:40Z
updated_at: 2026-03-08T14:21:32Z
parent: db-2je4
blocking:
  - db-i2gl
  - db-82q2
  - db-puza
  - db-tu5g
  - db-7er7
  - db-k37y
  - db-kk2l
  - db-ju0q
  - db-8su3
  - db-vfhd
  - db-s6p9
  - db-771z
---

Drizzle ORM project setup with PostgreSQL + SQLite dual-dialect support.

## Scope

- packages/db package structure with Drizzle ORM
- Dual-dialect strategy: separate pgTable/sqliteTable definitions, shared TypeScript interfaces as source of truth (no unified table constructor exists)
- drizzle-kit configuration for both dialects
- Separate migration folders: migrations/pg/ and migrations/sqlite/
- Connection factory: env-based dialect selection (`DB_DIALECT=pg|sqlite`)
- customType() usage for cross-dialect column mapping
- Database client creation helpers for both dialects

### Schema conventions

- **Timestamps**: PG uses `timestamptz`, SQLite uses `integer` (Unix epoch ms). Implement via Drizzle `customType` for portability.
- **Enums**: Use `varchar` + CHECK constraints on both dialects (not PG CREATE TYPE) for cross-dialect portability.
- **Audit columns**: Define reusable helpers:
  - `timestamps()` → `{ created_at, updated_at }` with appropriate types per dialect
  - `archivable()` → `{ archived, archived_at }` boolean + nullable timestamp
  - `versioned()` → `{ version }` integer for CRDT
- **NOT NULL/DEFAULT conventions**: All `id` columns NOT NULL (PK), all `system_id` FK NOT NULL, all `created_at` NOT NULL with DEFAULT NOW().
- **Binary data**: `bytea` (PG) / `blob` (SQLite) via Drizzle `customType`.
- **JSON data**: `jsonb` (PG) / `text` (SQLite) via Drizzle `customType`. Note: loses @>, ->> operators on SQLite.

## Acceptance Criteria

- [ ] packages/db initialized with Drizzle ORM dependency
- [ ] Dual-dialect config: drizzle.config.ts supports both PG and SQLite
- [ ] Shared interfaces extracted for table shapes
- [ ] pgTable and sqliteTable definitions for at least one example table
- [ ] Migration generation works for both dialects
- [ ] Connection factory selects dialect from env
- [ ] Reusable audit column helpers (timestamps, archivable, versioned)
- [ ] customType mappings: timestamp, bytea/blob, jsonb/text-json
- [ ] Enum strategy documented: varchar + CHECK for portability
- [ ] Database client exported for consumers
- [ ] Document: which PG features are unavailable on SQLite
- [ ] Unit test: connection factory creates correct dialect

## Research Notes

- Drizzle has no unified table constructor — must maintain parallel definitions
- JSONB becomes TEXT on SQLite (loses @>, ->> operators, indexing)
- BigInt columns cast to TEXT in SQLite SELECTs
- Timestamp handling differs: native PG timezone vs Unix epoch in SQLite
- Boolean handling: SQLite stores as 0/1 integer; Drizzle handles transparently

## References

- ADR 004 (Database)
