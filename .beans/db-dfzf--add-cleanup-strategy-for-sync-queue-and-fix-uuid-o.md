---
# db-dfzf
title: Add cleanup strategy for sync_queue and fix UUID ordering
status: completed
type: bug
priority: high
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-12T06:30:59Z
parent: db-2nr7
---

Completed entries (synced_at IS NOT NULL) accumulate forever. UUID v4 PKs don't guarantee insertion order — sync replay is non-deterministic. Comment in code acknowledges this but takes no action. Add purge mechanism and switch to UUIDv7 or autoincrement sequence. Ref: audit H12

## Summary of Changes\n\nAdded `seq` column (SERIAL on PG, INTEGER on SQLite) to `sync_queue` for deterministic CRDT replay ordering. Added unique index on `seq`.
