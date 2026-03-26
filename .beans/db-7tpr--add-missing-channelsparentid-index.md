---
# db-7tpr
title: Add missing channels.parentId index
status: todo
type: task
priority: normal
created_at: 2026-03-26T07:43:55Z
updated_at: 2026-03-26T07:43:55Z
parent: ps-106o
---

parentId participates in a self-referencing FK but has no supporting index. Sequential scan on parent lookups.

## File

- packages/db/src/schema/pg/communication.ts:46

## Fix

Add index('channels_parent_id_idx').on(t.parentId). Regenerate migrations.

## Tasks

- [ ] Add index to schema
- [ ] Regenerate migrations
- [ ] Regenerate RLS migration
