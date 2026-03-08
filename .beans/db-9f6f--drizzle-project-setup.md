---
# db-9f6f
title: Drizzle project setup
status: todo
type: task
priority: critical
created_at: 2026-03-08T13:32:40Z
updated_at: 2026-03-08T13:35:48Z
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

Drizzle ORM project setup with PostgreSQL + SQLite dual-dialect support

## Scope

- packages/db package structure with Drizzle ORM
- Dual-dialect strategy: separate pgTable/sqliteTable definitions, shared TypeScript interfaces as source of truth (research finding: no unified table constructor exists)
- drizzle-kit configuration for both dialects
- Separate migration folders: migrations/pg/ and migrations/sqlite/
- Connection factory: env-based dialect selection (`DB_DIALECT=pg|sqlite`)
- customType() usage for cross-dialect column mapping
- Database client creation helpers for both dialects

## Acceptance Criteria

- [ ] packages/db initialized with Drizzle ORM dependency
- [ ] Dual-dialect config: drizzle.config.ts supports both PG and SQLite
- [ ] Shared interfaces extracted for table shapes
- [ ] pgTable and sqliteTable definitions for at least one example table
- [ ] Migration generation works for both dialects
- [ ] Connection factory selects dialect from env
- [ ] Database client exported for consumers
- [ ] Document: which PG features are unavailable on SQLite
- [ ] Unit test: connection factory creates correct dialect

## Research Notes

- Drizzle has no unified table constructor — must maintain parallel definitions
- JSONB becomes TEXT on SQLite (loses @>, ->> operators, indexing)
- BigInt columns cast to TEXT in SQLite SELECTs
- Timestamp handling differs: native PG timezone vs Unix epoch in SQLite

## References

- ADR 004 (Database)
