---
# db-auki
title: Fix importJobs.updatedAt nullable inconsistency
status: completed
type: bug
priority: normal
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-12T21:24:16Z
parent: db-gwpb
---

All other tables use timestamps() helper with notNull. importJobs and exportRequests declare updatedAt directly as nullable. Ref: audit M4

## Summary of Changes\n\nAlready resolved. `updatedAt` is `.notNull()` in both dialects (`pg/import-export.ts:48`, `sqlite/import-export.ts:41`).
