---
# infra-psh9
title: Storage adapter interface
status: todo
type: task
priority: normal
created_at: 2026-03-08T19:57:31Z
updated_at: 2026-03-08T19:57:31Z
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
