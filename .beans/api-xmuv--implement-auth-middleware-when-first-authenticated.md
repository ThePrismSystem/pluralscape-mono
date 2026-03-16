---
# api-xmuv
title: Implement auth middleware when first authenticated route is added
status: todo
type: task
priority: normal
created_at: 2026-03-15T21:55:58Z
updated_at: 2026-03-16T11:59:14Z
parent: api-o89k
blocked_by:
  - api-dcg4
---

Session token extraction (Bearer header), session lookup, expiry checks (absolute + idle TTL), lastActive throttle update, attach auth context (accountId, systemId, sessionId) to Hono context. Return UNAUTHENTICATED/SESSION_EXPIRED.
