---
# ps-uuj1
title: Remove unused bun-sqlite.d.ts ambient declaration
status: completed
type: task
priority: normal
created_at: 2026-03-21T02:57:09Z
updated_at: 2026-03-21T08:04:04Z
parent: ps-i3xl
---

packages/sync/src/bun-sqlite.d.ts

## Summary of Changes\n\nDeleted packages/sync/src/bun-sqlite.d.ts. The sync package no longer imports bun:sqlite directly — it uses the SqliteDriver interface abstraction.
