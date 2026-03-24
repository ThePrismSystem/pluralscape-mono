---
# api-94hy
title: "Integration: blob.service with mock storage"
status: completed
type: task
priority: high
created_at: 2026-03-24T12:46:28Z
updated_at: 2026-03-24T13:27:53Z
parent: api-av4w
---

PGlite integration tests for blob service with mock BlobStorageAdapter: upload URL, confirm, download URL, quota, delete

## Summary of Changes\n\nCreated blob.service.integration.test.ts with 9 tests: createUploadUrl, confirmUpload, not-found, getBlob, pending-blob, downloadUrl, listBlobs, archiveBlob, quota enforcement. Created mock-blob-storage.ts helper.
