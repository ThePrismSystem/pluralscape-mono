---
# db-bqab
title: Remove fronting_type column; split outtrigger into separate fields
status: completed
type: task
priority: normal
created_at: 2026-03-21T23:18:30Z
updated_at: 2026-03-21T23:39:00Z
parent: api-5pvc
---

Remove fronting_type (fronting/co-conscious distinction) from fronting_sessions. Split outtrigger from a bundled object into two separate T1 fields: outtrigger (reason string) and outtrigger_sentiment (positive/neutral/negative).

## Summary of Changes\n\nRemoved fronting_type column from fronting_sessions (PG + SQLite schemas, indexes, CHECK constraint, FRONTING_TYPES enum array). Split outtrigger from bundled object { reason, sentiment } into two separate T1 fields: outtrigger (string | null) and outtriggerSentiment (OuttriggerSentiment | null). Updated CrdtFrontingSession, ServerFrontingSession, domain types, journal snapshot types, barrel exports, and all tests. Regenerated migrations.
