---
# api-sspg
title: Improve transaction type handling for writeAuditLog
status: completed
type: task
priority: low
created_at: 2026-03-17T04:00:51Z
updated_at: 2026-03-17T05:31:29Z
parent: api-o89k
---

Multiple places cast tx as PostgresJsDatabase to pass Drizzle transactions to writeAuditLog. Make writeAuditLog accept a broader type or use a generic parameter to avoid brittle casts.

## Summary of Changes\n\nAlready resolved by commit 5e7c718 which widened writeAuditLog to accept PgDatabase<PgQueryResultHKT>. No casts remain — all 9 call sites pass tx directly.
