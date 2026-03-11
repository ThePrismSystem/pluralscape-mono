---
# db-fvx4
title: Client-side FTS5 search index schema
status: completed
type: task
priority: normal
created_at: 2026-03-08T14:23:17Z
updated_at: 2026-03-10T09:48:41Z
parent: db-2je4
blocked_by:
  - db-9f6f
---

FTS5 virtual table definitions for client-side full-text search over decrypted data.

## Scope

- `search_index`: FTS5 virtual table on SQLite (client-side only) indexing decrypted content
- Indexed entity types: members (name, pronouns, description), custom fields (name, value), groups (name, description), notes (title, content), journal entries (title, block text), chat messages (content), board messages (content), wiki pages (title, block text), channels (name), system structure entities (subsystems, side systems, layers — names and descriptions)
- Design: runs client-side only — server cannot search encrypted data
- Design: index rebuilt on each decryption session or incrementally updated
- Design: entity-type column for filter-by-type queries
- Search UX: global search bar with entity-type filters, result previews with navigation

## Acceptance Criteria

- [ ] FTS5 virtual table schema defined
- [ ] All searchable entity types indexed
- [ ] Entity-type filtering support
- [ ] Incremental index update strategy documented
- [ ] SQLite-only schema (no PG equivalent)
- [ ] Integration test: index content and search

## References

- features.md section 8 (Search)

## Summary of Changes

- Added FTS5 virtual table schema in `packages/db/src/schema/sqlite/search.ts` with typed helper functions: createSearchIndex, dropSearchIndex, insertSearchEntry, deleteSearchEntry, rebuildSearchIndex, searchEntries
- Added `SEARCHABLE_ENTITY_TYPES` enum array to helpers
- Added 12 integration tests covering MATCH queries, entity type filtering, limit, delete, rebuild, and special characters
