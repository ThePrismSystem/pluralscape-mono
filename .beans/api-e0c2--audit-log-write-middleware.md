---
# api-e0c2
title: Audit log write middleware
status: todo
type: task
priority: normal
created_at: 2026-03-16T11:52:35Z
updated_at: 2026-03-16T11:58:01Z
parent: api-o89k
blocked_by:
  - api-5mzr
---

Reusable helper that writes audit log entries: accepts eventType, actor, detail, extracts IP/userAgent from request context. Pattern used by all subsequent epics. Insert into partitioned audit_log table.
