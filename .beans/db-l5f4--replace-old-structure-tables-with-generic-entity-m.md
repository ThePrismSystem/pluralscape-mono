---
# db-l5f4
title: Replace old structure tables with generic entity model in DB schema
status: completed
type: task
priority: normal
created_at: 2026-03-22T03:55:15Z
updated_at: 2026-03-22T04:30:20Z
---

PR 2 of M4 structure entity refactor. Remove 9 old tables, add fieldDefinitionScopes, extend fieldValues, update fronting FK/CHECK, update RLS policies and all tests.

## Summary of Changes

Completed PR 2 of the M4 structure entity refactor (DB schema layer):

- Removed 9 old structure tables (subsystems, sideSystems, layers, 3 memberships, 3 cross-links) from both PG and SQLite schemas
- Added composite FK from frontingSessions.structureEntityId to systemStructureEntities
- Updated fronting subject CHECK to 3-way (member OR customFront OR structureEntity)
- Added fieldDefinitionScopes table (PG + SQLite) with scope type validation and uniqueness
- Extended fieldValues with structureEntityId and groupId columns, polymorphic unique indexes, and mutual exclusivity CHECK
- Updated RLS policies: removed 9 old entries, added 6 new
- Fixed FieldValue.memberId type to be nullable (PR 1 oversight)
- Updated all test helpers (PG + SQLite), creation order for FK dependencies
- Rewrote structure integration tests for 5 new tables
- Updated fronting, custom-fields, views, orphan cleanup, and type parity tests
- Regenerated PG and SQLite migrations
