---
# api-2ev2
title: Group CRUD
status: todo
type: task
priority: normal
created_at: 2026-03-16T11:56:49Z
updated_at: 2026-03-16T11:58:08Z
parent: api-tzme
blocked_by:
  - api-o89k
  - api-wq3i
---

POST /systems/:systemId/groups (name, description, parentGroupId, color, emoji, imageSource, sortOrder in encryptedData). GET list. GET by ID. PUT update with OCC. Validate parentGroupId (no circular refs).
