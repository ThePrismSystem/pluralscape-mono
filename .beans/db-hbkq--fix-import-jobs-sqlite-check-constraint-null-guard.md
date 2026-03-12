---
# db-hbkq
title: Fix import_jobs SQLite CHECK constraint NULL guard
status: completed
type: bug
priority: high
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-12T04:08:51Z
parent: db-q3r3
---

PG: chunksCompleted <= chunksTotal WHERE chunksTotal IS NOT NULL. SQLite: chunksCompleted <= chunksTotal (no NULL guard). SQLite rejects inserts where chunksTotal IS NULL because 0 <= NULL is falsy. Blocks creating import jobs without known chunk count. Ref: audit H4

## Summary of Changes\n\nNo code changes needed. Verified the import_jobs schema already has the correct NULL guard (`chunksTotal IS NULL OR chunksCompleted <= chunksTotal`) in both the Drizzle schema (import-export.ts:57-58) and DDL test helper (sqlite-helpers.ts:1082).
