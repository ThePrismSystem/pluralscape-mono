---
# db-gwpb
title: Schema-type alignment and correctness
status: completed
type: feature
priority: normal
created_at: 2026-03-11T19:39:29Z
updated_at: 2026-03-11T20:54:06Z
parent: db-2je4
---

Fix every mismatch between DB schema and canonical types — each is a runtime error waiting to happen in M2 API routes. Includes CI-enforced parity tests.

## Consolidates

db-y7ct, db-uvco, db-38it, db-8h0o, db-h1ns, db-vnfk, db-e3ql, db-grmv, db-t5wu, db-auki

## Tasks

- [x] Add type parity tests between DB schema and canonical types — CI-enforced (db-y7ct)
- [x] Fix system_settings PK mismatch with types (db-uvco)
- [x] Resolve switches.encryptedData column vs Switch type mismatch (db-38it)
- [x] Fix fronting_comments column naming mismatch (db-8h0o)
- [x] Fix sessions.deviceInfo type mismatch (db-h1ns)
- [x] Fix member_photos.sortOrder nullable mismatch (db-vnfk)
- [x] Fix bucketContentTags.entityType enum type (db-e3ql)
- [x] Fix bucket_content_tags entity_type wrong enum (db-grmv)
- [x] Add fronting_reports table (db-t5wu)
- [x] Fix importJobs.updatedAt nullable inconsistency (db-auki)

## Summary of Changes

All 9 fixes implemented across both PG and SQLite dialects:

1. **entity_type enum**: Changed from BucketVisibilityScope (9 values) to EntityType (~60 values) with CHECK constraint
2. **member_photos.sortOrder**: Made non-nullable with DEFAULT 0
3. **fronting_comments column**: Renamed sessionId/session_id to frontingSessionId/fronting_session_id
4. **sessions.deviceInfo**: Changed from varchar/text to jsonb/sqliteJson for DeviceInfo object
5. **switches.encryptedData**: Replaced encrypted blob with memberIds jsonb array (T3 plaintext)
6. **system_settings PK**: Added separate id column as PK, systemId becomes unique FK
7. **import/export updatedAt**: Made non-nullable in both DB schema and types
8. **fronting_reports table**: New analytics table in pg/analytics.ts and sqlite/analytics.ts
9. **Type parity tests**: 77 tests covering column parity, type assertions, and DB-only allowlists

All schemas use unbranded Db\* interfaces at the DB layer to avoid branded type friction in tests. Views layer updated for schema changes. 1141 tests pass, typecheck and lint clean.
