---
# db-vn6b
title: Adopt branded ID types in search module interfaces
status: completed
type: task
priority: normal
created_at: 2026-03-12T11:54:24Z
updated_at: 2026-03-12T23:58:35Z
---

The schema layer (packages/db/src/schema/) consistently uses plain string for IDs. Adopting branded types (SystemId, etc.) in the search interfaces (both PG and SQLite) would require changes across both dialects and all callers. This is a cross-cutting change best tracked separately.

## Summary of Changes

Adopted branded SystemId type in PG search module interfaces:

- PgSearchIndexEntry.systemId: string -> SystemId
- deleteSearchEntry systemId param: string -> SystemId
- searchEntries systemId param: string -> SystemId
- Updated PG search integration test to cast pgInsertSystem results to SystemId

entityId remains string since it is polymorphic across all entity types (no single branded type fits). SQLite search has no systemId (single-tenant) so no changes needed there.
