---
# api-0iu1
title: Presigned upload URL generation
status: todo
type: task
priority: normal
created_at: 2026-03-16T11:57:26Z
updated_at: 2026-03-16T11:58:21Z
parent: api-dg4u
blocked_by:
  - api-o89k
---

POST /blobs/upload-url (purpose, mimeType, sizeBytes -> presigned S3 URL + blobId). Validate per-purpose size limits from api-constants. Check system quota (1GiB default). Rate limited at blobUpload (20/60s). 15min TTL. Create pending blobMetadata row.
