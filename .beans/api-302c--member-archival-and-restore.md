---
# api-302c
title: Member archival and restore
status: todo
type: task
priority: normal
created_at: 2026-03-16T11:56:42Z
updated_at: 2026-03-16T11:58:03Z
parent: api-b0nb
blocked_by:
  - api-ysx4
---

POST .../members/:id/archive, POST .../members/:id/restore. Cascade to member photos on archive. Audit log entries. List endpoint filters archived by default (?include_archived=true).
