---
# db-2e2s
title: Journal and wiki tables
status: todo
type: task
priority: normal
created_at: 2026-03-08T14:03:40Z
updated_at: 2026-03-08T14:03:40Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-i2gl
---

Journal page, block, and wiki tables. Implementation is later milestones but schema defined here for completeness.

## Scope

- `journal_entries`: id, system_id, encrypted_data (T1 — title, blocks JSON, author_member_id), created_at (T3), updated_at (T3)
- `wiki_pages`: id, system_id, slug (varchar — T3, URL-safe for routing), encrypted_data (T1 — title, blocks JSON, linked_page_ids), created_at (T3), updated_at (T3)
- Design: blocks stored as serialized JSON inside encrypted blob (not separate rows) — simpler encryption model, avoids per-block encryption overhead
- Design: wiki slugs are T3 (needed for URL routing without decryption)
- Indexes: journal_entries (system_id, created_at), wiki_pages (system_id, slug unique)

## Acceptance Criteria

- [ ] journal_entries table with encrypted block content
- [ ] wiki_pages table with plaintext slug for routing
- [ ] Unique index on (system_id, slug) for wiki pages
- [ ] Migrations for both dialects
- [ ] Integration test: create journal entry and wiki page

## References

- features.md section 7 (Journaling)
