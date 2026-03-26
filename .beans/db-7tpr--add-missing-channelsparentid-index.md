---
# db-7tpr
title: Add missing channels.parentId index
status: completed
type: task
priority: normal
created_at: 2026-03-26T07:43:55Z
updated_at: 2026-03-26T10:11:56Z
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

## Summary of Changes\n\nAlready implemented in prior audit PR — index exists in schema (communication.ts:55) and migration 0006_little_guardsmen.sql.
