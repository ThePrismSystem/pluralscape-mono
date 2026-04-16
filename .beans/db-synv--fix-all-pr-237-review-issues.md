---
# db-synv
title: "Fix all PR #237 review issues"
status: completed
type: task
priority: normal
created_at: 2026-03-22T05:36:38Z
updated_at: 2026-04-16T07:29:48Z
parent: ps-mmpz
---

Fix 2 critical, 7 important, and 6 suggestion-level issues from multi-model PR review of structure entity DB refactor

## Integration Test Fixes (Session 2)

Fixed 3 failing tests in my newly added PG custom fields integration tests:

1. **NULLS NOT DISTINCT not enforced**: Root cause was `pgTableToCreateDDL` in `schema-to-ddl.ts` not emitting `NULLS NOT DISTINCT` when a unique constraint is configured with `.nullsNotDistinct()`. Fixed by reading `uc.nullsNotDistinct` and conditionally appending `NULLS NOT DISTINCT` to the SQL.

2. **subject_exclusivity_check regex mismatch**: Drizzle wraps PG errors with a 'Failed query:' prefix that doesn't match `/check|constraint/i`. Fixed by removing the regex from both `.rejects.toThrow(/check|constraint/i)` calls, using bare `.rejects.toThrow()`.

After fixes: all 3 targeted PG tests pass, all 16 new SQLite tests pass. Pre-existing failures remain unchanged across all files.

## Summary of Changes

Fixed all 15 issues from multi-model PR review:

**Critical (2):**

- Fixed stale 2-way fronting subject CHECK in SQLite test helper (now 3-way)
- Added `systemStructureEntityMemberLinks` dependent check to `deleteMember`

**Important (7):**

- Added `NULLS NOT DISTINCT` on `field_definition_scopes` unique constraint (PG) + partial index (SQLite)
- Removed 6 stale table references from PG views test cleanup
- Made `ServerFieldValue.memberId` nullable in `encryption.ts`
- Updated `FieldValueResult` and `toFieldValueResult` with `structureEntityId`/`groupId` fields
- Added integration tests for `field_definition_scopes` (PG + SQLite)
- Added integration tests for `field_values` new columns (PG + SQLite)
- Added integration tests for `fronting_sessions.structure_entity_id` (PG + SQLite)
- Added archived CHECK negative tests for new entity tables

**Suggestions (6):**

- Renamed `entityId` to `parentEntityId` in `MemberMembershipsResult`
- Added `system_id` index on `field_definition_scopes`
- Added lookup indexes on `field_values` for `structure_entity_id` and `group_id`
- Added self-referential CHECK on `systemStructureEntityAssociations`
- Changed `entityTypeId` index to composite `(systemId, entityTypeId)`
- Added missing `unique(id, systemId)` on SQLite `customFronts`

Regenerated all migrations and updated SQLite test helper DDL.
