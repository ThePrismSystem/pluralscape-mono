---
# ps-p97u
title: Media upload hooks
status: completed
type: feature
priority: normal
created_at: 2026-04-01T00:11:51Z
updated_at: 2026-04-04T19:56:19Z
parent: ps-j47j
---

Blob upload, progress tracking, image processing

Uses trpc.blob.\* for metadata. **REST exception:** upload/download URL generation uses REST client for presigned URL handling. Actual file transfer is direct to storage.

## Summary of Changes

Implemented blob data hooks with composite upload workflow:

- useBlob, useBlobsList, useBlobDownloadUrl, useDeleteBlob (CRUD)
- useBlobUpload (composite: get presigned URL → PUT file → confirm, with status/progress/error/reset)

All tests passing.

## Summary of Changes

Implemented blob data hooks with composite upload workflow:

- useBlob, useBlobsList, useBlobDownloadUrl, useDeleteBlob (CRUD)
- useBlobUpload (composite: get presigned URL → PUT file → confirm, with status/progress/error/reset)

All tests passing.
