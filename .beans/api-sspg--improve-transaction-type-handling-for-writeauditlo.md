---
# api-sspg
title: Improve transaction type handling for writeAuditLog
status: todo
type: task
priority: low
created_at: 2026-03-17T04:00:51Z
updated_at: 2026-03-17T04:00:51Z
parent: api-o89k
---

Multiple places cast tx as PostgresJsDatabase to pass Drizzle transactions to writeAuditLog. Make writeAuditLog accept a broader type or use a generic parameter to avoid brittle casts.
