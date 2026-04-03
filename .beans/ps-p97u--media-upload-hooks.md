---
# ps-p97u
title: Media upload hooks
status: todo
type: feature
priority: normal
created_at: 2026-04-01T00:11:51Z
updated_at: 2026-04-03T02:24:14Z
parent: ps-j47j
---

Blob upload, progress tracking, image processing

Uses trpc.blob.\* for metadata. **REST exception:** upload/download URL generation uses REST client for presigned URL handling. Actual file transfer is direct to storage.
