---
# infra-xotv
title: S3 presigned URL adapter
status: todo
type: task
priority: normal
created_at: 2026-03-08T19:58:11Z
updated_at: 2026-03-08T19:58:11Z
parent: infra-o80c
blocked_by:
  - infra-psh9
---

S3-compatible storage adapter for hosted deployments using presigned URLs.

## Scope

- Implement BlobStorage interface for S3-compatible backends (AWS S3, Cloudflare R2, Backblaze B2)
- Presigned upload URLs: time-limited, content-type restricted, size-limited
- Presigned download URLs: time-limited, per-request
- Direct client-to-S3 upload flow (API server generates URL, client uploads directly)
- Bucket configuration: region, endpoint, access credentials (from environment)
- Object key naming: `{accountId}/{blobId}` pattern for isolation
- Content-type validation: allow only approved MIME types
- Size limits: per-upload and per-account quota enforcement
- Error handling: S3 API error mapping to application errors

## Acceptance Criteria

- [ ] BlobStorage interface implemented for S3
- [ ] Presigned upload URL generation with expiry and size limits
- [ ] Presigned download URL generation with expiry
- [ ] Client-to-S3 direct upload flow
- [ ] Multi-provider support (AWS, R2, B2)
- [ ] Object key isolation by account
- [ ] Content-type validation
- [ ] Error mapping from S3 API errors
- [ ] Integration test against MinIO (S3-compatible)

## References

- ADR 009 (Blob Storage — S3 presigned URLs)
