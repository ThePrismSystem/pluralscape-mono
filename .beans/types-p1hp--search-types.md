---
# types-p1hp
title: Search types
status: todo
type: task
priority: normal
created_at: 2026-03-08T14:23:24Z
updated_at: 2026-03-08T19:56:09Z
parent: types-im7i
blocked_by:
  - types-av6x
---

Full-text search types for client-side FTS5 search over decrypted data.

## Scope

- `SearchQuery`: text (string), entityTypes (SearchableEntityType[] — filter), limit (number), offset (number)
- `SearchableEntityType`: 'member' | 'custom-field' | 'group' | 'note' | 'journal-entry' | 'chat-message' | 'board-message' | 'wiki-page' | 'system-structure'
- `SearchResult<T>`: items (SearchResultItem<T>[]), totalCount (number), query (string)
- `SearchResultItem<T>`: entityType (SearchableEntityType), entityId (string), matchedField (string), snippet (string — highlighted excerpt), entity (T)
- `SearchIndex`: entityType, entityId, searchableText (string) — for indexing
- Design: search runs client-side on decrypted data (server cannot search encrypted content)
- Design: friend search uses same types but filtered by bucket permissions

## Acceptance Criteria

- [ ] SearchQuery type with entity-type filters
- [ ] SearchableEntityType covers all 9 entity types from features.md
- [ ] SearchResult with pagination and snippets
- [ ] SearchIndex type for FTS5 indexing
- [ ] Unit tests for query construction

## References

- features.md section 8 (Search)
