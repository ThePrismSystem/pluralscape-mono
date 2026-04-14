---
# api-a6s6
title: Distinguish SESSION_EXPIRED from UNAUTHENTICATED in REST middleware
status: todo
type: bug
priority: high
created_at: 2026-04-14T09:29:02Z
updated_at: 2026-04-14T09:29:02Z
---

AUDIT [API-S-H1] validateSession returns SESSION_EXPIRED or UNAUTHENTICATED but REST middleware collapses both to generic 401. Handled correctly in WebSocket but not REST. File: apps/api/src/middleware/auth.ts:81-83
