---
# db-uomh
title: Add explicit mapper for audit_log timestamp field
status: completed
type: task
priority: normal
created_at: 2026-03-11T04:47:32Z
updated_at: 2026-03-12T08:28:12Z
parent: db-2nr7
---

audit_log uses timestamp rather than createdAt. Mapping contract is implicit — make it explicit or rename column. Ref: audit M23

## Summary of Changes\n\nRenamed `createdAt` to `timestamp` in `ServerAuditLogEntry` to match the DB column name (`audit_log.timestamp`). Updated JSDoc, tier map comment, and type tests. The mapping layer between server/client types handles the rename to the domain `AuditLogEntry.createdAt`.
