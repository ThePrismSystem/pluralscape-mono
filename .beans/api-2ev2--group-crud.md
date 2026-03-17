---
# api-2ev2
title: Group CRUD
status: completed
type: task
priority: normal
created_at: 2026-03-16T11:56:49Z
updated_at: 2026-03-17T21:40:23Z
parent: api-tzme
blocked_by:
  - api-o89k
  - api-wq3i
---

POST /systems/:systemId/groups (name, description, parentGroupId, color, emoji, imageSource, sortOrder in encryptedData). GET list. GET by ID. PUT update with OCC. Validate parentGroupId (no circular refs).

## Summary of Changes\n\nGroup CRUD service and routes: create, list, get, update, delete with E2EE blobs, OCC versioning, cursor pagination, and HAS_DEPENDENTS guard.
