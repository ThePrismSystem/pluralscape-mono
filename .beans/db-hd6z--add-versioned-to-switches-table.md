---
# db-hd6z
title: Add versioned() to switches table
status: completed
type: task
priority: normal
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-12T00:49:50Z
parent: db-gt84
---

Only fronting-domain table without optimistic concurrency. Ref: audit M3

## Summary of Changes

Added `...versioned()` spread to the switches table definition in both PG and SQLite schemas. Version CHECK constraint applied automatically.
