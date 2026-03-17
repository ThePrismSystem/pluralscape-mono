---
# api-j66r
title: Custom front CRUD
status: completed
type: task
priority: normal
created_at: 2026-03-16T11:56:49Z
updated_at: 2026-03-17T21:40:23Z
parent: api-2296
blocked_by:
  - api-o89k
  - api-wq3i
---

POST /systems/:systemId/custom-fronts (name, description, color, emoji in encryptedData). GET list (cursor paginated). GET by ID. PUT update with OCC. Same members table with discriminator.

## Summary of Changes\n\nCustom front CRUD: create, list, get, update, delete with E2EE blobs, OCC versioning, and HAS_DEPENDENTS guard on fronting sessions.
