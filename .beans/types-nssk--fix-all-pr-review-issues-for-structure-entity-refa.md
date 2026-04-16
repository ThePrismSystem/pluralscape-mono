---
# types-nssk
title: Fix all PR review issues for structure entity refactor
status: completed
type: task
priority: normal
created_at: 2026-03-22T03:01:53Z
updated_at: 2026-04-16T07:29:48Z
parent: db-rsn2
---

Fix critical/important issues and implement suggestions from multi-model PR review of PR #236. Covers: Archived type bug, orphan cleanup, validation mismatches, audit events, views, sync schemas, JSDoc, linkedStructure removal, Client type aliases, SubsystemFormationEvent rename, FieldDefinitionScopeType simplification, new DB tables.

## Summary of Changes

Fixed all critical, important, and suggested issues from multi-model PR review:

**Critical fixes:**

- Fixed `Archived*` types to use `Archived<T>` utility (adds missing `archivedAt`)
- Added 5 new DB tables for generic structure entities (PG + SQLite)
- Fixed orphan cleanup table mappings to point to real tables
- Regenerated migrations from scratch

**Important fixes:**

- Replaced 23 stale audit events with 16 new generic ones
- Fixed validation schema mismatches (removed old Subsystem fields, aligned link schemas)
- Updated views layer from cross-link UNION to single association table query
- Removed redundant `linkedStructure` field from fronting types/DB/sync
- Made `Client*` structure types simple aliases
- Updated all stale JSDoc comments

**Suggestions implemented:**

- Renamed `SubsystemFormationEvent` to `StructureEntityFormationEvent`
- Simplified `FieldDefinitionScopeType` (removed `all-structure-entity-types`)
- Aligned link/association schemas with domain types

**Sync package updates:**

- Replaced `CrdtSubsystem`/`CrdtSideSystem`/`CrdtLayer` with generic types
- Updated CRDT strategies, document factory, barrel exports
- Updated all sync tests

All 370 test files pass (5287 tests), typecheck clean, lint clean.
