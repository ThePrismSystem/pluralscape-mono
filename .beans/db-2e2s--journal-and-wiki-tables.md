---
# db-2e2s
title: Journal and wiki tables
status: in-progress
type: task
priority: normal
created_at: 2026-03-08T14:03:40Z
updated_at: 2026-03-10T04:19:16Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-i2gl
---

Journal page, block, and wiki tables. Implementation is later milestones but schema defined here.

## Scope

### Tables

- **`journal_entries`**: id (UUID PK), system_id (FK → systems, NOT NULL), version (integer, T3, NOT NULL, default 1), archived (boolean, T3, NOT NULL, default false), archived_at (T3, nullable), created_at (T3, NOT NULL, default NOW()), updated_at (T3), encrypted_data (T1, NOT NULL — title, blocks JSON, author (EntityReference), frontingSessionId, tags[], linkedEntities[])
- **`wiki_pages`**: id (UUID PK), system_id (FK → systems, NOT NULL), slug (varchar, T3, NOT NULL — URL-safe for routing), version (integer, T3, NOT NULL, default 1), archived (boolean, T3, NOT NULL, default false), archived_at (T3, nullable), created_at (T3, NOT NULL, default NOW()), updated_at (T3), encrypted_data (T1, NOT NULL — title, blocks JSON, linked_page_ids, tags[], linkedEntities[])

### Design decisions

- Blocks stored as serialized JSON inside encrypted blob (simpler encryption model)
- Wiki slugs are T3 (needed for URL routing). Note: slugs could leak wiki page topics.
- Both tables support archival: non-destructive, read-only preservation with instant restore

### Cascade rules

- System deletion → CASCADE: journal_entries, wiki_pages

### Indexes

- journal_entries (system_id, created_at)
- wiki_pages (system_id, slug) — unique

## Acceptance Criteria

- [ ] version on both tables for CRDT
- [ ] CASCADE on system deletion
- [ ] journal_entries with encrypted block content and archival support
- [ ] wiki_pages with plaintext slug and archival support
- [ ] archived/archived_at on both tables
- [ ] Unique index on (system_id, slug) for wiki pages
- [ ] Migrations for both dialects
- [ ] journal_entries: author as EntityReference, frontingSessionId, tags, linkedEntities in encrypted_data
- [ ] wiki_pages: tags, linkedEntities in encrypted_data
- [ ] Integration test: create journal entry and wiki page, test archival

## References

- features.md section 7 (Journaling)
