---
# infra-psh9
title: Storage adapter interface
status: completed
type: task
priority: normal
created_at: 2026-03-08T19:57:31Z
updated_at: 2026-03-15T03:09:16Z
parent: infra-o80c
---

Shared interface for the triple-backend blob storage system (S3, MinIO, local filesystem).

## Scope

- `BlobStorage` interface: upload, download, delete, getMetadata, generatePresignedUploadUrl, generatePresignedDownloadUrl
- Upload accepts encrypted bytes (client-side encryption already applied)
- Download returns encrypted bytes (client decrypts)
- Presigned URL generation for direct client-to-storage uploads (S3/MinIO only)
- Local filesystem fallback: API server handles upload/download directly (no presigned URLs)
- Metadata operations: size, content type, upload timestamp, encryption metadata
- Quota checking: per-account storage limits enforced before upload
- Backend detection: auto-select adapter based on deployment configuration

## Acceptance Criteria

- [ ] BlobStorage interface with upload/download/delete/metadata
- [ ] Presigned URL generation for S3-compatible backends
- [ ] Fallback path for local filesystem (direct serving)
- [ ] Quota enforcement before upload
- [ ] Backend auto-detection from configuration
- [ ] Interface tested with mock implementation
- [ ] Unit tests for adapter contract

## References

- ADR 009 (Blob/Media Storage)
- types-41na (Blob metadata types)
- db-1dza (Blob metadata table)

## Summary of Changes

Implemented the full `@pluralscape/storage` package:

- `BlobStorageAdapter` interface with upload, download, delete, exists, getMetadata, presigned URL generation
- Presigned URLs as a capability discriminated union (supported: true/false) — no adapter type-checking needed
- `generateStorageKey` / `parseStorageKey` utilities for account-isolated storage keys
- 4 error classes (BlobNotFoundError, BlobAlreadyExistsError, BlobTooLargeError, StorageBackendError)
- `MemoryBlobStorageAdapter` mock (supportsPresignedUrls = false)
- `runBlobStorageContract()` — 8 contract test categories, 26 tests pass
- Typecheck and lint clean

PR: https://github.com/ThePrismSystem/pluralscape-mono/pull/113
