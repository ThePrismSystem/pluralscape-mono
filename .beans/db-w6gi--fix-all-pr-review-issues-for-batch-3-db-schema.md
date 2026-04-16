---
# db-w6gi
title: Fix all PR review issues for batch 3 DB schema
status: completed
type: task
priority: normal
created_at: 2026-03-10T03:39:40Z
updated_at: 2026-04-16T07:29:39Z
parent: db-2nr7
---

Fix 18 issues from multi-model PR review of PR #48. Includes shared type extraction, schema fixes (CHECK constraints, detail type, pin_hash width), enums cleanup, PG test fixes, SQLite test infrastructure, and 6 new SQLite integration test files.

## Summary of Changes

Fixed all 18 issues from multi-model PR review of batch 3 DB schema:

- Extracted `DbAuditActor` type to `helpers/types.ts` (shared between PG/SQLite)
- Added `api_keys_key_material_check` CHECK constraint (crypto keys must have material, metadata must not)
- Added `api_keys_system_id_idx` index (both dialects)
- Fixed `scopedBucketIds` type from `readonly string[] | null` to `readonly string[]`
- Changed `audit_log.detail` from `jsonb`/`sqliteJson` to `text` (both dialects)
- Added doc comments for denormalized/non-standard column names
- Widened `pin_hash` from VARCHAR(255) to VARCHAR(512) in PG
- Consolidated 12 separate type imports into single import in enums.ts
- Added naming convention comment for enum constants
- Exported `API_KEY_KEY_TYPES`, `API_KEY_SCOPES`, `AUDIT_EVENT_TYPES`, `DbAuditActor` from barrel
- Fixed unscoped `SELECT *` in audit-log test to use WHERE clause
- Added 3 new PG test cases (CHECK validation, empty scopes, version increment)
- Created SQLite test infrastructure (6 DDL entries + 6 creator functions)
- Created 6 new SQLite integration test files (52 new tests total)
