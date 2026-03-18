---
# api-jtka
title: Upload confirmation and metadata
status: completed
type: task
priority: normal
created_at: 2026-03-16T11:57:26Z
updated_at: 2026-03-18T05:35:25Z
parent: api-dg4u
blocked_by:
  - api-0iu1
---

POST /blobs/:blobId/confirm (validate checksum, mark confirmed, record sizeBytes/uploadedAt). GET /blobs/:blobId (return metadata). Handle thumbnail relationship (thumbnailOfBlobId).
