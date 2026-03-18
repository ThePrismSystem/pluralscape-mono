---
# api-uixu
title: Download URL and blob lifecycle
status: completed
type: task
priority: normal
created_at: 2026-03-16T11:57:26Z
updated_at: 2026-03-18T05:35:25Z
parent: api-dg4u
blocked_by:
    - api-jtka
---

GET /blobs/:blobId/download-url (presigned, 1hr TTL). DELETE /blobs/:blobId (archive metadata, S3 cleanup deferred to lifecycle job). Orphan blob cleanup query helper.
