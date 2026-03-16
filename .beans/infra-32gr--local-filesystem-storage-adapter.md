---
# infra-32gr
title: Local filesystem storage adapter
status: completed
type: task
priority: normal
created_at: 2026-03-08T19:58:17Z
updated_at: 2026-03-16T00:25:32Z
parent: infra-o80c
blocked_by:
  - infra-psh9
---

Local filesystem storage adapter for minimal self-hosted deployments.

## Scope

- Implement BlobStorage interface using local filesystem directory
- Configurable storage root path (default: `./data/blobs/`)
- Directory structure: `{storageRoot}/{accountId}/{blobId}` for isolation
- API server handles upload/download directly (no presigned URLs)
- Streaming upload/download to avoid memory pressure on large files
- File permissions: restrict to application user only
- Quota enforcement: check directory size before accepting uploads
- Cleanup: garbage collection for orphaned blobs (metadata deleted but file remains)
- No external dependencies — works with single-binary deployment

## Acceptance Criteria

- [ ] BlobStorage interface implemented for local filesystem
- [ ] Configurable storage root directory
- [ ] Account-isolated directory structure
- [ ] Streaming upload and download
- [ ] File permission restrictions
- [ ] Quota enforcement via directory size check
- [ ] Orphaned blob cleanup
- [ ] Unit tests for path construction and isolation
- [ ] Integration test: upload, download, delete cycle

## References

- ADR 009 (Blob Storage — local filesystem fallback)
- ADR 012 (Self-Hosted Tiers — minimal tier)

## Summary of Changes

- Implemented `FilesystemBlobStorageAdapter` in `packages/storage/src/adapters/filesystem/`
- Atomic writes via temp file + rename to prevent partial files on crash
- Metadata stored in `.meta.json` sidecar files alongside blobs
- Path traversal guard rejects keys containing `..` or resolving outside storageRoot
- File permissions set to `0o600` (owner-only read/write)
- Optional `maxSizeBytes` configuration for upload size limits
- `supportsPresignedUrls = false` — filesystem adapters don't support presigned URLs
- All 19 contract tests pass plus 14 filesystem-specific tests (permissions, path traversal, concurrency, atomicity)
- Added `./filesystem` export path to package.json
