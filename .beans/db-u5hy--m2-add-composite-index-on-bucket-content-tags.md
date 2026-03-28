---
# db-u5hy
title: "M2: Add composite index on bucket_content_tags"
status: completed
type: task
priority: normal
created_at: 2026-03-28T21:26:52Z
updated_at: 2026-03-28T21:55:48Z
parent: ps-tkuz
---

**Audit:** M6 audit finding M2 (Performance)
**File:** `packages/db/src/schema/pg/privacy.ts:65-73`

No index on `(systemId, entityType)` for `bucket_content_tags`. The `loadBucketTags` query pattern `WHERE system_id = ? AND entity_type = ? AND entity_id IN (...)` hits every export, dashboard, and switch alert.

**Fix:** Add `index("bucket_content_tags_system_entity_type_idx").on(t.systemId, t.entityType)`.

## Summary of Changes

Added composite index `bucket_content_tags_system_entity_type_idx` on `(systemId, entityType)` to both PG and SQLite schemas. Regenerated drizzle migration (`0001_tidy_gamma_corps.sql`) and RLS migration (`0002_rls_all_tables.sql`). Updated RLS test reference.
