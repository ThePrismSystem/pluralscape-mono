---
# api-ysx4
title: Member create and read
status: completed
type: task
priority: normal
created_at: 2026-03-16T11:56:42Z
updated_at: 2026-03-17T21:35:42Z
parent: api-b0nb
blocked_by:
  - api-o89k
  - api-wq3i
---

POST /systems/:systemId/members (encryptedData blob: name, pronouns, description, avatar, colors, saturationLevel, tags, notification settings). GET list (cursor paginated). GET by ID. OCC versioning. System-scoped.

## Summary of Changes\n\nImplemented member create (POST), list (GET, cursor-paginated), and get (GET by ID) routes with service layer, validation schemas, and route tests.
