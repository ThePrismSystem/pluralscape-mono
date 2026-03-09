---
# db-9f6f
title: Drizzle project setup
status: completed
type: task
priority: critical
created_at: 2026-03-08T13:32:40Z
updated_at: 2026-03-09T02:19:05Z
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

- [x] packages/db initialized with Drizzle ORM dependency
- [x] Dual-dialect config: drizzle.config.pg.ts and drizzle.config.sqlite.ts
- [x] Shared interfaces extracted for table shapes
- [x] pgTable and sqliteTable definitions for systems table
- [x] Migration generation scripts configured
- [x] Connection factory selects dialect from env (createDatabase + createDatabaseFromEnv)
- [x] Reusable audit column helpers (timestamps, archivable, versioned) for both dialects
- [x] customType mappings: pgTimestamp/sqliteTimestamp, pgBinary/sqliteBinary, pgJsonb/sqliteJson
- [x] Enum arrays defined in helpers/enums.ts for CHECK constraints
- [x] Database client types and factory exported via barrel
- [x] Documented in bean research notes
- [x] 47 tests: dialect, columns, audit helpers, enums, PG/SQLite integration, factory

## Research Notes

- Drizzle has no unified table constructor — must maintain parallel definitions
- JSONB becomes TEXT on SQLite (loses @>, ->> operators, indexing)
- BigInt columns cast to TEXT in SQLite SELECTs
- Timestamp handling differs: native PG timezone vs Unix epoch in SQLite
- Boolean handling: SQLite stores as 0/1 integer; Drizzle handles transparently

## References

- ADR 004 (Database)

## Cascade Chain Reference

Complete deletion cascade for GDPR account purge:

1. **Account deletion** → CASCADE: sessions, auth_keys, recovery_keys, api_keys, device_tokens, import_jobs, export_requests, account_purge_requests. audit_log: SET NULL on account_id (retained for compliance).
2. **Account → System** (via account_id FK) → CASCADE
3. **System deletion** → CASCADE all system-scoped tables: members → member_photos, groups → group_memberships, buckets → bucket_content_tags/key_grants/friend_bucket_assignments, friend_connections, friend_codes, channels → messages, board_messages, notes, polls → poll_votes, acknowledgements, fronting_sessions, switches, custom_fronts, field_definitions → field_values/field_bucket_visibility, journal_entries, wiki_pages, lifecycle_events, relationships, subsystems → subsystem_memberships, side_systems → side_system_memberships, layers → layer_memberships, innerworld_entities, innerworld_regions, innerworld_canvas, blob_metadata, webhook_configs → webhook_deliveries, timer_configs → check_in_records, safe_mode_content, pk_bridge_state, notification_configs, nomenclature_settings, system_settings

## NULL Semantics

PG treats NULL as unique in UNIQUE indexes by default. SQLite does the same since 3.38.0 but only with NULLS NOT DISTINCT. For nullable unique columns, verify behavior on both dialects.

## Summary of Changes

Full Drizzle project setup with dual PG+SQLite dialect support. Custom column types for timestamps, binary, and JSON with testable mapping functions. Audit helpers (timestamps, archivable, versioned) for both dialects. Enum arrays for CHECK constraints. Example systems table with PGlite and better-sqlite3 integration tests. Connection factory with env-based dialect selection. Subpath exports for per-dialect schema access.
