---
# db-t5wu
title: Add fronting_reports table
status: completed
type: bug
priority: high
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-12T21:24:16Z
parent: db-gwpb
---

FrontingReportId exists in ids.ts, fronting-report is in EntityType, but no fronting_reports table exists in PG or SQLite. Ref: audit H15

## Summary of Changes\n\nAlready resolved. The `fronting_reports` table exists in `pg/analytics.ts:17-36` and `sqlite/analytics.ts:16-35`.
