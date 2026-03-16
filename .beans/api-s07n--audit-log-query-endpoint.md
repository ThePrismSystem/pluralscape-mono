---
# api-s07n
title: Audit log query endpoint
status: todo
type: task
priority: low
created_at: 2026-03-16T11:33:14Z
updated_at: 2026-03-16T11:33:20Z
parent: ps-rdqo
blocked_by:
  - api-o89k
  - api-wq3i
---

GET /audit-log with cursor-based pagination and filters (eventType, resourceType, date range). Max 90-day query range per request per api-specification.md Section 8. Audit log write middleware is cross-cutting (bootstrapped in auth epic).
