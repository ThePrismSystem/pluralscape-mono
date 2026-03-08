---
# db-85zd
title: Littles safe mode content table
status: todo
type: task
priority: normal
created_at: 2026-03-08T14:23:06Z
updated_at: 2026-03-08T19:32:38Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-i2gl
---

Safe mode content items (links, videos, media) for the Littles Safe Mode feature.

## Scope

- `safe_mode_content`: id (UUID PK), system_id (FK → systems, NOT NULL), version (integer, T3, NOT NULL, default 1), sort_order (integer), created_at (timestamptz, T3, NOT NULL, default now()), updated_at (timestamptz, T3, NOT NULL, default now()), encrypted_data (T1 — content_type ('link'|'video'|'media'), url/blob_ref, title, description)
- Design: all content is T1 encrypted — safe mode content is sensitive (what a system deems safe for littles)
- Indexes: safe_mode_content (system_id, sort_order)

## Acceptance Criteria

- [ ] safe_mode_content table with encrypted content items
- [ ] Sort order for display ordering
- [ ] Support for links, videos, and media blob references
- [ ] Migrations for both dialects
- [ ] Integration test: add and reorder safe mode content

## References

- features.md section 13 (Littles Safe Mode — configurable safe content)

### Cascade rules

- System deletion → CASCADE: safe_mode_content
