---
# db-dnpa
title: Add covering indexes for M5 list endpoint ORDER BY
status: completed
type: task
priority: normal
created_at: 2026-03-26T07:43:54Z
updated_at: 2026-03-26T07:57:08Z
parent: ps-106o
---

List queries for notes, polls, acknowledgements, board messages, and poll votes order by createdAt DESC, id DESC but existing indexes only cover (systemId, archived). Postgres must fetch all matching rows then sort in memory.

## Fix

Add covering indexes:

- notes_system_archived_created_idx ON notes(system_id, archived, created_at DESC, id DESC)
- polls_system_archived_created_idx ON polls(system_id, archived, created_at DESC, id DESC)
- acknowledgements_system_archived_created_idx ON acknowledgements(system_id, archived, created_at DESC, id DESC)
- board_messages_system_archived_sort_idx ON board_messages(system_id, archived, sort_order, id)
- poll_votes_poll_archived_created_idx ON poll_votes(poll_id, archived, created_at DESC, id DESC)

## Tasks

- [x] Add all 5 covering indexes to schema
- [x] Regenerate migrations
- [x] Regenerate RLS migration

## Summary of Changes

Added 7 covering indexes: notes, polls, acknowledgements (system+archived+createdAt DESC), board_messages (system+archived+sortOrder), poll_votes (pollId+createdAt DESC), poll_votes voter GIN, and channels parentId.
