---
# api-pf5y
title: Member photo gallery CRUD
status: todo
type: task
priority: normal
created_at: 2026-03-16T11:56:42Z
updated_at: 2026-03-16T11:58:03Z
parent: api-b0nb
blocked_by:
  - api-ysx4
  - api-dg4u
---

POST .../members/:memberId/photos (ImageSource discriminated union, sortOrder, caption in encryptedData). GET list (ordered). PUT reorder (batch sortOrder). DELETE (archive). Validate blob refs in blobMetadata.
